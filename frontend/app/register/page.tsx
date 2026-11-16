"use client"

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Alert, Button, Form, Input } from 'antd'
import PersonRounded from '@mui/icons-material/PersonRounded'
import EmailRounded from '@mui/icons-material/EmailRounded'
import LockRounded from '@mui/icons-material/LockRounded'
import RHFField from '@/components/form/RHFField'
import '../login/page.css'

type RegisterValues = { name: string; email: string; password: string; confirmPassword: string }

export default function RegisterPage() {
  const router = useRouter()
  const [error, setError] = useState('')
  const { control, handleSubmit, getValues, formState: { isSubmitting } } = useForm<RegisterValues>({
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  })

  const onSubmit = async ({ name, email, password }: RegisterValues) => {
    setError('')
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.detail || 'Registration failed')
      }
      router.replace('/login?registered=1')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="auth-brand">
          <div className="auth-brand-mark">Hub</div>
          <div>
            <h1>Create Account</h1>
            <p>New accounts are created as pending until manually approved.</p>
          </div>
        </div>

        <Form layout="vertical" className="auth-form" onFinish={handleSubmit(onSubmit)} requiredMark={false} component="form">
          {error && <Alert type="error" showIcon message={error} />}

          <RHFField control={control} name="name" label="Name" rules={{ required: 'Please enter your name.' }}>
            <Input size="large" placeholder="Your name" autoComplete="name" prefix={<PersonRounded fontSize="small" />} />
          </RHFField>

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

          <RHFField
            control={control}
            name="password"
            label="Password"
            rules={{
              required: 'Please enter a password.',
              minLength: { value: 6, message: 'Password must be at least 6 characters.' },
            }}
          >
            <Input.Password size="large" placeholder="At least 6 characters" autoComplete="new-password" prefix={<LockRounded fontSize="small" />} />
          </RHFField>

          <RHFField
            control={control}
            name="confirmPassword"
            label="Confirm Password"
            rules={{
              required: 'Please confirm your password.',
              validate: value => value === getValues('password') || 'Passwords do not match.',
            }}
          >
            <Input.Password size="large" placeholder="Repeat password" autoComplete="new-password" prefix={<LockRounded fontSize="small" />} />
          </RHFField>

          <Button className="auth-submit" type="primary" htmlType="submit" size="large" block loading={isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Register'}
          </Button>
        </Form>

        <p className="auth-footer">
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </section>
    </main>
  )
}
