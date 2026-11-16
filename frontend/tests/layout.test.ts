/**
 * Regression guard: the root layout must wrap the app in AntdRegistry + UIProvider.
 * Without UIProvider, useThemeMode() falls back to its default context, so the
 * dark/light toggle silently does nothing and Ant Design / MUI ignore the theme.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const layout = readFileSync(resolve(__dirname, '../app/layout.tsx'), 'utf8')
const pos = (tag: string) => layout.indexOf(tag)

describe('root layout providers', () => {
  it('imports the Ant Design registry and the UI provider', () => {
    expect(layout).toMatch(/from '@ant-design\/nextjs-registry'/)
    expect(layout).toMatch(/from '@\/components\/Providers\/UIProvider'/)
  })

  it('nests AntdRegistry > UIProvider > AuthProvider > AppLayout', () => {
    const order = ['<AntdRegistry>', '<UIProvider>', '<AuthProvider>', '<AppLayout>']
    order.forEach(tag => expect(pos(tag), `${tag} missing`).toBeGreaterThan(-1))
    expect(order.map(pos)).toEqual([...order.map(pos)].sort((a, b) => a - b))
    expect(pos('</AppLayout>')).toBeLessThan(pos('</AuthProvider>'))
    expect(pos('</AuthProvider>')).toBeLessThan(pos('</UIProvider>'))
    expect(pos('</UIProvider>')).toBeLessThan(pos('</AntdRegistry>'))
  })

  it('keeps the no-flash theme script that sets data-theme before hydration', () => {
    expect(layout).toMatch(/setAttribute\('data-theme', theme\)/)
  })
})
