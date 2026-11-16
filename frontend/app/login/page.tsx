"use client"

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Alert, Button, Form, Input } from 'antd'
import EmailRounded from '@mui/icons-material/EmailRounded'
import LockRounded from '@mui/icons-material/LockRounded'
import { useAuth } from '@/components/AuthProvider/AuthProvider'
import RHFField from '@/components/form/RHFField'
import { LOGIN_BOUNCE_KEY as BOUNCE_KEY, safeNextPath } from '@/lib/routeGuard'
import './page.css'

type LoginValues = { email: string; password: string }

const MAX_BOUNCES = 2

export default function LoginPage() {
  const { login, logout, user, isLoading } = useAuth()
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const { control, handleSubmit, formState: { isSubmitting } } = useForm<LoginValues>({
    defaultValues: { email: '', password: '' },
  })

  const destination = (role: string) => {
    if (role !== 'approved') return '/pending'
    const next = new URLSearchParams(window.location.search).get('next')
    return safeNextPath(next) || '/Home'
  }

  useEffect(() => {
    if (window.location.search.includes('registered=1')) {
      setMessage('Registration successful. Please wait for approval before accessing practice tests.')
    }
  }, [])

  // Signed in (after submit, or an existing session): leave /login.
  // A full navigation makes proxy.ts re-read the freshly written cookies.
  // If the proxy keeps bouncing us back here (?next=...), the cookie is not
  // accepted (e.g. JWT_SECRET mismatch) — sign out instead of looping.
  useEffect(() => {
    if (isLoading || !user) return
    const bouncedByProxy = new URLSearchParams(window.location.search).has('next')
    try {
      const bounces = Number(sessionStorage.getItem(BOUNCE_KEY) || 0)
      if (bouncedByProxy && bounces >= MAX_BOUNCES) {
        sessionStorage.removeItem(BOUNCE_KEY)
        logout()
        return
      }
      sessionStorage.setItem(BOUNCE_KEY, String(bouncedByProxy ? bounces + 1 : 0))
    } catch {
      /* sessionStorage unavailable: fall through */
    }
    window.location.replace(destination(user.role))
  }, [isLoading, user, logout])

  const onSubmit = async ({ email, password }: LoginValues) => {
    setError('')
    try {
      await login(email.trim(), password) // the effect above navigates once `user` is set
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in')
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

        <Form layout="vertical" className="auth-form" onFinish={handleSubmit(onSubmit)} requiredMark={false} component="form">
          {message && <Alert type="success" showIcon message={message} />}
          {error && <Alert type="error" showIcon message={error} />}

          <RHFField
            control={control}
            name="email"
            label="Email"
            rules={{
              required: 'Please enter your email.',
              pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Please enter a valid email address.' },
            }}
          >
            <Input size="large" type="email" placeholder="you@example.com" autoComplete="email" prefix={<EmailRounded fontSize="small" />} />
          </RHFField>

          <RHFField control={control} name="password" label="Password" rules={{ required: 'Please enter your password.' }}>
            <Input.Password size="large" placeholder="Enter your password" autoComplete="current-password" prefix={<LockRounded fontSize="small" />} />
          </RHFField>

          <Button className="auth-submit" type="primary" htmlType="submit" size="large" block loading={isSubmitting}>
            {isSubmitting ? 'Signing in...' : 'Sign In'}
          </Button>
        </Form>

        <p className="auth-footer">
          No account yet? <Link href="/register">Register</Link>
        </p>
      </section>
    </main>
  )
}
