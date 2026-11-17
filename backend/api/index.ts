import { dispatch } from '../src/server'

async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const method = request.method.toUpperCase()
  const body = method === 'GET' || method === 'HEAD' ? '' : await request.text()
  const reply = await dispatch({ method, url: url.pathname + url.search, headers: Object.fromEntries(request.headers), body })
  const payload = reply.body === undefined ? null : typeof reply.body === 'string' ? reply.body : JSON.stringify(reply.body)
  return new Response(payload, { status: reply.status, headers: reply.headers })
}

export const GET = handler
export const POST = handler
export const PUT = handler
export const DELETE = handler
export const PATCH = handler
