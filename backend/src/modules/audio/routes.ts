import { Hono } from 'hono'
import { COLLECTIONS, getCollection } from '../../db'
import { httpError } from '../../http'
import { fileResponse, isR2Enabled } from '../../r2'
import type { AuthEnv } from '../auth/middleware'

const looksToeic = (name: string) => /ets|toeic/i.test(name)

/** Resolve the storage key for /api/audio/{file_name:path} (DB lookup, else use the path as-is). */
export async function resolveAudioKey(fileName: string): Promise<string> {
  let relativePath: string | null = null

  if (fileName.includes('/') || fileName.includes('\\')) {
    const clean = fileName.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
    const coll = await getCollection(looksToeic(clean) ? COLLECTIONS.toeicAudio : COLLECTIONS.ieltsAudio)
    const doc = coll ? await coll.findOne({ $or: [{ relative_path: `Books/${clean}` }, { relative_path: clean }] }) : null
    relativePath = (doc?.relative_path as string) || clean
  } else {
    const coll = await getCollection(looksToeic(fileName) ? COLLECTIONS.toeicAudio : COLLECTIONS.ieltsAudio)
    const doc = coll ? await coll.findOne({ file_name: fileName }) : null
    relativePath = (doc?.relative_path as string) || (isR2Enabled() ? fileName : null)
  }

  if (!relativePath) throw httpError(404, `Audio file ${fileName} not found`)
  return relativePath.startsWith('Books/') ? relativePath.slice('Books/'.length) : relativePath
}

export const audioRoutes = new Hono<AuthEnv>().get('/:file_name{.+}', async c => {
  const fileName = c.req.param('file_name')
  const key = await resolveAudioKey(fileName)
  const filenameOnly = fileName.split(/[\\/]/).pop() || fileName
  return fileResponse(key, 'audio/mpeg', filenameOnly, `Audio file ${fileName} not found`)
})
