import { createHash } from 'node:crypto'
import {
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { COLLECTIONS, getCollection } from './database'
import { HttpError, httpError, redirect, type Reply } from './http'
import r2KeyMappings from '../data/r2_keys.json'

export const CACHE_PREFIX = '_cache/pdf-slices/'
const PRESIGN_TTL_SECONDS = 6 * 60 * 60

const env = (name: string, fallback = '') => (process.env[name] ?? fallback).trim().replace(/^["']|["']$/g, '')

export const isR2Enabled = () => ['true', '1', 'yes'].includes(env('USE_R2', 'false').toLowerCase())
export const getR2Bucket = () => env('R2_BUCKET', 'mybucket')

const g = globalThis as typeof globalThis & { __practiceHubR2?: S3Client }

export function getR2Client(): S3Client {
  if (g.__practiceHubR2) return g.__practiceHubR2
  const accountId = env('R2_ACCOUNT_ID')
  const accessKeyId = env('R2_ACCESS_KEY_ID')
  const secretAccessKey = env('R2_SECRET_ACCESS_KEY')
  const missing = Object.entries({ R2_ACCOUNT_ID: accountId, R2_ACCESS_KEY_ID: accessKeyId, R2_SECRET_ACCESS_KEY: secretAccessKey })
    .filter(([, v]) => !v)
    .map(([k]) => k)
  if (missing.length) {
    console.error(`R2 is enabled but env vars are missing: ${missing.join(', ')}`)
    throw httpError(503, `Cloudflare R2 not configured (missing ${missing.join(', ')})`)
  }
  g.__practiceHubR2 = new S3Client({
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    region: 'auto',
    credentials: { accessKeyId, secretAccessKey },
    maxAttempts: 3,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  })
  return g.__practiceHubR2
}

export function normalizeKey(relativeKey: string): string {
  let key = relativeKey.replace(/\\/g, '/').replace(/^\/+/, '')
  if (key.startsWith('Books/')) key = key.slice('Books/'.length)
  return key
}

function isNotFound(err: unknown): boolean {
  if (err instanceof S3ServiceException) {
    return ['NoSuchKey', 'NotFound', 'NoSuchBucket', '404'].includes(err.name) || err.$metadata?.httpStatusCode === 404
  }
  return false
}

function storageError(action: string, key: string, err: unknown): HttpError {
  console.error(`R2 ${action} failed for key ${JSON.stringify(key)}:`, err)
  return httpError(502, `Cloudflare R2 error while trying to ${action} file`)
}

export function assertR2Enabled(notFoundDetail?: string) {
  if (!isR2Enabled()) throw httpError(404, notFoundDetail ?? 'File storage is disabled (set USE_R2=true)')
}

async function mappedKey(key: string): Promise<string | null> {
  const coll = await getCollection(COLLECTIONS.r2Keys)
  if (coll) {
    const doc = await coll.findOne({ target_key: key })
    if (doc?.matched_key) return doc.matched_key as string
  }
  return (r2KeyMappings as Record<string, string>)[key] || null
}

export async function objectExists(key: string): Promise<boolean> {
  try {
    await getR2Client().send(new HeadObjectCommand({ Bucket: getR2Bucket(), Key: key }))
    return true
  } catch (err) {
    if (err instanceof HttpError) throw err
    if (isNotFound(err)) return false
    throw storageError('check', key, err)
  }
}

export async function resolveR2Key(relativeKey: string): Promise<string> {
  const key = normalizeKey(relativeKey)
  if (await objectExists(key)) return key
  const alt = await mappedKey(key)
  if (alt && alt !== key && (await objectExists(alt))) return alt
  throw httpError(404, `File not found: ${key}`)
}

export async function presignedUrl(key: string, mediaType: string, filename: string): Promise<string> {
  const safeName = filename.replace(/[^\x20-\x7e]/g, '').replace(/"/g, '') || 'file'
  try {
    return await getSignedUrl(
      getR2Client(),
      new GetObjectCommand({
        Bucket: getR2Bucket(),
        Key: key,
        ResponseContentType: mediaType,
        ResponseContentDisposition: `inline; filename="${safeName}"`,
      }),
      { expiresIn: PRESIGN_TTL_SECONDS },
    )
  } catch (err) {
    if (err instanceof HttpError) throw err
    throw storageError('sign', key, err)
  }
}

export async function fileResponse(relativeKey: string, mediaType: string, filename?: string, notFoundDetail?: string): Promise<Reply> {
  assertR2Enabled(notFoundDetail)
  const name = filename ?? normalizeKey(relativeKey).split('/').pop() ?? 'file'
  const key = await resolveR2Key(relativeKey)
  return redirect(await presignedUrl(key, mediaType, name))
}

export async function getFileBytes(relativeKey: string): Promise<Uint8Array> {
  assertR2Enabled(`File not found: ${relativeKey}`)
  const key = await resolveR2Key(relativeKey)
  try {
    const res = await getR2Client().send(new GetObjectCommand({ Bucket: getR2Bucket(), Key: key }))
    return await res.Body!.transformToByteArray()
  } catch (err) {
    if (err instanceof HttpError) throw err
    throw storageError('download', key, err)
  }
}

export async function putBytes(key: string, data: Uint8Array, mediaType: string): Promise<void> {
  try {
    await getR2Client().send(new PutObjectCommand({ Bucket: getR2Bucket(), Key: key, Body: data, ContentType: mediaType }))
  } catch (err) {
    if (err instanceof HttpError) throw err
    throw storageError('upload', key, err)
  }
}

const MAX_CACHED_FILES = Math.max(Number(env('R2_MEMORY_CACHE_FILES', '2')) || 2, 1)
const bytesCache = new Map<string, Promise<Uint8Array>>()

export function getFileBytesCached(relativeKey: string): Promise<Uint8Array> {
  const hit = bytesCache.get(relativeKey)
  if (hit) {
    bytesCache.delete(relativeKey)
    bytesCache.set(relativeKey, hit)
    return hit
  }
  const pending = getFileBytes(relativeKey)
  bytesCache.set(relativeKey, pending)
  pending.catch(() => bytesCache.delete(relativeKey))
  while (bytesCache.size > MAX_CACHED_FILES) bytesCache.delete(bytesCache.keys().next().value!)
  return pending
}

export function sliceCacheKey(sourceKey: string, pages: number[]): string {
  const digest = createHash('sha1').update(`${normalizeKey(sourceKey)}|${pages.join(',')}`, 'utf8').digest('hex')
  return `${CACHE_PREFIX}${digest}.pdf`
}

export async function r2Status() {
  const status: Record<string, unknown> = { enabled: isR2Enabled(), bucket: getR2Bucket() }
  if (!status.enabled) return status
  try {
    await getR2Client().send(new HeadBucketCommand({ Bucket: getR2Bucket() }))
    return { ...status, configured: true, reachable: true }
  } catch (err) {
    if (err instanceof HttpError) return { ...status, configured: false, reachable: false, error: err.detail }
    return { ...status, configured: true, reachable: false, error: (err as Error).name }
  }
}

export function __resetR2ForTests(client?: S3Client) {
  g.__practiceHubR2 = client
  bytesCache.clear()
}
