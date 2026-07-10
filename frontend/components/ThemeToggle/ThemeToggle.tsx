"use client"

import { useEffect, useState } from 'react'
import './ThemeToggle.css'

type Theme = 'light' | 'dark'

function getInitialTheme(): Theme {
  if (typeof document === 'undefined') return 'light'
  const attr = document.documentElement.getAttribute('data-theme')
  return attr === 'dark' ? 'dark' : 'light'
}

export default function ThemeToggle() {
  // Sync with the value the inline head-script already applied (avoids FOUC).
  const [theme, setTheme] = useState<Theme>('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setTheme(getInitialTheme())
    setMounted(true)
  }, [])

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    try {
      localStorage.setItem('theme', next)
    } catch (e) {
      /* ignore storage errors (private mode etc.) */
    }
  }

  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-label={isDark ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}
      title={isDark ? 'Light mode' : 'Dark mode'}
      // Render a stable icon until mounted to avoid hydration mismatch.
      suppressHydrationWarning
    >
      {mounted ? (isDark ? '☀️' : '🌙') : '🌙'}
    </button>
  )
}
