"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider/AuthProvider'
import '../login/page.css'
import './page.css'

export default function PendingPage() {
  const router = useRouter()
  const { user, isLoading, logout } = useAuth()

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login')
    }
  }, [isLoading, router, user])

  if (isLoading || !user) {
    return (
      <main className="auth-shell pending-shell">
        <section className="auth-panel pending-panel">
          <div className="pending-icon" aria-hidden="true">...</div>
          <h1>Checking account</h1>
        </section>
      </main>
    )
  }

  return (
    <main className="auth-shell pending-shell">
      <section className="auth-panel pending-panel">
        <div className="pending-icon" aria-hidden="true">...</div>
        <h1>Account pending approval</h1>
        <p>
          {user?.name ? `${user.name}, your account` : 'Your account'} has been created, but it is not approved yet.
          Please contact the site owner to enable access to practice tests and history.
        </p>
        <button className="auth-submit pending-logout" type="button" onClick={logout}>
          Sign Out
        </button>
      </section>
    </main>
  )
}
