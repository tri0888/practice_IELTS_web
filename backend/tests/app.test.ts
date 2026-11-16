/** Wiring smoke tests for the Hono API (ported from Python `test_app_smoke.py`). No DB needed. */
import { describe, expect, it } from 'vitest'
import app from '../src/app'

describe('api app', () => {
  it('reports ok at /api', async () => {
    const res = await app.request('/api')
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ status: 'ok', tests_endpoint: '/api/tests' })
  })

  it.each(['/api/tests', '/api/tests/11/1/practice', '/api/histories', '/api/vocabulary/stats', '/api/audio/x.mp3', '/api/auth/me'])(
    '%s requires authentication',
    async path => {
      const res = await app.request(path)
      expect(res.status).toBe(401)
      expect(await res.json()).toEqual({ detail: 'Authentication required' })
    },
  )

  it('rejects an invalid token with a FastAPI-style detail', async () => {
    const res = await app.request('/api/tests?token=garbage')
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ detail: 'Invalid authentication token' })
  })

  it('validates request bodies (422 like FastAPI)', async () => {
    const res = await app.request('/api/auth/login', { method: 'POST', body: 'not json', headers: { 'Content-Type': 'application/json' } })
    expect(res.status).toBe(422)
  })

  it('returns a JSON 404 for unknown API routes', async () => {
    const res = await app.request('/api/nope')
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ detail: 'Not Found' })
  })

  it('answers 503 on the Telegram webhook when no bot token is configured', async () => {
    const saved = process.env.TELEGRAM_BOT_TOKEN
    delete process.env.TELEGRAM_BOT_TOKEN
    const res = await app.request('/api/telegram/webhook', { method: 'POST', body: '{}' })
    expect(res.status).toBe(503)
    if (saved) process.env.TELEGRAM_BOT_TOKEN = saved
  })
})
