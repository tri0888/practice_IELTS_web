import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client, S3ServiceException } from '@aws-sdk/client-s3'
import { PDFDocument } from 'pdf-lib'

vi.mock('../src/shared/database', async orig => ({
  ...(await orig<typeof import('../src/shared/database')>()),
  getCollection: async () => null,
}))

import * as r2 from '../src/shared/storage'
import { getPdfPage } from '../src/modules/practice/practice.services'

const notFound = () => new S3ServiceException({ name: 'NotFound', $fault: 'client', $metadata: { httpStatusCode: 404 } })

class FakeS3 {
  objects = new Map<string, Uint8Array>()
  puts: string[] = []
  headError: unknown = null
  async send(cmd: unknown) {
    if (cmd instanceof HeadObjectCommand) {
      if (this.headError) throw this.headError
      if (!this.objects.has(cmd.input.Key!)) throw notFound()
      return {}
    }
    if (cmd instanceof GetObjectCommand) {
      const data = this.objects.get(cmd.input.Key!)!
      return { Body: { transformToByteArray: async () => data } }
    }
    if (cmd instanceof PutObjectCommand) {
      this.objects.set(cmd.input.Key!, cmd.input.Body as Uint8Array)
      this.puts.push(cmd.input.Key!)
      return {}
    }
    throw new Error('unexpected command')
  }
}

let fake: FakeS3
const clientFor = (f: FakeS3) => Object.assign(new S3Client({
  region: 'auto', endpoint: 'https://acc.r2.cloudflarestorage.com', credentials: { accessKeyId: 'k', secretAccessKey: 's' },
}), { send: f.send.bind(f) }) as unknown as S3Client

beforeEach(() => {
  process.env.USE_R2 = 'true'
  process.env.R2_ACCOUNT_ID = 'acc'
  process.env.R2_ACCESS_KEY_ID = 'key'
  process.env.R2_SECRET_ACCESS_KEY = 'secret'
  fake = new FakeS3()
  fake.objects.set('ETS 24-26/ETS 2024/AUDIO/Test_01/Test_01-01.mp3', new Uint8Array([1]))
  r2.__resetR2ForTests(clientFor(fake))
})
afterEach(() => r2.__resetR2ForTests())

describe('r2', () => {
  it('normalizes keys (no Books/ prefix, forward slashes)', () => {
    expect(r2.normalizeKey('Books/ETS 24-26/a.mp3')).toBe('ETS 24-26/a.mp3')
    expect(r2.normalizeKey('\\Cam 11\\x.pdf')).toBe('Cam 11/x.pdf')
  })

  it('treats USE_R2 case- and whitespace-insensitively', () => {
    process.env.USE_R2 = ' True '
    expect(r2.isR2Enabled()).toBe(true)
  })

  it('redirects to a presigned URL instead of streaming the file', async () => {
    const res = await r2.fileResponse('Books/ETS 24-26/ETS 2024/AUDIO/Test_01/Test_01-01.mp3', 'audio/mpeg')
    expect(res.status).toBe(302)
    const location = new URL(res.headers.Location)
    expect(decodeURIComponent(location.pathname)).toContain('ETS 24-26/ETS 2024/AUDIO/Test_01/Test_01-01.mp3')
    expect(location.searchParams.get('response-content-type')).toBe('audio/mpeg')
    expect(location.searchParams.get('X-Amz-Signature')).toBeTruthy()
  })

  it('returns 404 for a missing object', async () => {
    await expect(r2.resolveR2Key('nope.pdf')).rejects.toMatchObject({ status: 404 })
  })

  it('reports connection problems as 502, not 404', async () => {
    fake.headError = new Error('ECONNRESET')
    await expect(r2.resolveR2Key('any.pdf')).rejects.toMatchObject({ status: 502 })
  })

  it('is disabled when USE_R2 is off', async () => {
    process.env.USE_R2 = 'false'
    await expect(r2.fileResponse('x.pdf', 'application/pdf', undefined, 'gone')).rejects.toMatchObject({ status: 404, detail: 'gone' })
  })

  it('keeps at most two source PDFs in memory', async () => {
    for (const i of [0, 1, 2]) {
      fake.objects.set(`f${i}.pdf`, new Uint8Array([i]))
      await r2.getFileBytesCached(`f${i}.pdf`)
    }
    fake.objects.delete('f0.pdf')
    await expect(r2.getFileBytesCached('f0.pdf')).rejects.toMatchObject({ status: 404 })
    await expect(r2.getFileBytesCached('f2.pdf')).resolves.toEqual(new Uint8Array([2]))
  })

  it('keeps the slice cache key formula (slices already stored in R2)', () => {
    expect(r2.sliceCacheKey('Books/Cambridge IELTS 11-20/Cam 11/Cambridge 11.pdf', [2, 3]))
      .toBe(`${r2.CACHE_PREFIX}76012232564e4e8ce57156c77cfa42ea12f67b3c.pdf`)
  })

  it('generates a PDF slice once, stores it in R2 and redirects', async () => {
    const src = await PDFDocument.create()
    src.addPage(); src.addPage()
    fake.objects.set('Cambridge IELTS 11-20/Cam 11/Cambridge 11.pdf', await src.save())

    const first = await getPdfPage(11, 2)
    const second = await getPdfPage(11, 2)
    expect([first.status, second.status]).toEqual([302, 302])
    expect(fake.puts).toHaveLength(1)
    expect(fake.puts[0].startsWith(r2.CACHE_PREFIX)).toBe(true)
    expect((await PDFDocument.load(fake.objects.get(fake.puts[0])!)).getPageCount()).toBe(1)
  })
})
