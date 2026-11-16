"use client"

import { Button, Tooltip } from 'antd'
import DarkModeRounded from '@mui/icons-material/DarkModeRounded'
import LightModeRounded from '@mui/icons-material/LightModeRounded'
import { useThemeMode } from '@/components/Providers/UIProvider'
import './ThemeToggle.css'

export default function ThemeToggle() {
  const { mode, toggleMode } = useThemeMode()
  const isDark = mode === 'dark'

  return (
    <Tooltip title={isDark ? 'Light mode' : 'Dark mode'}>
      <Button
        className="theme-toggle"
        type="text"
        shape="circle"
        onClick={toggleMode}
        aria-label={isDark ? 'Chuyển sang chế độ sáng' : 'Chuyển sang chế độ tối'}
        icon={isDark ? <LightModeRounded fontSize="small" /> : <DarkModeRounded fontSize="small" />}
      />
    </Tooltip>
  )
}
