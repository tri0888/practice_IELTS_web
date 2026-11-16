import { Hono } from 'hono'
import { jsonBody } from '../../http'
import type { AuthEnv } from '../auth/middleware'
import * as s from './services'

/** /api/histories — all operations scoped to the signed-in user. */
export const attemptsRoutes = new Hono<AuthEnv>()
  .post('/', async c => c.json(await s.startAttempt(c.get('user').id, await jsonBody(c))))
  .put('/:attempt_id/submit', async c => c.json(await s.submitAttempt(c.get('user').id, c.req.param('attempt_id'), await jsonBody(c))))
  .get('/:attempt_id/result', async c => c.json(await s.getResult(c.get('user').id, c.req.param('attempt_id'))))
  .get('/', async c => c.json(await s.listAttempts(c.get('user').id)))
  .delete('/:attempt_id', async c => c.json(await s.deleteAttempt(c.get('user').id, c.req.param('attempt_id'))))
