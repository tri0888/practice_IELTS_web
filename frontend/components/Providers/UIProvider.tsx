"use client"

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { App as AntdApp, ConfigProvider, theme as antdTheme } from 'antd'
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter'
import { ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material/styles'

/**
 * UI stack: Ant Design is the primary component library, MUI is secondary
 * (icons + a few components). Both follow the same light/dark mode, which is
 * stored in <html data-theme> + localStorage('theme') by the inline head script.
 */
export type ThemeMode = 'light' | 'dark'

type ThemeModeContextValue = { mode: ThemeMode; toggleMode: () => void }

const ThemeModeContext = createContext<ThemeModeContextValue>({ mode: 'light', toggleMode: () => {} })

export const useThemeMode = () => useContext(ThemeModeContext)

const BRAND = { light: '#c8102e', dark: '#ef4256' }

function readDomMode(): ThemeMode {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
}

export default function UIProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('light')

  useEffect(() => setMode(readDomMode()), [])

  const toggleMode = useCallback(() => {
    setMode(prev => {
      const next: ThemeMode = prev === 'dark' ? 'light' : 'dark'
      document.documentElement.setAttribute('data-theme', next)
      try {
        localStorage.setItem('theme', next)
      } catch {
        /* private mode etc. */
      }
      return next
    })
  }, [])

  const muiTheme = useMemo(() => createTheme({
    palette: { mode, primary: { main: BRAND[mode] } },
    typography: { fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
    shape: { borderRadius: 10 },
  }), [mode])

  const antdConfig = useMemo(() => ({
    algorithm: mode === 'dark' ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      colorPrimary: BRAND[mode],
      borderRadius: 10,
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    },
  }), [mode])

  const ctx = useMemo(() => ({ mode, toggleMode }), [mode, toggleMode])

  return (
    <AppRouterCacheProvider options={{ key: 'mui' }}>
      <MuiThemeProvider theme={muiTheme}>
        <ConfigProvider theme={antdConfig}>
          <AntdApp component={false}>
            <ThemeModeContext.Provider value={ctx}>{children}</ThemeModeContext.Provider>
          </AntdApp>
        </ConfigProvider>
      </MuiThemeProvider>
    </AppRouterCacheProvider>
  )
}
