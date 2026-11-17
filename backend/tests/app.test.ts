import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { handleRequest } from '../src/server'

let server: Server
let base = ''

beforeAll(async () => {
  server = createServer(handleRequest)
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterAll(() => new Promise<void>(resolve => server.close(() => resolve())))

const request = (path: string, init?: RequestInit) => fetch(`${base}${path}`, { redirect: 'manual', ...init })

describe('api server', () => {
  it('reports ok at /api', async () => {
    const res = await request('/api')
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ status: 'ok', tests_endpoint: '/api/tests' })
  })

  it.each(['/api/tests', '/api/tests/11/1/practice', '/api/histories', '/api/vocabulary/stats', '/api/audio/x.mp3', '/api/auth/me'])(
    '%s requires authentication',
    async path => {
      const res = await request(path)
      expect(res.status).toBe(401)
      expect(await res.json()).toEqual({ detail: 'Authentication required' })
    },
  )

  it('rejects an invalid token', async () => {
    const res = await request('/api/tests?token=garbage')
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ detail: 'Invalid authentication token' })
  })

  it('answers 422 with a string detail for a malformed body', async () => {
    const res = await request('/api/auth/login', { method: 'POST', body: 'not json', headers: { 'Content-Type': 'application/json' } })
    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({ detail: 'body: must be a valid JSON object' })
  })

  it('answers 422 when a required field is missing', async () => {
    const res = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: 'a@b.c' }) })
    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({ detail: 'password: field required (string)' })
  })

  it.each(['/api/nope', '/nope', '/api/auth/login'])('returns a JSON 404 for %s (GET)', async path => {
    const res = await request(path)
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ detail: 'Not Found' })
  })

  it('answers 503 on the Telegram webhook when no bot token is configured', async () => {
    const saved = process.env.TELEGRAM_BOT_TOKEN
    delete process.env.TELEGRAM_BOT_TOKEN
    const res = await request('/api/telegram/webhook', { method: 'POST', body: '{}' })
    expect(res.status).toBe(503)
    if (saved) process.env.TELEGRAM_BOT_TOKEN = saved
  })
})
