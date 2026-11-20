import jwt from 'jsonwebtoken'
import { describe, expect, it } from 'vitest'
import { signToken, verifyPassword, verifyToken } from '../src/modules/auth/auth.services'

const DEFAULT_SECRET = 'change-this-secret-in-production'
const EXISTING_HASH = '$2b$12$s.hisTWL5NUcgCQmde51mORZ1thXV8yHXbTFUDondixFGm/ZHWjx.'
const EXISTING_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEiLCJlbWFpbCI6ImFAYi5jIiwicm9sZSI6ImFwcHJvdmVkIiwiaWF0IjoxNzk0NzIwNzkzLCJleHAiOjIxMTAwODA3OTN9.1n2bRQs1wBRg4hMeMjnL-K64VsJ5xZGTlyMiU161mHw'

describe('passwords', () => {
  it('verifies existing $2b$ bcrypt hashes', async () => {
    expect(await verifyPassword('secret-pass-123', EXISTING_HASH)).toBe(true)
    expect(await verifyPassword('wrong', EXISTING_HASH)).toBe(false)
    expect(await verifyPassword('x', 'not-a-hash')).toBe(false)
  })
})

describe('tokens', () => {
  it('accepts tokens issued before (default secret)', () => {
    expect(verifyToken(EXISTING_TOKEN)).toMatchObject({ sub: 'user-1', email: 'a@b.c' })
  })

  it('round-trips its own tokens', () => {
    const payload = verifyToken(signToken({ id: 'u2', email: 'x@y.z' }))
    expect(payload).toMatchObject({ sub: 'u2', email: 'x@y.z' })
    expect(payload.exp! - payload.iat!).toBe(7 * 24 * 60 * 60)
  })

  it('rejects tampered tokens', () => {
    const token = signToken({ id: 'u2', email: 'x@y.z' })
    expect(() => verifyToken(token.slice(0, -2) + 'xx')).toThrow(expect.objectContaining({ status: 401, detail: 'Invalid authentication token' }))
  })

  it('rejects expired tokens with a dedicated message', () => {
    const expired = jwt.sign({ sub: 'u3', exp: Math.floor(Date.now() / 1000) - 10 }, DEFAULT_SECRET)
    expect(() => verifyToken(expired)).toThrow(expect.objectContaining({ status: 401, detail: 'Authentication token expired' }))
  })

  it('rejects tokens signed with another algorithm', () => {
    const none = jwt.sign({ sub: 'u4' }, null, { algorithm: 'none' })
    expect(() => verifyToken(none)).toThrow(expect.objectContaining({ status: 401 }))
  })
})
