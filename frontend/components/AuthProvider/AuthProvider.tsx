"use client"

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { AUTH_COOKIE } from '@/lib/routeGuard'

const TOKEN_KEY = 'practice_hub_token'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30

/** Mirror auth state into cookies so proxy.ts can guard routes before render. */
function writeCookie(name: string, value: string | null) {
  if (typeof document === 'undefined') return
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = value
    ? `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax${secure}`
    : `${name}=; Path=/; Max-Age=0; SameSite=Lax${secure}`
}

function clearAuthCookies() {
  writeCookie(AUTH_COOKIE, null)
}

function persistSession(token: string | null) {
  if (token) window.localStorage.setItem(TOKEN_KEY, token)
  else window.localStorage.removeItem(TOKEN_KEY)
  writeCookie(AUTH_COOKIE, token)
}

export type AuthUser = {
  id: string
  email: string
  name: string
}

type AuthContextValue = {
  user: AuthUser | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<AuthUser>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function getStoredToken() {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(TOKEN_KEY)
}

export function getAuthUrl(url: string) {
  const token = getStoredToken()
  if (!token) return url

  try {
    const parsed = new URL(url, window.location.origin)
    if (!parsed.pathname.startsWith('/api/')) return url
    parsed.searchParams.set('token', token)
    return parsed.pathname + parsed.search + parsed.hash
  } catch {
    return url
  }
}

function shouldAttachAuth(input: RequestInfo | URL) {
  const raw = input instanceof Request ? input.url : input.toString()
  try {
    // The API is served by this same Next.js app, so only same-origin /api/* calls get the token.
    const url = new URL(raw, window.location.origin)
    return url.origin === window.location.origin && url.pathname.startsWith('/api/')
  } catch {
    return raw.startsWith('/api/')
  }
}

function patchFetchOnce() {
  if (typeof window === 'undefined') return
  const w = window as typeof window & { __practiceHubAuthFetchPatched?: boolean; __practiceHubOriginalFetch?: typeof fetch }
  if (w.__practiceHubAuthFetchPatched) return

  const originalFetch = window.fetch.bind(window)
  w.__practiceHubOriginalFetch = originalFetch
  w.__practiceHubAuthFetchPatched = true

  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const token = getStoredToken()
    if (!token || !shouldAttachAuth(input)) {
      return originalFetch(input, init)
    }

    const sourceHeaders = input instanceof Request ? input.headers : undefined
    const headers = new Headers(sourceHeaders)
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value))
    }
    if (!headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`)
    }

    return originalFetch(input, { ...init, headers })
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    patchFetchOnce()
  }, [])

  // Invariant: the auth cookies (read by proxy.ts) always mirror the client's
  // view of the session. If they disagree, proxy and client redirect each
  // other forever (/Home <-> /login).
  const refreshUser = useCallback(async () => {
    const token = getStoredToken()
    if (!token) {
      clearAuthCookies() // stale cookie without a client session
      setUser(null)
      setIsLoading(false)
      return
    }

    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        persistSession(null)
        setUser(null)
        return
      }
      const data = await res.json()
      persistSession(token)
      setUser(data.user)
    } catch (err) {
      // Backend unreachable: keep the stored token for the next reload, but
      // drop the cookies so the proxy agrees we are signed out for now.
      console.error('Unable to verify session', err)
      clearAuthCookies()
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshUser()
  }, [refreshUser])

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(data.detail || 'Unable to sign in')
    }
    persistSession(data.token)
    setUser(data.user)
    return data.user as AuthUser
  }, [])

  const logout = useCallback(() => {
    persistSession(null)
    setUser(null)
    window.location.href = '/login'
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    refreshUser,
  }), [user, isLoading, login, logout, refreshUser])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider')
  }
  return ctx
}
