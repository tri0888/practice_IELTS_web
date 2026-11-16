/**
 * Pure route rules shared by `proxy.ts` (server, before render) and tests.
 * Goal: users cannot reach pages by hand-editing the address bar unless they
 * are allowed to (auth state, approval state, valid book/test numbers).
 */
export const AUTH_COOKIE = 'practice_hub_token'
export const ROLE_COOKIE = 'practice_hub_role'
/** sessionStorage counter used by /login to detect a proxy <-> client redirect loop. */
export const LOGIN_BOUNCE_KEY = 'practice_hub_login_bounces'

export const PUBLIC_PATHS = ['/login', '/register']
export const PENDING_PATH = '/pending'
export const HOME_PATH = '/Home'

const IELTS_BOOKS = { min: 11, max: 19 }
const IELTS_TESTS = { min: 1, max: 4 }
const IELTS_SKILLS = new Set(['listening', 'reading', 'writing', 'speaking'])
const TOEIC_YEARS = new Set([2024, 2026])
const TOEIC_TESTS = { min: 1, max: 10 }

const inRange = (raw: string, r: { min: number; max: number }) =>
  /^\d+$/.test(raw) && Number(raw) >= r.min && Number(raw) <= r.max

/** Static app sections; anything else not matching a dynamic rule is rejected. */
const STATIC_PATHS = new Set(['/Home', '/tests', '/history', '/vocabulary'])

/** Is this a page path the app really serves (with sane params)? */
export function isKnownAppPath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (STATIC_PATHS.has(path)) return true

  const parts = path.split('/').filter(Boolean)
  if (parts[0] !== 'tests') return false

  // /tests/toeic/[year]/(lc|rc)/[test]
  if (parts[1] === 'toeic') {
    return parts.length === 5
      && /^\d{4}$/.test(parts[2]) && TOEIC_YEARS.has(Number(parts[2]))
      && (parts[3] === 'lc' || parts[3] === 'rc')
      && inRange(parts[4], TOEIC_TESTS)
  }

  // /tests/[book]/[test](/practice(/[skill])?)?
  const [, book, test, practice, skill, ...rest] = parts
  if (!book || !test || rest.length) return false
  if (!inRange(book, IELTS_BOOKS) || !inRange(test, IELTS_TESTS)) return false
  if (practice === undefined) return true
  if (practice !== 'practice') return false
  return skill === undefined || IELTS_SKILLS.has(skill)
}

export type GuardSession = { authenticated: boolean; role: string | null }

/** Where to send the user, or null to let the request through. */
export function resolveRedirect(pathname: string, session: GuardSession): string | null {
  const isPublic = PUBLIC_PATHS.includes(pathname)

  if (!session.authenticated) {
    if (isPublic) return null
    const next = pathname !== PENDING_PATH && isKnownAppPath(pathname) ? `?next=${encodeURIComponent(pathname)}` : ''
    return `/login${next}`
  }

  const approved = session.role === 'approved'
  if (!approved) return pathname === PENDING_PATH ? null : PENDING_PATH
  if (isPublic || pathname === PENDING_PATH) return HOME_PATH
  if (!isKnownAppPath(pathname)) return pathname.startsWith('/tests/') ? '/tests' : HOME_PATH
  return null
}

/** Only allow same-site relative redirects coming from `?next=`. */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return null
  return isKnownAppPath(next.split('?')[0]) ? next : null
}
