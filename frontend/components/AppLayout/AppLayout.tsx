"use client"
import React, { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
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
        <span className="sidebar-menu-icon">📊</span>
        <span className="sidebar-menu-label">Dashboard</span>
      </Link>

      {/* Collapsible Tests parent item */}
      <div className="sidebar-submenu-container">
        <Link 
          href="/tests"
          className={`sidebar-menu-btn ${pathname.startsWith('/tests') ? 'active' : ''}`}
          onClick={() => setIsTestsExpanded(!isTestsExpanded)}
          style={{ textDecoration: 'none' }}
        >
          <span className="sidebar-menu-icon">📝</span>
          <span className="sidebar-menu-label" style={{ flexGrow: 1 }}>Practice Tests</span>
          <span className={`submenu-arrow ${isTestsExpanded ? 'expanded' : ''}`}>▼</span>
        </Link>

        {/* Sub-menu items */}
        {isTestsExpanded && (
          <div className="sidebar-submenu">
            <Link 
              href="/tests?type=ielts" 
              className={`submenu-item ${pathname.startsWith('/tests') && activeType === 'ielts' ? 'active' : ''}`}
              style={{ textDecoration: 'none' }}
            >
              <span className="submenu-icon">🎯</span>
              <span className="submenu-label">Cambridge IELTS</span>
            </Link>
            <Link 
              href="/tests?type=toeic" 
              className={`submenu-item submenu-item--toeic ${pathname.startsWith('/tests') && activeType === 'toeic' ? 'active' : ''}`}
              style={{ textDecoration: 'none' }}
            >
              <span className="submenu-icon">⏱️</span>
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

  // Determine if sidebar should be shown
  const isPracticePage = pathname.includes('/practice') || pathname.includes('/ets/')
  const showSidebar = !isPracticePage && (pathname === '/Home' || pathname.startsWith('/tests') || pathname.startsWith('/history'))

  return (
    <div className="app-layout-wrapper">
      {/* Header Navbar */}
      <header className="ielts-header">
        <Link href="/Home" style={{ color: 'inherit', textDecoration: 'none' }}>
          <div className="ielts-header__logo">
            <div className="ielts-header__logo-icon">Hub</div>
            <span>Practice Hub</span>
          </div>
        </Link>
        <nav className="ielts-header__nav">
          <Link href="/history">📜 History</Link>
        </nav>
      </header>

      {/* Main Area */}
      <div className="app-main-body">
        {showSidebar ? (
          <div className="homepage-container">
            {/* Sidebar */}
            <aside className="homepage-sidebar">
              <div className="sidebar-logo">
                <span className="sidebar-logo-icon">🎓</span>
                <span className="sidebar-logo-text">Practice Hub</span>
              </div>
              <Suspense fallback={null}>
                <SidebarMenu />
              </Suspense>
            </aside>

            {/* Main Content */}
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
