import { COLLECTIONS, getCollection } from '../../db'
import { nowIso } from '../../http'
import { verifyPassword, type UserDoc } from '../auth/services'

/** Default TTS voice for flashcard pronunciation (British accent for IELTS). */
export const FLASHCARD_TTS_VOICE = () => process.env.FLASHCARD_TTS_VOICE || 'en-GB-SoniaNeural'

type LinkResult = { success: true; name: string } | { success: false; message: string }

/** Link a Telegram user to an existing, approved web account. */
export async function linkTelegramAccount(telegramId: number, emailRaw: string, password: string): Promise<LinkResult> {
  const email = emailRaw.trim().toLowerCase()
  const users = await getCollection<UserDoc>(COLLECTIONS.users)
  if (!users) return { success: false, message: 'Database is not available.' }

  const user = await users.findOne({ email })
  if (!user) return { success: false, message: 'Email không tồn tại trên hệ thống.' }
  if (!(await verifyPassword(password, user.password_hash))) return { success: false, message: 'Mật khẩu không chính xác.' }
  if (user.role !== 'approved') return { success: false, message: 'Tài khoản của bạn đang chờ phê duyệt, chưa được phép sử dụng.' }

  const tg = await getCollection(COLLECTIONS.telegramUsers)
  if (!tg) return { success: false, message: 'Telegram users collection is not available.' }
  await tg.updateOne(
    { telegram_id: telegramId },
    { $set: { telegram_id: telegramId, user_id: user.id, email, linked_at: nowIso() } },
    { upsert: true },
  )
  return { success: true, name: user.name || 'User' }
}

export async function getUserIdByTelegram(telegramId: number): Promise<string | null> {
  const tg = await getCollection(COLLECTIONS.telegramUsers)
  const doc = tg ? await tg.findOne({ telegram_id: telegramId }) : null
  return (doc?.user_id as string) ?? null
}

/** Cached voice file_id keyed by (bot_id, vocab, voice) — file_ids are bot-specific. */
export async function getFlashcardFileId(botId: number, vocab: string, voice: string): Promise<string | null> {
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

/** EN→VI accepts any comma/semicolon-separated synonym; VI→EN needs the exact word. */
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
