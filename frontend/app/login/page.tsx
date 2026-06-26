"use client"

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FormEvent, useEffect, useState } from 'react'
import { useAuth } from '@/components/AuthProvider/AuthProvider'
import './page.css'

export default function LoginPage() {
  const router = useRouter()
  const { login, user, isLoading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (window.location.search.includes('registered=1')) {
      setMessage('Registration successful. Please wait for approval before accessing practice tests.')
    }
  }, [])

  useEffect(() => {
    if (isLoading || !user) return
    router.replace(user.role === 'approved' ? '/Home' : '/pending')
  }, [isLoading, router, user])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const loggedInUser = await login(email, password)
      router.replace(loggedInUser.role === 'approved' ? '/Home' : '/pending')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="auth-brand">
          <div className="auth-brand-mark">Hub</div>
          <div>
            <h1>Practice Hub</h1>
            <p>Sign in to continue your IELTS and TOEIC practice.</p>
          </div>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {message && <div className="auth-message auth-message--success">{message}</div>}
          {error && <div className="auth-message auth-message--error">{error}</div>}

          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="tri@gmail.com"
              autoComplete="email"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />
          </label>

          <button className="auth-submit" type="submit" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="auth-footer">
          No account yet? <Link href="/register">Register</Link>
        </p>
      </section>
    </main>
  )
}
