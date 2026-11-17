import { MongoClient, type Collection, type Db, type Document } from 'mongodb'

export const COLLECTIONS = {
  users: 'users',
  histories: 'histories',
  r2Keys: 'r2_keys',
  ieltsAudio: 'ielts_audio_assets',
  ieltsLayouts: 'ielts_layouts',
  ieltsAnswers: 'ielts_answers',
  toeicAudio: 'toeic_audio_assets',
  toeicLayouts: 'toeic_layouts',
  toeicAnswers: 'toeic_answers',
  vocabulary: 'vocabulary',
  vocabularyProgress: 'vocabulary_progress',
  telegramUsers: 'telegram_users',
  telegramSessions: 'telegram_sessions',
  flashcardAudio: 'flashcard_audio',
} as const

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS]

const RETRY_AFTER_FAILURE_MS = 30_000

export function formatMongoUri(uri: string | undefined, password?: string, dbName?: string): string | null {
  if (!uri) return null
  let out = uri
  const match = (u: string) => u.match(/^(mongodb(?:\+srv)?:\/\/)(.*)$/)

  if (password) {
    const m = match(out)
    if (m) {
      const [, scheme, rest] = m
      const at = rest.indexOf('@')
      if (at >= 0) {
        const username = rest.slice(0, at).split(':', 1)[0]
        out = `${scheme}${username}:${password}@${rest.slice(at + 1)}`
      }
    }
  }

  if (dbName) {
    const m = match(out)
    if (m) {
      const [, scheme, rest] = m
      const q = rest.indexOf('?')
      const pathPart = q >= 0 ? rest.slice(0, q) : rest
      const query = q >= 0 ? rest.slice(q + 1) : ''
      const slash = pathPart.indexOf('/')
      const host = slash >= 0 ? pathPart.slice(0, slash) : pathPart
      out = `${scheme}${host}/${dbName}${query ? `?${query}` : ''}`
    }
  }
  return out
}

type Cache = { db: Promise<Db | null> | null; failedAt: number }
const g = globalThis as typeof globalThis & { __practiceHubMongo?: Cache }
const cache: Cache = (g.__practiceHubMongo ??= { db: null, failedAt: 0 })

async function connect(): Promise<Db | null> {
  const uri = formatMongoUri(process.env.MONGODB_URI, process.env.DB_PASSWORD, process.env.DB_NAME)
    ?? 'mongodb://127.0.0.1:27017'
  const dbName = process.env.DB_NAME || 'ielts_platform_dev'
  try {
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 2000 })
    await client.connect()
    return client.db(dbName)
  } catch (err) {
    console.error('MongoDB unavailable:', (err as Error).message)
    return null
  }
}

export async function getDb(): Promise<Db | null> {
  if (cache.db) {
    const db = await cache.db
    if (db) return db
    if (Date.now() - cache.failedAt < RETRY_AFTER_FAILURE_MS) return null
  }
  cache.db = connect()
  const db = await cache.db
  if (!db) cache.failedAt = Date.now()
  return db
}

export async function getCollection<T extends Document = Document>(name: CollectionName): Promise<Collection<T> | null> {
  const db = await getDb()
  return db ? db.collection<T>(name) : null
}
