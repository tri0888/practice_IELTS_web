"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Space, Spin } from 'antd'
import HourglassTopRounded from '@mui/icons-material/HourglassTopRounded'
import { useAuth } from '@/components/AuthProvider/AuthProvider'
import '../login/page.css'
import './page.css'

export default function PendingPage() {
  const router = useRouter()
  const { user, isLoading, logout, refreshUser } = useAuth()
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login')
    }
  }, [isLoading, router, user])

  const checkAgain = async () => {
    setChecking(true)
    try {
      await refreshUser()
    } finally {
      setChecking(false)
    }
  }

  if (isLoading || !user) {
    return (
      <main className="auth-shell pending-shell">
        <section className="auth-panel pending-panel">
          <div className="pending-icon" aria-hidden="true"><Spin /></div>
          <h1>Checking account</h1>
        </section>
      </main>
    )
  }

  return (
    <main className="auth-shell pending-shell">
      <section className="auth-panel pending-panel">
        <div className="pending-icon" aria-hidden="true"><HourglassTopRounded /></div>
        <h1>Account pending approval</h1>
        <p>
          {user?.name ? `${user.name}, your account` : 'Your account'} has been created, but it is not approved yet.
          Please contact the site owner to enable access to practice tests and history.
        </p>
        <Space direction="vertical" className="pending-logout" size={10}>
          <Button size="large" block loading={checking} onClick={checkAgain}>
            Check approval status
          </Button>
          <Button className="auth-submit" type="primary" size="large" block onClick={logout}>
            Sign Out
          </Button>
        </Space>
      </section>
    </main>
  )
}
