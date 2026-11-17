import type { Context, SessionFlavor } from 'grammy'
import type { InlineKeyboardMarkup } from 'grammy/types'
import { HttpError } from '../../shared/http'
import { checkCredentials } from '../auth/auth.services'
import * as repo from './telegram.repositories'

export const FLASHCARD_TTS_VOICE = () => process.env.FLASHCARD_TTS_VOICE || 'en-GB-SoniaNeural'

export const telegramWebhookUrl = () => {
  const base = (process.env.TELEGRAM_WEBHOOK_URL ?? '').trim().replace(/\/+$/, '')
  return base ? `${base}/api/telegram/webhook` : null
}

type Deck = { vocab: string; pronunciation: string; POS: string; definition: string; status?: string }[]

export type FlashcardState = 'SELECT_FOCUS' | 'SELECT_POS' | 'SELECT_SIZE' | 'PLAY_CARDS'
export type GamesState = 'SELECT_GAME' | 'SELECT_SCOPE' | 'SELECT_POS' | 'SELECT_SIZE' | 'PLAY_TRANSLATION' | 'PLAY_MATCHING'

export type MatchTile = { vocab: string; text: string; type: 'word' | 'def'; match_id: number; matched: boolean }

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

export const sessionKey = (ctx: Context) =>
  ctx.chat && ctx.from ? `${ctx.chat.id}:${ctx.from.id}` : undefined

export const keyboard = (rows: [string, string][][]): InlineKeyboardMarkup => ({
  inline_keyboard: rows.map(row => row.map(([text, callback_data]) => ({ text, callback_data }))),
})

export function grid(buttons: [string, string][], perRow: number): [string, string][][] {
  const rows: [string, string][][] = []
  for (let i = 0; i < buttons.length; i += perRow) rows.push(buttons.slice(i, i + perRow))
  return rows
}

export const MD = { parse_mode: 'Markdown' as const }

export const NOT_LINKED =
  '⚠️ Bạn chưa liên kết tài khoản web.\n' +
  'Vui lòng dùng lệnh: /link <email> <password> để liên kết trước.'

type LinkResult = { success: true; name: string } | { success: false; message: string }

export async function linkTelegramAccount(telegramId: number, emailRaw: string, password: string): Promise<LinkResult> {
  const email = emailRaw.trim().toLowerCase()
  let result: Awaited<ReturnType<typeof checkCredentials>>
  try {
    result = await checkCredentials(email, password)
  } catch (err) {
    if (err instanceof HttpError) return { success: false, message: 'Database is not available.' }
    throw err
  }
  if ('reason' in result) {
    return { success: false, message: result.reason === 'not_found' ? 'Email không tồn tại trên hệ thống.' : 'Mật khẩu không chính xác.' }
  }
  const { user } = result
  if (user.role !== 'approved') return { success: false, message: 'Tài khoản của bạn đang chờ phê duyệt, chưa được phép sử dụng.' }

  if (!(await repo.saveTelegramLink(telegramId, user.id, email))) {
    return { success: false, message: 'Telegram users collection is not available.' }
  }
  return { success: true, name: user.name || 'User' }
}

export const getUserIdByTelegram = (telegramId: number) => repo.findUserIdByTelegram(telegramId)

export const getFlashcardFileId = (botId: number, vocab: string) =>
  repo.findFlashcardFileId(botId, vocab, FLASHCARD_TTS_VOICE())

export function checkTranslationAnswer(input: string, correct: string, direction: 'en' | 'vi'): boolean {
  const clean = input.trim().toLowerCase()
  if (direction === 'en') {
    const synonyms = correct.split(/[,;]/).map(s => s.trim().toLowerCase()).filter(Boolean)
    return synonyms.includes(clean) || clean === correct.trim().toLowerCase()
  }
  return clean === correct.trim().toLowerCase()
}

export function formatClue(word: { vocab?: string; pronunciation?: string; POS?: string }, direction: 'en' | 'vi'): string {
  const pron = word.pronunciation ?? ''
  const pos = word.POS ?? ''
  if (direction === 'en') return `📖 Pronunciation: ${pron}\n🔤 Type: (${pos})`
  const vocab = word.vocab ?? ''
  if (!vocab) return 'No clue available.'
  return `🔍 Hint: ${vocab[0]}${'_'.repeat(vocab.length - 1)} (${vocab.length} letters)\n📖 Pronunciation: ${pron}\n🔤 Type: (${pos})`
}

export function shuffle<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[items[i], items[j]] = [items[j], items[i]]
  }
  return items
}

export function buildMatchTiles(words: { vocab: string; POS: string; definition: string }[]): MatchTile[] {
  const tiles: MatchTile[] = words.flatMap((w, i) => [
    { vocab: w.vocab, text: `${w.vocab} (${w.POS})`, type: 'word' as const, match_id: i, matched: false },
    { vocab: w.vocab, text: w.definition, type: 'def' as const, match_id: i, matched: false },
  ])
  return shuffle(tiles)
}

export function matchingGridText(tiles: MatchTile[], selected: number | null | undefined, matchMsg: string | undefined, elapsedSeconds: number): string {
  let text = `⚡ *Match Pairs*\n━━━━━━━━━━━━━\n\nGhép từ tiếng Anh với nghĩa tương ứng:\n⏱ Thời gian: ${elapsedSeconds}s\n\n`

  const pairs: string[] = []
  const seen = new Set<number>()
  for (const t of tiles) {
    if (!t.matched || seen.has(t.match_id)) continue
    seen.add(t.match_id)
    const w = tiles.find(x => x.match_id === t.match_id && x.type === 'word')!
    const d = tiles.find(x => x.match_id === t.match_id && x.type === 'def')!
    pairs.push(`✅ ${w.text} ↔ ${d.text}`)
  }
  if (pairs.length) text += `${pairs.join('\n')}\n━━━━━━━━━━━━━\n\n`

  tiles.forEach((t, i) => {
    text += t.matched ? `${i + 1}. [Đã ghép ✅]\n` : `${selected === i ? '👉 ' : ''}${i + 1}. ${t.text}\n`
  })
  if (matchMsg) text += `\n${matchMsg}\n`
  return text
}
