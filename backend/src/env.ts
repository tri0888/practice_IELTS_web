import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Load `.env.local` then `.env` from the backend folder for local runs (dev
 * server, scripts). Existing variables win, so values set by the platform
 * (e.g. Vercel project env) are never overridden. Requires Node.js 20.12+.
 */
export function loadLocalEnv(dir = process.cwd()) {
  for (const name of ['.env.local', '.env']) {
    const file = resolve(dir, name)
    if (existsSync(file)) process.loadEnvFile(file)
  }
}
