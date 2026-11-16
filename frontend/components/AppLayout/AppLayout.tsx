"use client"

import React, { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Avatar, Button, Dropdown, Menu, Spin, Tooltip } from 'antd'
import type { MenuProps } from 'antd'
import DashboardRounded from '@mui/icons-material/DashboardRounded'
import TranslateRounded from '@mui/icons-material/TranslateRounded'
import AssignmentRounded from '@mui/icons-material/AssignmentRounded'
import HistoryRounded from '@mui/icons-material/HistoryRounded'
import LogoutRounded from '@mui/icons-material/LogoutRounded'
import SchoolRounded from '@mui/icons-material/SchoolRounded'
import WorkspacePremiumRounded from '@mui/icons-material/WorkspacePremiumRounded'
import { useAuth } from '@/components/AuthProvider/AuthProvider'
import ThemeToggle from '@/components/ThemeToggle/ThemeToggle'
import { LOGIN_BOUNCE_KEY } from '@/lib/routeGuard'
import './AppLayout.css'

interface AppLayoutProps {
  children: React.ReactNode
}

const PUBLIC_PAGES = ['/login', '/register', '/pending']

function SidebarMenu() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeType = searchParams.get('type')
  const [openKeys, setOpenKeys] = useState<string[]>([])

  useEffect(() => {
    if (pathname.startsWith('/tests')) setOpenKeys(['tests'])
  }, [pathname])

  const selectedKey = useMemo(() => {
    if (pathname === '/Home') return 'home'
    if (pathname.startsWith('/vocabulary')) return 'vocabulary'
    if (pathname.startsWith('/tests')) return activeType === 'ielts' || activeType === 'toeic' ? `tests-${activeType}` : 'tests'
    return ''
  }, [activeType, pathname])

  const items: MenuProps['items'] = [
    { key: 'home', icon: <DashboardRounded fontSize="small" />, label: <Link href="/Home">Dashboard</Link> },
    { key: 'vocabulary', icon: <TranslateRounded fontSize="small" />, label: <Link href="/vocabulary">Vocabulary</Link> },
    {
      key: 'tests',
      icon: <AssignmentRounded fontSize="small" />,
      label: <Link href="/tests">Practice Tests</Link>,
      children: [
        { key: 'tests-ielts', icon: <SchoolRounded fontSize="small" />, label: <Link href="/tests?type=ielts">Cambridge IELTS</Link> },
        { key: 'tests-toeic', icon: <WorkspacePremiumRounded fontSize="small" />, label: <Link href="/tests?type=toeic">ETS TOEIC</Link> },
      ],
    },
  ]

  return (
    <Menu
      className="sidebar-menu"
      mode="inline"
      items={items}
      selectedKeys={[selectedKey]}
      openKeys={openKeys}
      onOpenChange={setOpenKeys}
    />
  )
}

function LoadingScreen() {
  return (
    <div className="auth-loading-screen">
      <div className="auth-loading-card">
        <div className="auth-loading-mark">Hub</div>
        <Spin size="small" />
        <div>Checking access...</div>
      </div>
    </div>
  )
}

export default function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, isLoading, isAuthenticated, isApproved, logout } = useAuth()
  const isPublicPage = PUBLIC_PAGES.includes(pathname)

  // proxy.ts guards navigation server-side; this keeps the client in sync
  // when the session changes without a full navigation (e.g. token expiry).
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
      return
    }
    // Reached an app page: the proxy accepted our cookies, reset the loop detector.
    if (isAuthenticated && !isPublicPage) {
      try { sessionStorage.removeItem(LOGIN_BOUNCE_KEY) } catch { /* ignore */ }
    }
  }, [isApproved, isAuthenticated, isLoading, isPublicPage, pathname, router])

  if (isPublicPage) {
    return <>{children}</>
  }

  if (isLoading || !isAuthenticated || !isApproved) {
    return <LoadingScreen />
  }

  const isPracticePage = pathname.includes('/practice') || pathname.includes('/toeic/')
  const showSidebar = !isPracticePage && (pathname === '/Home' || pathname.startsWith('/tests') || pathname.startsWith('/history') || pathname.startsWith('/vocabulary'))
  const displayName = user?.name || user?.email || ''

  const userMenu: MenuProps = {
    items: [
      { key: 'email', label: user?.email, disabled: true },
      { type: 'divider' },
      { key: 'logout', icon: <LogoutRounded fontSize="small" />, label: 'Logout', danger: true },
    ],
    onClick: ({ key }) => key === 'logout' && logout(),
  }

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
          <Tooltip title="History">
            <Link href="/history" className="header-icon-link" aria-label="History">
              <HistoryRounded fontSize="small" />
              <span>History</span>
            </Link>
          </Tooltip>
          <ThemeToggle />
          <Dropdown menu={userMenu} trigger={['click']} placement="bottomRight">
            <Button type="text" className="header-user-chip" title={user?.email || ''}>
              <Avatar size={26} className="header-user-avatar">{displayName.charAt(0).toUpperCase()}</Avatar>
              <span>{displayName}</span>
            </Button>
          </Dropdown>
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
