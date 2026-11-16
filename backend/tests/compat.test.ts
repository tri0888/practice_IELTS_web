/**
 * Compatibility with data written by the old Python backend: existing bcrypt
 * hashes must still log in and already-issued JWTs must still be accepted.
 * Fixtures were generated with Python `bcrypt` and `PyJWT`.
 */
import { describe, expect, it } from 'vitest'
import { createAccessToken, decodeToken, verifyPassword } from '../src/modules/auth/services'
import { formatMongoUri } from '../src/db'
import { checkTranslationAnswer, formatClue } from '../src/modules/telegram/services'

const PY_BCRYPT_HASH = '$2b$12$s.hisTWL5NUcgCQmde51mORZ1thXV8yHXbTFUDondixFGm/ZHWjx.' // "secret-pass-123"
const PY_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEiLCJlbWFpbCI6ImFAYi5jIiwicm9sZSI6ImFwcHJvdmVkIiwiaWF0IjoxNzk0NzIwNzkzLCJleHAiOjIxMTAwODA3OTN9.1n2bRQs1wBRg4hMeMjnL-K64VsJ5xZGTlyMiU161mHw'

describe('auth compatibility', () => {
  it('verifies bcrypt hashes created by Python', async () => {
    expect(await verifyPassword('secret-pass-123', PY_BCRYPT_HASH)).toBe(true)
    expect(await verifyPassword('wrong', PY_BCRYPT_HASH)).toBe(false)
    expect(await verifyPassword('x', 'not-a-hash')).toBe(false)
  })

  it('accepts JWTs issued by Python (default secret)', async () => {
    const payload = await decodeToken(PY_JWT)
    expect(payload).toMatchObject({ sub: 'user-1', email: 'a@b.c', role: 'approved' })
  })

  it('round-trips its own tokens and rejects tampered ones', async () => {
    const token = await createAccessToken({ id: 'u2', email: 'x@y.z', role: 'pending' })
    expect(await decodeToken(token)).toMatchObject({ sub: 'u2', role: 'pending' })
    await expect(decodeToken(token.slice(0, -2) + 'xx')).rejects.toMatchObject({ status: 401, detail: 'Invalid authentication token' })
  })
})

describe('formatMongoUri (same rules as Python)', () => {
  it('replaces password and database name', () => {
    expect(formatMongoUri('mongodb+srv://bob:old@cluster.x/olddb?retryWrites=true', 'pw', 'ielts'))
      .toBe('mongodb+srv://bob:pw@cluster.x/ielts?retryWrites=true')
    expect(formatMongoUri('mongodb://host:27017', undefined, 'db')).toBe('mongodb://host:27017/db')
    expect(formatMongoUri(undefined)).toBeNull()
  })
})

describe('telegram helpers', () => {
  it('accepts any synonym EN->VI and exact word VI->EN', () => {
    expect(checkTranslationAnswer(' Táo ', 'quả táo; táo', 'en')).toBe(true)
    expect(checkTranslationAnswer('apples', 'apple', 'vi')).toBe(false)
    expect(checkTranslationAnswer('APPLE', 'apple', 'vi')).toBe(true)
  })

  it('formats clues', () => {
    expect(formatClue({ vocab: 'apple', pronunciation: '/ˈæp.əl/', POS: 'n' }, 'vi'))
      .toBe('🔍 Hint: a____ (5 letters)\n📖 Pronunciation: /ˈæp.əl/\n🔤 Type: (n)')
  })
})
