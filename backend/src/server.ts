import { createServer, type IncomingHttpHeaders, type IncomingMessage, type ServerResponse } from 'node:http'
import { guards } from './middleware/middleware'
import { attemptsRoutes } from './routes/attempts.routes'
import { audioRoutes } from './routes/audio.routes'
import { authRoutes } from './routes/auth.routes'
import { healthRoutes } from './routes/health.routes'
import { practiceRoutes } from './routes/practice.routes'
import { telegramRoutes } from './routes/telegram.routes'
import { testsRoutes } from './routes/tests.routes'
import { vocabularyRoutes } from './routes/vocabulary.routes'
import { HttpError, Reply, json, type ApiRequest, type Route } from './shared/http'

const API_PREFIX = '/api'

const routes: Route[] = [
  ...authRoutes,
  ...practiceRoutes,
  ...testsRoutes,
  ...attemptsRoutes,
  ...audioRoutes,
  ...vocabularyRoutes,
  ...telegramRoutes,
  ...healthRoutes,
]

function matchPath(pattern: string, path: string): Record<string, string> | null {
  const want = pattern.split('/').filter(Boolean)
  const got = path.split('/').filter(Boolean)
  const params: Record<string, string> = {}
  for (let i = 0; i < want.length; i++) {
    const part = want[i]
    if (part.startsWith(':') && part.endsWith('*')) {
      if (i >= got.length) return null
      params[part.slice(1, -1)] = got.slice(i).map(decodeURIComponent).join('/')
      return params
    }
    if (i >= got.length) return null
    if (part.startsWith(':')) params[part.slice(1)] = decodeURIComponent(got[i])
    else if (part !== got[i]) return null
  }
  return want.length === got.length ? params : null
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}

function send(res: ServerResponse, reply: Reply) {
  res.statusCode = reply.status
  for (const [name, value] of Object.entries(reply.headers)) res.setHeader(name, value)
  if (reply.body === undefined) return void res.end()
  res.end(typeof reply.body === 'string' ? reply.body : JSON.stringify(reply.body))
}

export type DispatchInput = { method: string; url: string; headers: IncomingHttpHeaders; body: string }

export async function dispatch(input: DispatchInput): Promise<Reply> {
  const method = input.method.toUpperCase()
  try {
    const url = new URL(input.url, 'http://localhost')
    if (url.pathname !== API_PREFIX && !url.pathname.startsWith(`${API_PREFIX}/`)) {
      console.warn('No route', method, input.url)
      return json({ detail: 'Not Found' }, 404)
    }
    const path = url.pathname.slice(API_PREFIX.length).replace(/\/+$/, '') || '/'

    for (const route of routes) {
      if (route.method !== method) continue
      const params = matchPath(route.path, path)
      if (!params) continue

      const apiReq: ApiRequest = { method, path, params, query: url.searchParams, headers: input.headers, body: input.body }
      if (route.guard) await guards[route.guard](apiReq)
      const result = await route.handler(apiReq)
      return result instanceof Reply ? result : json(result ?? null)
    }
    console.warn('No route', method, input.url)
    return json({ detail: 'Not Found' }, 404)
  } catch (err) {
    if (err instanceof HttpError) return json({ detail: err.detail }, err.status)
    console.error(`Unhandled error on ${method} ${input.url}:`, err)
    return json({ detail: 'Internal Server Error' }, 500)
  }
}

export async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const method = (req.method ?? 'GET').toUpperCase()
  const body = method === 'GET' || method === 'HEAD' ? '' : await readBody(req)
  send(res, await dispatch({ method, url: req.url ?? '/', headers: req.headers, body }))
}

export default handleRequest

if (require.main === module) {
  const port = Number(process.env.PORT) || 8000
  createServer(handleRequest).listen(port, () => {
    console.log(`IELTS API listening on http://localhost:${port}/api`)
  })
}
