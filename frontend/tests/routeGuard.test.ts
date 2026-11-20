import { describe, expect, it } from 'vitest'
import { isKnownAppPath, resolveRedirect, safeNextPath } from '../lib/routeGuard'

const guest = { authenticated: false }
const member = { authenticated: true }

describe('isKnownAppPath', () => {
  it.each([
    '/Home', '/tests', '/history', '/vocabulary',
    '/tests/11/1', '/tests/19/4/practice', '/tests/15/2/practice/reading',
    '/tests/toeic/2024/lc/1', '/tests/toeic/2026/rc/10',
  ])('accepts %s', path => expect(isKnownAppPath(path)).toBe(true))

  it.each([
    '/tests/99/1', '/tests/11/9', '/tests/abc/1', '/tests/11/1/practice/cheat',
    '/tests/11/1/practice/reading/extra', '/tests/toeic/2025/lc/1', '/tests/toeic/2024/xx/1',
    '/tests/toeic/2024/lc/11', '/admin', '/tests/11',
  ])('rejects %s', path => expect(isKnownAppPath(path)).toBe(false))
})

describe('resolveRedirect', () => {
  it('sends guests to login and remembers a valid target', () => {
    expect(resolveRedirect('/tests/11/1/practice/reading', guest)).toBe('/login?next=%2Ftests%2F11%2F1%2Fpractice%2Freading')
    expect(resolveRedirect('/tests/99/1', guest)).toBe('/login')
    expect(resolveRedirect('/login', guest)).toBeNull()
  })

  it('keeps signed-in users away from auth pages and bogus URLs', () => {
    expect(resolveRedirect('/login', member)).toBe('/Home')
    expect(resolveRedirect('/pending', member)).toBe('/Home')
    expect(resolveRedirect('/tests/42/7/practice', member)).toBe('/tests')
    expect(resolveRedirect('/whatever', member)).toBe('/Home')
    expect(resolveRedirect('/tests/12/3/practice/listening', member)).toBeNull()
  })
})

describe('safeNextPath', () => {
  it('only allows known same-site paths', () => {
    expect(safeNextPath('/tests/11/1')).toBe('/tests/11/1')
    expect(safeNextPath('//evil.com')).toBeNull()
    expect(safeNextPath('https://evil.com')).toBeNull()
    expect(safeNextPath('/nope')).toBeNull()
  })
})
