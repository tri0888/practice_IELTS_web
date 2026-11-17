import type { StorageAdapter } from 'grammy'
import { COLLECTIONS, getCollection } from '../../shared/database'
import { nowIso } from '../../shared/http'
import type { SessionData } from './telegram.services'

export async function saveTelegramLink(telegramId: number, userId: string, email: string): Promise<boolean> {
  const coll = await getCollection(COLLECTIONS.telegramUsers)
  if (!coll) return false
  await coll.updateOne(
    { telegram_id: telegramId },
    { $set: { telegram_id: telegramId, user_id: userId, email, linked_at: nowIso() } },
    { upsert: true },
  )
  return true
}

export async function findUserIdByTelegram(telegramId: number): Promise<string | null> {
  const coll = await getCollection(COLLECTIONS.telegramUsers)
  const doc = coll ? await coll.findOne({ telegram_id: telegramId }) : null
  return (doc?.user_id as string) ?? null
}

export async function findFlashcardFileId(botId: number, vocab: string, voice: string): Promise<string | null> {
  const coll = await getCollection(COLLECTIONS.flashcardAudio)
  const doc = coll ? await coll.findOne({ bot_id: botId, vocab: vocab.trim().toLowerCase(), voice }) : null
  return (doc?.file_id as string) ?? null
}

export async function saveFlashcardFileId(botId: number, vocab: string, voice: string, fileId: string): Promise<boolean> {
  const coll = await getCollection(COLLECTIONS.flashcardAudio)
  if (!coll) return false
  const key = vocab.trim().toLowerCase()
  await coll.updateOne(
    { bot_id: botId, vocab: key, voice },
    { $set: { bot_id: botId, vocab: key, voice, file_id: fileId, file_type: 'voice', created_at: nowIso() } },
    { upsert: true },
  )
  return true
}

export const sessionStorage: StorageAdapter<SessionData> = {
  async read(key) {
    const coll = await getCollection(COLLECTIONS.telegramSessions)
    const doc = coll ? await coll.findOne({ key }) : null
    return (doc?.value as SessionData) ?? undefined
  },
  async write(key, value) {
    const coll = await getCollection(COLLECTIONS.telegramSessions)
    await coll?.updateOne({ key }, { $set: { key, value, updated_at: new Date() } }, { upsert: true })
  },
  async delete(key) {
    const coll = await getCollection(COLLECTIONS.telegramSessions)
    await coll?.deleteOne({ key })
  },
}
