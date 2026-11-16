import { Hono } from 'hono'
import { HttpError } from './http'
import { r2Status } from './r2'
import { requireApproved, type AuthEnv } from './modules/auth/middleware'
import { authRoutes } from './modules/auth/routes'
import { attemptsRoutes } from './modules/attempts/routes'
import { audioRoutes } from './modules/audio/routes'
import { practiceRoutes } from './modules/practice/routes'
import { testsRoutes } from './modules/tests/routes'
import { vocabularyRoutes } from './modules/vocabulary/routes'
import { telegramRoutes } from './modules/telegram/routes'

/**
 * The whole backend API (formerly FastAPI), served by Next.js at /api/*.
 * Paths and response shapes are unchanged, so the frontend needs no edits.
 */
export const app = new Hono<AuthEnv>().basePath('/api')

app.onError((err, c) => {
  if (err instanceof HttpError) return c.json({ detail: err.detail }, err.status as 400)
  console.error(`Unhandled error on ${c.req.method} ${c.req.path}:`, err)
  return c.json({ detail: 'Internal Server Error' }, 500)
})
app.notFound(c => c.json({ detail: 'Not Found' }, 404))

// Auth guard per area (applied once, before the area's routers).
for (const area of ['/tests', '/tests/*', '/histories', '/histories/*', '/audio/*', '/vocabulary', '/vocabulary/*']) {
  app.use(area, requireApproved)
}

app.route('/auth', authRoutes)
// Practice routes must win over the generic /tests/{book}/{test}/{skill} route.
app.route('/tests', practiceRoutes)
app.route('/tests', testsRoutes)
app.route('/histories', attemptsRoutes)
app.route('/audio', audioRoutes)
app.route('/vocabulary', vocabularyRoutes)
app.route('/telegram', telegramRoutes)
app.get('/r2/status', async c => c.json(await r2Status()))
app.get('/', c => c.json({ service: 'IELTS Backend', status: 'ok', tests_endpoint: '/api/tests' }))

export default app
