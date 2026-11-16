import { Hono, type Context } from 'hono'
import { intParam } from '../../http'
import { fileResponse } from '../../r2'
import type { AuthEnv } from '../auth/middleware'
import * as s from './services'

const year = (c: Context) => c.req.param('year') ?? '2026'

/**
 * /api/tests — registration order matters (first match wins), mirroring the
 * FastAPI routers: specific ETS routes before the generic {book}/{test} ones.
 * Practice routes (/{book}/{test}/practice ...) are mounted before this router.
 */
export const testsRoutes = new Hono<AuthEnv>()
  .get('/', async c => c.json(await s.listTests()))
  .get('/toeic', async c => c.json(await s.listToeicTests()))

for (const prefix of ['/toeic/:year', '/toeic']) {
  testsRoutes
    .get(`${prefix}/pdf/:pdf_type/:test_number`, async c => {
      const pdfType = c.req.param('pdf_type')
      const testNumber = intParam(c, 'test_number')
      return fileResponse(s.getEtsPdfPath(pdfType, testNumber, year(c)), 'application/pdf', undefined,
        `ETS ${year(c)} ${pdfType.toUpperCase()} Test ${testNumber} PDF not found`)
    })
    .get(`${prefix}/audio/:test_number`, async c => c.json(await s.getEtsAudioList(intParam(c, 'test_number'), year(c))))
    .get(`${prefix}/audio-file/:test_number/:file_name`, async c => {
      const testNumber = intParam(c, 'test_number')
      const fileName = c.req.param('file_name')
      const key = await s.getEtsAudioFilePath(testNumber, fileName, year(c))
      return fileResponse(key, 'audio/mpeg', fileName, `ETS ${year(c)} Audio Test ${testNumber} File ${fileName} not found`)
    })
    .get(`${prefix}/answers/:pdf_type/:test_number`, async c =>
      c.json(await s.getEtsAnswers(c.req.param('pdf_type'), intParam(c, 'test_number'), year(c))))
}

testsRoutes
  .get('/:book/page-count', async c => c.json(await s.getPdfPageCount(intParam(c, 'book'), c.req.query('pdf_type') || 'academic')))
  .get('/:book/pdf', async c => {
    const book = intParam(c, 'book')
    return fileResponse(s.findBookPdfPath(book, c.req.query('pdf_type') || 'academic'), 'application/pdf', undefined,
      `Cambridge IELTS ${book} PDF not found`)
  })
  .get('/:book/:test', async c => c.json(await s.getTest(intParam(c, 'book'), intParam(c, 'test'))))
  .get('/:book/:test/audio', async c => c.json(await s.getTestAudio(intParam(c, 'book'), intParam(c, 'test'))))
  .get('/:book/:test/:skill', async c => c.json(await s.getSkill(intParam(c, 'book'), intParam(c, 'test'), c.req.param('skill'))))
