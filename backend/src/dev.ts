/**
 * Local server: `npm run dev` (watch) or `npm start`. Listens on PORT (default 8000),
 * the port the frontend's `/api/*` rewrite targets by default.
 * (Modules read env lazily, so loading .env after the imports is fine.)
 */
import { serve } from '@hono/node-server'
import { loadLocalEnv } from './env'
import app from './app'

loadLocalEnv()

const port = Number(process.env.PORT) || 8000
serve({ fetch: app.fetch, port }, info => {
  console.log(`IELTS API listening on http://localhost:${info.port}/api`)
})
