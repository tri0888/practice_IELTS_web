"use client"

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const TOKEN_KEY = 'practice_hub_token'

export type AuthUser = {
  id: string
  email: string
  name: string
  role: 'approved' | 'pending' | string
}

type AuthContextValue = {
  user: AuthUser | null
  isLoading: boolean
  isAuthenticated: boolean
  isApproved: boolean
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
    const url = new URL(raw, window.location.origin)
    const apiBase = process.env.NEXT_PUBLIC_API_URL
    const isLocalApi = url.origin === window.location.origin && url.pathname.startsWith('/api/')
    const isBackendApi = !!apiBase && url.href.startsWith(apiBase)
    return isLocalApi || isBackendApi
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

  const refreshUser = useCallback(async () => {
    const token = getStoredToken()
    if (!token) {
      setUser(null)
      setIsLoading(false)
      return
    }

    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        window.localStorage.removeItem(TOKEN_KEY)
        setUser(null)
        return
      }
      const data = await res.json()
      setUser(data.user)
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
    window.localStorage.setItem(TOKEN_KEY, data.token)
    setUser(data.user)
    return data.user as AuthUser
  }, [])

  const logout = useCallback(() => {
    window.localStorage.removeItem(TOKEN_KEY)
    setUser(null)
    window.location.href = '/login'
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isLoading,
    isAuthenticated: !!user,
    isApproved: user?.role === 'approved',
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
