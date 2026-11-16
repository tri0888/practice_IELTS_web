/** Shared helpers for CLI scripts; loads backend/.env(.local) like the dev server. */
import { loadLocalEnv } from '../src/env'
import { getDb } from '../src/db'

loadLocalEnv()

export async function requireDb() {
  const db = await getDb()
  if (!db) {
    console.error('Error: MongoDB is not available (check MONGODB_URI / DB_PASSWORD / DB_NAME).')
    process.exit(1)
  }
  return db
}

export function flag(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

export function option(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}
