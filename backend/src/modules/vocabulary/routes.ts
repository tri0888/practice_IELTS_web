import { Hono } from 'hono'
import { intQuery, jsonBody, requireString, validationError } from '../../http'
import type { AuthEnv } from '../auth/middleware'
import * as s from './services'

const optionalString = (v: unknown, field: string) => {
  if (v === undefined || v === null) return v as undefined | null
  if (typeof v !== 'string') throw validationError(['body', field], 'Input should be a valid string')
  return v
}

/** /api/vocabulary — progress is per signed-in user. */
export const vocabularyRoutes = new Hono<AuthEnv>()
  .get('/', async c =>
    c.json(await s.getVocabularyList(c.get('user').id, {
      search: c.req.query('search') || undefined,
      pos: c.req.query('pos') || undefined,
      status: c.req.query('status') || undefined,
      page: intQuery(c, 'page', 1, { min: 1 }),
      limit: intQuery(c, 'limit', 50, { min: 1, max: 100 }),
    })))
  .get('/stats', async c => c.json(await s.getStats(c.get('user').id)))
  .get('/practice', async c =>
    c.json(await s.getPracticeWords(
      c.get('user').id,
      c.req.query('mode') || 'random',
      c.req.query('pos') || undefined,
      intQuery(c, 'limit', 15, { min: 5, max: 50 }),
    )))
  .post('/progress', async c => {
    const body = await jsonBody(c)
    const isCorrect = body.is_correct
    if (isCorrect !== undefined && isCorrect !== null && typeof isCorrect !== 'boolean') {
      throw validationError(['body', 'is_correct'], 'Input should be a valid boolean')
    }
    return c.json(await s.updateProgress(c.get('user').id, requireString(body, 'vocab'), optionalString(body.status, 'status'), isCorrect as boolean | null | undefined))
  })
  .post('/progress/bulk', async c => {
    const body = await jsonBody(c)
    if (!Array.isArray(body.vocabs) || body.vocabs.some(v => typeof v !== 'string')) {
      throw validationError(['body', 'vocabs'], 'Input should be a valid list of strings')
    }
    return c.json(await s.bulkUpdateProgress(c.get('user').id, body.vocabs as string[], requireString(body, 'status')))
  })
