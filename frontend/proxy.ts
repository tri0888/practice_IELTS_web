import { NextResponse, type NextRequest } from 'next/server'
import { decodeJwt, jwtVerify } from 'jose'
import { AUTH_COOKIE, ROLE_COOKIE, resolveRedirect, type GuardSession } from '@/lib/routeGuard'

/**
 * Next.js 16 Proxy (formerly Middleware): runs before every page render and
 * stops people from reaching pages by typing URLs they should not use.
 * This is a navigation guard only — the FastAPI backend still authorises
 * every /api call on its own.
 *
 * Set JWT_SECRET (same value as the backend) in the frontend environment to
 * verify the token signature; without it the token is only decoded and its
 * expiry checked.
 */
async function readSession(req: NextRequest): Promise<GuardSession> {
  const token = req.cookies.get(AUTH_COOKIE)?.value
  if (!token) return { authenticated: false, role: null }

  try {
    const secret = process.env.JWT_SECRET
    const payload = secret
      ? (await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ['HS256'] })).payload
      : decodeJwt(token)
    if (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()) {
      return { authenticated: false, role: null }
    }
    // Role cookie is refreshed from /api/auth/me, so it reflects approvals made after login.
    const role = req.cookies.get(ROLE_COOKIE)?.value || (payload.role as string | undefined) || null
    return { authenticated: true, role }
  } catch {
    return { authenticated: false, role: null }
  }
}

export async function proxy(req: NextRequest) {
  const session = await readSession(req)
  const target = resolveRedirect(req.nextUrl.pathname, session)
  if (!target) return NextResponse.next()

  const url = req.nextUrl.clone()
  const [pathname, search = ''] = target.split('?')
  url.pathname = pathname
  url.search = search ? `?${search}` : ''
  const res = NextResponse.redirect(url)
  if (!session.authenticated && req.cookies.has(AUTH_COOKIE)) {
    res.cookies.delete(AUTH_COOKIE)
    res.cookies.delete(ROLE_COOKIE)
  }
  return res
}

export const config = {
  // Pages only: skip API rewrites, Next internals and static files (anything with an extension).
  matcher: ['/((?!api/|_next/|.*\\..*).*)'],
}
