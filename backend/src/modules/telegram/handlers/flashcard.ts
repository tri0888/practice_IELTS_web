import { getPracticeWords, getStats, getVocab, updateProgress } from '../../vocabulary/services'
import { FLASHCARD_TTS_VOICE, getFlashcardFileId, getUserIdByTelegram } from '../services'
import type { BotContext, FlashcardState } from '../session'
import { MD, NOT_LINKED, edit, grid, ignoreTelegramError, keyboard } from '../ui'

type Next = FlashcardState | 'END'
type Handler = (ctx: BotContext) => Promise<Next>

const HEADER = '📚 *Flashcard Practice*\n━━━━━━━━━━━━━━━━━━━\n'
const FOCUS_KEYBOARD = keyboard([[['🔀 Random', 'focus:random'], ['📖 Studied Words', 'focus:studied']]])
const fc = (ctx: BotContext) => ctx.session.flashcard!

export async function flashcardStart(ctx: BotContext) {
  const userId = await getUserIdByTelegram(ctx.from!.id)
  if (!userId) {
    delete ctx.session.flashcard
    await ctx.reply(NOT_LINKED)
    return
  }
  ctx.session.user_id = userId
  ctx.session.flashcard = { state: 'SELECT_FOCUS' }
  await ctx.reply(`${HEADER}\nChọn Practice Focus:`, { ...MD, reply_markup: FOCUS_KEYBOARD })
}

const focusCallback: Handler = async ctx => {
  await ctx.answerCallbackQuery()
  const focus = ctx.callbackQuery!.data!.split(':')[1] as 'random' | 'studied'
  fc(ctx).focus = focus

  if (focus === 'studied' && (await getStats(ctx.session.user_id!)).studied_count === 0) {
    await ctx.editMessageText(
      '⚠️ Bạn chưa có từ nào trong mục Studied Words.\nHãy chọn Random để học từ mới trước.',
      { reply_markup: keyboard([[['🔙 Quay lại', 'fc_restart']]]) },
    )
    return 'SELECT_FOCUS'
  }

  const { uniquePos } = await getVocab()
  const label = focus === 'random' ? 'Random' : 'Studied Words'
  await edit(ctx, `${HEADER}✅ Focus: ${label}\n\nChọn Word Type:`,
    keyboard([[['📋 All Types', 'pos:all']], ...grid(uniquePos.map(p => [p, `pos:${p}`]), 3)]))
  return 'SELECT_POS'
}

const posCallback: Handler = async ctx => {
  await ctx.answerCallbackQuery()
  const pos = ctx.callbackQuery!.data!.split(':')[1]
  fc(ctx).pos = pos === 'all' ? '' : pos
  const focusLabel = fc(ctx).focus === 'random' ? 'Random' : 'Studied Words'
  await edit(ctx, `${HEADER}✅ Focus: ${focusLabel}\n✅ Word Type: ${pos === 'all' ? 'All Types' : pos}\n\nChọn Deck Size:`,
    keyboard([[['15 cards', 'size:15'], ['20 cards', 'size:20'], ['30 cards', 'size:30']]]))
  return 'SELECT_SIZE'
}

const sizeCallback: Handler = async ctx => {
  await ctx.answerCallbackQuery()
  const state = fc(ctx)
  state.size = Number(ctx.callbackQuery!.data!.split(':')[1])
  const deck = await getPracticeWords(ctx.session.user_id!, state.focus ?? 'random', state.pos || undefined, state.size)
  if (!deck.length) {
    await ctx.editMessageText(
      '⚠️ Không tìm thấy từ vựng phù hợp với bộ lọc đã chọn (không tính từ Mastered).\nVui lòng thử cấu hình khác.',
      { reply_markup: keyboard([[['🔙 Quay lại bắt đầu', 'fc_restart']]]) },
    )
    return 'SELECT_FOCUS'
  }
  state.deck = deck
  state.index = 0
  await showCard(ctx)
  return 'PLAY_CARDS'
}

const nextButton = (index: number, total: number): [string, string] =>
  index === total - 1 ? ['✅ Finish', 'fc:finish'] : ['⏭ Next', 'fc:next']

async function showCard(ctx: BotContext) {
  const { deck = [], index = 0 } = fc(ctx)
  const word = deck[index]
  // Seeing a card moves an unlearned word into "learning".
  if (word.status === 'unlearned') {
    await updateProgress(ctx.session.user_id!, word.vocab, 'learning').catch(() => undefined)
  }
  await edit(ctx,
    `📝 *Card ${index + 1}/${deck.length}*\n━━━━━━━━━━━━\n*${word.vocab}*\n${word.pronunciation} • ${word.POS}\n💡 ${word.definition}`,
    keyboard([[['🔊 Pronounce', 'fc:speak']], [nextButton(index, deck.length)]]))
}

/** Delete pronunciation voice messages sent for the current card. */
async function clearVoices(ctx: BotContext) {
  const state = ctx.session.flashcard
  const chatId = ctx.chat?.id
  if (!state?.voiceMsgs?.length || !chatId) return
  for (const id of state.voiceMsgs) await ctx.api.deleteMessage(chatId, id).catch(ignoreTelegramError)
  state.voiceMsgs = []
}

const cardCallback: Handler = async ctx => {
  const state = fc(ctx)
  const action = ctx.callbackQuery!.data!
  const deck = state.deck ?? []
  const index = state.index ?? 0

  if (action === 'fc:speak') {
    // Re-send the cached voice message; the card does not advance.
    const word = deck[index]?.vocab ?? ''
    const fileId = word ? await getFlashcardFileId(ctx.me.id, word.toLowerCase(), FLASHCARD_TTS_VOICE()) : null
    if (!fileId) {
      await ctx.answerCallbackQuery({ text: '🔇 Chưa có audio cho từ này (cần chạy seed).' })
      return 'PLAY_CARDS'
    }
    await ctx.answerCallbackQuery()
    const sent = await ctx.api.sendVoice(ctx.chat!.id, fileId)
    ;(state.voiceMsgs ??= []).push(sent.message_id)
    // Hide "Pronounce" for this card; it comes back with the next one.
    await ctx.editMessageReplyMarkup({ reply_markup: keyboard([[nextButton(index, deck.length)]]) }).catch(ignoreTelegramError)
    return 'PLAY_CARDS'
  }

  await ctx.answerCallbackQuery()
  if (action === 'fc:next') {
    await clearVoices(ctx)
    state.index = index + 1
    await showCard(ctx)
  } else if (action === 'fc:finish') {
    await clearVoices(ctx)
    await edit(ctx,
      '🎉 *Session Complete!*\n━━━━━━━━━━━━━━━━━━━\n' +
        `📚 Đã ôn tập hoàn thành ${deck.length} từ vựng!\n` +
        'Tiến trình của bạn đã được cập nhật tự động lên hệ thống.',
      keyboard([[['🔄 New Session', 'fc_restart'], ['🔙 Thoát', 'fc_quit']]]))
  }
  return 'PLAY_CARDS'
}

const restartCallback: Handler = async ctx => {
  await ctx.answerCallbackQuery()
  await clearVoices(ctx)
  await edit(ctx, `${HEADER}\nChọn Practice Focus:`, FOCUS_KEYBOARD)
  return 'SELECT_FOCUS'
}

export const flashcardCancel: Handler = async ctx => {
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery()
    await clearVoices(ctx)
    await ctx.editMessageText('👋 Đã kết thúc phiên ôn tập Flashcard.')
  } else {
    await ctx.reply('👋 Đã thoát khỏi phiên ôn tập Flashcard.')
  }
  return 'END'
}

// Same state table as the old ConversationHandler.
const STATES: Record<FlashcardState, [RegExp, Handler][]> = {
  SELECT_FOCUS: [[/^focus:/, focusCallback], [/^fc_restart$/, restartCallback], [/^fc_quit$/, flashcardCancel]],
  SELECT_POS: [[/^pos:/, posCallback], [/^fc_restart$/, restartCallback]],
  SELECT_SIZE: [[/^size:/, sizeCallback], [/^fc_restart$/, restartCallback]],
  PLAY_CARDS: [[/^fc:/, cardCallback], [/^fc_restart$/, restartCallback], [/^fc_quit$/, flashcardCancel]],
}
const FALLBACKS: [RegExp, Handler][] = [[/^fc_quit$/, flashcardCancel]]

export async function applyFlashcard(ctx: BotContext, handler: Handler) {
  const next = await handler(ctx)
  if (next === 'END') delete ctx.session.flashcard
  else if (ctx.session.flashcard) ctx.session.flashcard.state = next
}

/** Handle a button press if the flashcard conversation expects it. */
export async function flashcardCallback(ctx: BotContext): Promise<boolean> {
  const state = ctx.session.flashcard?.state
  if (!state) return false
  const data = ctx.callbackQuery?.data ?? ''
  const match = [...STATES[state], ...FALLBACKS].find(([pattern]) => pattern.test(data))
  if (!match) return false
  await applyFlashcard(ctx, match[1])
  return true
}
