import type { Context, SessionFlavor, StorageAdapter } from 'grammy'
import { COLLECTIONS, getCollection } from '../../db'

type Deck = { vocab: string; pronunciation: string; POS: string; definition: string; status?: string }[]

export type FlashcardState = 'SELECT_FOCUS' | 'SELECT_POS' | 'SELECT_SIZE' | 'PLAY_CARDS'
export type GamesState = 'SELECT_GAME' | 'SELECT_SCOPE' | 'SELECT_POS' | 'SELECT_SIZE' | 'PLAY_TRANSLATION' | 'PLAY_MATCHING'

export type MatchTile = { vocab: string; text: string; type: 'word' | 'def'; match_id: number; matched: boolean }

/**
 * Per chat+user conversation data (the old python-telegram-bot `user_data` plus
 * each ConversationHandler's current state). Persisted in MongoDB because a
 * serverless instance does not survive between Telegram updates.
 */
export type SessionData = {
  user_id?: string
  flashcard?: {
    state: FlashcardState
    focus?: 'random' | 'studied'
    pos?: string
    size?: number
    deck?: Deck
    index?: number
    voiceMsgs?: number[]
  }
  games?: {
    state: GamesState
    type?: 'translation' | 'matching'
    scope?: 'random' | 'studied'
    pos?: string
    size?: number
    deck?: Deck
    index?: number
    correct?: number
    wrong?: number
    hintRevealed?: boolean
    direction?: 'en' | 'vi'
    prevFeedback?: string
    messageId?: number
    tiles?: MatchTile[]
    selected?: number | null
    startedAt?: number
    matchCorrect?: number
    matchMsg?: string
  }
}

export type BotContext = Context & SessionFlavor<SessionData>

/** grammY session storage backed by the `telegram_sessions` collection. */
export const mongoSessionStorage: StorageAdapter<SessionData> = {
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

export const sessionKey = (ctx: Context) =>
  ctx.chat && ctx.from ? `${ctx.chat.id}:${ctx.from.id}` : undefined
