"use client"

import React, { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider/AuthProvider'
import './AppLayout.css'

interface AppLayoutProps {
  children: React.ReactNode
}

function SidebarMenu() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isTestsExpanded, setIsTestsExpanded] = useState(false)
  const activeType = searchParams.get('type')

  useEffect(() => {
    if (pathname.startsWith('/tests')) {
      setIsTestsExpanded(true)
    }
  }, [pathname])

  return (
    <nav className="sidebar-menu">
      <Link
        href="/Home"
        className={`sidebar-menu-btn ${pathname === '/Home' ? 'active' : ''}`}
        style={{ textDecoration: 'none' }}
      >
        <span className="sidebar-menu-icon">DB</span>
        <span className="sidebar-menu-label">Dashboard</span>
      </Link>

      <div className="sidebar-submenu-container">
        <Link
          href="/tests"
          className={`sidebar-menu-btn ${pathname.startsWith('/tests') ? 'active' : ''}`}
          onClick={() => setIsTestsExpanded(!isTestsExpanded)}
          style={{ textDecoration: 'none' }}
        >
          <span className="sidebar-menu-icon">T</span>
          <span className="sidebar-menu-label" style={{ flexGrow: 1 }}>Practice Tests</span>
          <span className={`submenu-arrow ${isTestsExpanded ? 'expanded' : ''}`}>v</span>
        </Link>

        {isTestsExpanded && (
          <div className="sidebar-submenu">
            <Link
              href="/tests?type=ielts"
              className={`submenu-item ${pathname.startsWith('/tests') && activeType === 'ielts' ? 'active' : ''}`}
              style={{ textDecoration: 'none' }}
            >
              <span className="submenu-icon">I</span>
              <span className="submenu-label">Cambridge IELTS</span>
            </Link>
            <Link
              href="/tests?type=toeic"
              className={`submenu-item submenu-item--toeic ${pathname.startsWith('/tests') && activeType === 'toeic' ? 'active' : ''}`}
              style={{ textDecoration: 'none' }}
            >
              <span className="submenu-icon">E</span>
              <span className="submenu-label">ETS TOEIC</span>
            </Link>
          </div>
        )}
      </div>
    </nav>
  )
}

export default function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, isLoading, isAuthenticated, isApproved, logout } = useAuth()
  const isPublicPage = pathname === '/login' || pathname === '/register' || pathname === '/pending'

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated && !isPublicPage) {
      router.replace('/login')
      return
    }
    if (isAuthenticated && !isApproved && pathname !== '/pending') {
      router.replace('/pending')
      return
    }
    if (isAuthenticated && isApproved && pathname === '/pending') {
      router.replace('/Home')
    }
  }, [isApproved, isAuthenticated, isLoading, isPublicPage, pathname, router])

  if (isPublicPage) {
    return <>{children}</>
  }

  if (isLoading || !isAuthenticated || !isApproved) {
    return (
      <div className="auth-loading-screen">
        <div className="auth-loading-card">
          <div className="auth-loading-mark">Hub</div>
          <div>Checking access...</div>
        </div>
      </div>
    )
  }

  const isPracticePage = pathname.includes('/practice') || pathname.includes('/ets/')
  const showSidebar = !isPracticePage && (pathname === '/Home' || pathname.startsWith('/tests') || pathname.startsWith('/history'))

  return (
    <div className="app-layout-wrapper">
      <header className="ielts-header">
        <Link href="/Home" style={{ color: 'inherit', textDecoration: 'none' }}>
          <div className="ielts-header__logo">
            <div className="ielts-header__logo-icon">Hub</div>
            <span>Practice Hub</span>
          </div>
        </Link>
        <nav className="ielts-header__nav">
          <Link href="/history">History</Link>
          <div className="header-user-chip" title={user?.email || ''}>
            <span>{user?.name || user?.email}</span>
            <button type="button" onClick={logout}>Logout</button>
          </div>
        </nav>
      </header>

      <div className="app-main-body">
        {showSidebar ? (
          <div className="homepage-container">
            <aside className="homepage-sidebar">
              <div className="sidebar-logo">
                <span className="sidebar-logo-icon">PH</span>
                <span className="sidebar-logo-text">Practice Hub</span>
              </div>
              <Suspense fallback={null}>
                <SidebarMenu />
              </Suspense>
            </aside>

            <main className={`homepage-main-content ${pathname.startsWith('/history') ? 'history-mode' : ''}`}>
              {children}
            </main>
          </div>
        ) : (
          <main className="full-width-content">
            {children}
          </main>
        )}
      </div>
    </div>
  )
}
