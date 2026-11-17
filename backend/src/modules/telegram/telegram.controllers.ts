import { Bot, session } from 'grammy'
import type { InlineKeyboardMarkup, Update, UserFromGetMe } from 'grammy/types'
import { text, type ApiRequest } from '../../shared/http'
import { getPracticeWords, getStats, getVocab, updateProgress } from '../vocabulary/vocabulary.services'
import { sessionStorage } from './telegram.repositories'
import {
  MD,
  NOT_LINKED,
  buildMatchTiles,
  checkTranslationAnswer,
  formatClue,
  getFlashcardFileId,
  getUserIdByTelegram,
  grid,
  keyboard,
  linkTelegramAccount,
  matchingGridText,
  sessionKey,
  type BotContext,
  type FlashcardState,
  type GamesState,
  type SessionData,
} from './telegram.services'

const edit = (ctx: BotContext, body: string, reply_markup?: InlineKeyboardMarkup) =>
  ctx.editMessageText(body, { ...MD, reply_markup })

const silently = (p: Promise<unknown>) => p.catch(() => undefined)

const WEBHOOK_TIMEOUT_MS = 50_000

type BotCache = { token: string; bot: Bot<BotContext> }
const g = globalThis as typeof globalThis & { __practiceHubBot?: BotCache }

export function createBot(token: string, botInfo?: UserFromGetMe): Bot<BotContext> {
  const bot = new Bot<BotContext>(token, { client: { timeoutSeconds: 30 }, botInfo })

  bot.use(session<SessionData, BotContext>({ initial: () => ({}), storage: sessionStorage, getSessionKey: sessionKey }))

  bot.command('start', startCommand)
  bot.command('stats', statsCommand)
  bot.command('link', linkCommand)
  bot.command('flashcard', flashcardStart)
  bot.command('games', gamesStart)
  bot.command('cancel', async ctx => {
    if (ctx.session.flashcard) await applyFlashcard(ctx, flashcardCancel)
    else if (ctx.session.games) await applyGames(ctx, gamesCancel)
  })

  bot.on('callback_query:data', async ctx => {
    if (await flashcardCallback(ctx)) return
    if (await gamesCallback(ctx)) return
    await silently(ctx.answerCallbackQuery())
  })

  bot.on('message:text', async ctx => {
    if (ctx.message.text.startsWith('/')) return
    await gamesText(ctx)
  })

  bot.catch(err => console.error(`Telegram update ${err.ctx.update.update_id} failed:`, err.error))
  return bot
}

function getTelegramBot(): Bot<BotContext> | null {
  const token = (process.env.TELEGRAM_BOT_TOKEN ?? '').trim()
  if (!token) return null
  if (g.__practiceHubBot?.token !== token) g.__practiceHubBot = { token, bot: createBot(token) }
  return g.__practiceHubBot.bot
}

export async function webhook(req: ApiRequest) {
  const bot = getTelegramBot()
  if (!bot) return text('Telegram bot application is not initialized', 503)

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim()
  if (secret && req.headers['x-telegram-bot-api-secret-token'] !== secret) return text('secret token is wrong', 401)

  let update: Update
  try {
    update = JSON.parse(req.body)
  } catch {
    return text('invalid update', 400)
  }

  if (!bot.isInited()) await bot.init()
  await Promise.race([
    bot.handleUpdate(update),
    new Promise(resolve => setTimeout(resolve, WEBHOOK_TIMEOUT_MS).unref()),
  ])
  return text('ok')
}

async function startCommand(ctx: BotContext) {
  await ctx.reply(
    '👋 Chào mừng đến IELTS Vocabulary Bot!\n\n' +
      'Các lệnh có sẵn:\n' +
      '/link <email> <password> — Liên kết tài khoản web\n' +
      '/flashcard — Ôn tập từ vựng bằng flashcard\n' +
      '/games — Chơi game luyện từ vựng\n' +
      '/stats — Xem thống kê học tập\n\n' +
      '⚠️ Hãy dùng /link trước để liên kết tài khoản của bạn.',
  )
}

async function statsCommand(ctx: BotContext) {
  const userId = await getUserIdByTelegram(ctx.from!.id)
  if (!userId) return void (await ctx.reply(NOT_LINKED))
  try {
    const s = await getStats(userId)
    await ctx.reply(
      '📊 *Thống kê học tập của bạn:*\n' +
        '━━━━━━━━━━━━━━━━━━━\n' +
        `📚 Tổng số từ hệ thống: ${s.total_words}\n` +
        `✅ Số từ đã thuộc (Mastered): ${s.mastered_count}\n` +
        `📖 Số từ đang học (Learning): ${s.learning_count}\n` +
        `✍️ Tổng số từ đã luyện tập (Studied): ${s.studied_count}\n` +
        `🎯 Tỷ lệ chính xác: ${s.accuracy}%\n` +
        `📈 Số câu đúng/sai: ${s.total_correct} / ${s.total_wrong}`,
      MD,
    )
  } catch (err) {
    await ctx.reply(`⚠️ Đã có lỗi xảy ra khi lấy thống kê: ${(err as Error).message}`)
  }
}

async function linkCommand(ctx: BotContext) {
  const args = String(ctx.match ?? '').split(/\s+/).filter(Boolean)
  if (args.length < 2) {
    await ctx.reply(
      '⚠️ Sử dụng sai định dạng lệnh.\n' +
        'Cú pháp đúng: `/link <email> <password>`\n' +
        'Ví dụ: `/link you@example.com your-password`',
    ).catch(err => console.error('Failed to send argument hint:', err))
    return
  }
  const [email, password] = args

  const status = await ctx.reply('⏳ Đang xác thực thông tin liên kết...').catch(() => null)
  const res = await linkTelegramAccount(ctx.from!.id, email, password)
  const message = 'message' in res
    ? `❌ Liên kết thất bại: ${res.message}`
    : `✅ Đã liên kết tài khoản web thành công!\n👤 Tài khoản: ${res.name} (${email})\n` +
      'Giờ đây bạn có thể bắt đầu sử dụng lệnh /flashcard và /games.'

  try {
    if (status) await ctx.api.editMessageText(status.chat.id, status.message_id, message)
    else await ctx.reply(message)
  } catch (err) {
    console.error('Failed to reply link result:', err)
  }
  await silently(ctx.deleteMessage())
}

type FlashcardNext = FlashcardState | 'END'
type FlashcardHandler = (ctx: BotContext) => Promise<FlashcardNext>

const FC_HEADER = '📚 *Flashcard Practice*\n━━━━━━━━━━━━━━━━━━━\n'
const FOCUS_KEYBOARD = keyboard([[['🔀 Random', 'focus:random'], ['📖 Studied Words', 'focus:studied']]])
const fc = (ctx: BotContext) => ctx.session.flashcard!

async function flashcardStart(ctx: BotContext) {
  const userId = await getUserIdByTelegram(ctx.from!.id)
  if (!userId) {
    delete ctx.session.flashcard
    await ctx.reply(NOT_LINKED)
    return
  }
  ctx.session.user_id = userId
  ctx.session.flashcard = { state: 'SELECT_FOCUS' }
  await ctx.reply(`${FC_HEADER}\nChọn Practice Focus:`, { ...MD, reply_markup: FOCUS_KEYBOARD })
}

const fcFocusCallback: FlashcardHandler = async ctx => {
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
  await edit(ctx, `${FC_HEADER}✅ Focus: ${label}\n\nChọn Word Type:`,
    keyboard([[['📋 All Types', 'pos:all']], ...grid(uniquePos.map(p => [p, `pos:${p}`]), 3)]))
  return 'SELECT_POS'
}

const fcPosCallback: FlashcardHandler = async ctx => {
  await ctx.answerCallbackQuery()
  const pos = ctx.callbackQuery!.data!.split(':')[1]
  fc(ctx).pos = pos === 'all' ? '' : pos
  const focusLabel = fc(ctx).focus === 'random' ? 'Random' : 'Studied Words'
  await edit(ctx, `${FC_HEADER}✅ Focus: ${focusLabel}\n✅ Word Type: ${pos === 'all' ? 'All Types' : pos}\n\nChọn Deck Size:`,
    keyboard([[['15 cards', 'size:15'], ['20 cards', 'size:20'], ['30 cards', 'size:30']]]))
  return 'SELECT_SIZE'
}

const fcSizeCallback: FlashcardHandler = async ctx => {
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
  if (word.status === 'unlearned') {
    await silently(updateProgress(ctx.session.user_id!, word.vocab, 'learning'))
  }
  await edit(ctx,
    `📝 *Card ${index + 1}/${deck.length}*\n━━━━━━━━━━━━\n*${word.vocab}*\n${word.pronunciation} • ${word.POS}\n💡 ${word.definition}`,
    keyboard([[['🔊 Pronounce', 'fc:speak']], [nextButton(index, deck.length)]]))
}

async function clearVoices(ctx: BotContext) {
  const state = ctx.session.flashcard
  const chatId = ctx.chat?.id
  if (!state?.voiceMsgs?.length || !chatId) return
  for (const id of state.voiceMsgs) await silently(ctx.api.deleteMessage(chatId, id))
  state.voiceMsgs = []
}

const fcCardCallback: FlashcardHandler = async ctx => {
  const state = fc(ctx)
  const action = ctx.callbackQuery!.data!
  const deck = state.deck ?? []
  const index = state.index ?? 0

  if (action === 'fc:speak') {
    const word = deck[index]?.vocab ?? ''
    const fileId = word ? await getFlashcardFileId(ctx.me.id, word.toLowerCase()) : null
    if (!fileId) {
      await ctx.answerCallbackQuery({ text: '🔇 Chưa có audio cho từ này (cần chạy seed).' })
      return 'PLAY_CARDS'
    }
    await ctx.answerCallbackQuery()
    const sent = await ctx.api.sendVoice(ctx.chat!.id, fileId)
    ;(state.voiceMsgs ??= []).push(sent.message_id)
    await silently(ctx.editMessageReplyMarkup({ reply_markup: keyboard([[nextButton(index, deck.length)]]) }))
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

const fcRestartCallback: FlashcardHandler = async ctx => {
  await ctx.answerCallbackQuery()
  await clearVoices(ctx)
  await edit(ctx, `${FC_HEADER}\nChọn Practice Focus:`, FOCUS_KEYBOARD)
  return 'SELECT_FOCUS'
}

const flashcardCancel: FlashcardHandler = async ctx => {
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery()
    await clearVoices(ctx)
    await ctx.editMessageText('👋 Đã kết thúc phiên ôn tập Flashcard.')
  } else {
    await ctx.reply('👋 Đã thoát khỏi phiên ôn tập Flashcard.')
  }
  return 'END'
}

const FC_STATES: Record<FlashcardState, [RegExp, FlashcardHandler][]> = {
  SELECT_FOCUS: [[/^focus:/, fcFocusCallback], [/^fc_restart$/, fcRestartCallback], [/^fc_quit$/, flashcardCancel]],
  SELECT_POS: [[/^pos:/, fcPosCallback], [/^fc_restart$/, fcRestartCallback]],
  SELECT_SIZE: [[/^size:/, fcSizeCallback], [/^fc_restart$/, fcRestartCallback]],
  PLAY_CARDS: [[/^fc:/, fcCardCallback], [/^fc_restart$/, fcRestartCallback], [/^fc_quit$/, flashcardCancel]],
}
const FC_FALLBACKS: [RegExp, FlashcardHandler][] = [[/^fc_quit$/, flashcardCancel]]

async function applyFlashcard(ctx: BotContext, handler: FlashcardHandler) {
  const next = await handler(ctx)
  if (next === 'END') delete ctx.session.flashcard
  else if (ctx.session.flashcard) ctx.session.flashcard.state = next
}

async function flashcardCallback(ctx: BotContext): Promise<boolean> {
  const state = ctx.session.flashcard?.state
  if (!state) return false
  const data = ctx.callbackQuery?.data ?? ''
  const match = [...FC_STATES[state], ...FC_FALLBACKS].find(([pattern]) => pattern.test(data))
  if (!match) return false
  await applyFlashcard(ctx, match[1])
  return true
}

type GamesNext = GamesState | 'END'
type GamesHandler = (ctx: BotContext) => Promise<GamesNext>

const MENU_TEXT = '🎮 *Vocabulary Games*\n━━━━━━━━━━━━━━━━━━\n\nChọn game bạn muốn chơi:'
const MENU_KEYBOARD = keyboard([[['📝 Translation Quiz', 'game:translation']], [['⚡ Match Pairs', 'game:matching']]])
const CONFIG_RULE = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
const QUIZ_RULE = '━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
const END_KEYBOARD = keyboard([[['🔄 Chơi lại', 'g_restart'], ['🔙 Thoát', 'g_quit']]])
const BACK_TO_START = keyboard([[['🔙 Quay lại bắt đầu', 'g_restart']]])

const gm = (ctx: BotContext) => ctx.session.games!
const gameLabel = (ctx: BotContext) => (gm(ctx).type === 'translation' ? 'Translation Quiz' : 'Match Pairs')
const scopeLabel = (ctx: BotContext) => (gm(ctx).scope === 'random' ? 'All Words' : 'Studied Only')

async function gamesStart(ctx: BotContext) {
  const userId = await getUserIdByTelegram(ctx.from!.id)
  if (!userId) {
    delete ctx.session.games
    await ctx.reply(NOT_LINKED)
    return
  }
  ctx.session.user_id = userId
  ctx.session.games = { state: 'SELECT_GAME' }
  await ctx.reply(MENU_TEXT, { ...MD, reply_markup: MENU_KEYBOARD })
}

const gameTypeCallback: GamesHandler = async ctx => {
  await ctx.answerCallbackQuery()
  gm(ctx).type = ctx.callbackQuery!.data!.split(':')[1] as 'translation' | 'matching'
  await edit(ctx, `⚙️ *Game Config — ${gameLabel(ctx)}*\n${CONFIG_RULE}\nChọn Vocabulary Scope:`,
    keyboard([[['📋 All Words', 'scope:random'], ['📖 Studied Only', 'scope:studied']]]))
  return 'SELECT_SCOPE'
}

const gameScopeCallback: GamesHandler = async ctx => {
  await ctx.answerCallbackQuery()
  const scope = ctx.callbackQuery!.data!.split(':')[1] as 'random' | 'studied'
  gm(ctx).scope = scope
  if (scope === 'studied' && (await getStats(ctx.session.user_id!)).studied_count === 0) {
    await ctx.editMessageText(
      '⚠️ Bạn chưa có từ nào trong mục Studied Words.\nHãy chọn All Words để luyện tập trước.',
      { reply_markup: keyboard([[['🔙 Quay lại', 'g_restart']]]) },
    )
    return 'SELECT_GAME'
  }
  const { uniquePos } = await getVocab()
  await edit(ctx, `⚙️ *Game Config — ${gameLabel(ctx)}*\n${CONFIG_RULE}✅ Scope: ${scopeLabel(ctx)}\n\nChọn Word Type:`,
    keyboard([[['📋 All Types', 'g_pos:all']], ...grid(uniquePos.map(p => [p, `g_pos:${p}`]), 3)]))
  return 'SELECT_POS'
}

const gamePosCallback: GamesHandler = async ctx => {
  await ctx.answerCallbackQuery()
  const pos = ctx.callbackQuery!.data!.split(':')[1]
  gm(ctx).pos = pos === 'all' ? '' : pos
  if (gm(ctx).type !== 'translation') return startMatchingGame(ctx)
  await edit(ctx,
    `⚙️ *Game Config — Translation Quiz*\n${CONFIG_RULE}✅ Scope: ${scopeLabel(ctx)}\n✅ Word Type: ${pos === 'all' ? 'All Types' : pos}\n\nChọn Session Length:`,
    keyboard([[['15 Qs', 'g_size:15'], ['20 Qs', 'g_size:20'], ['30 Qs', 'g_size:30']]]))
  return 'SELECT_SIZE'
}

const gameSizeCallback: GamesHandler = async ctx => {
  await ctx.answerCallbackQuery()
  gm(ctx).size = Number(ctx.callbackQuery!.data!.split(':')[1])
  return startTranslationGame(ctx)
}

async function startTranslationGame(ctx: BotContext): Promise<GamesNext> {
  const state = gm(ctx)
  const deck = await getPracticeWords(ctx.session.user_id!, state.scope ?? 'random', state.pos || undefined, state.size ?? 15)
  if (!deck.length) {
    await ctx.editMessageText(
      '⚠️ Không tìm thấy từ vựng phù hợp với bộ lọc (không tính từ Mastered).\nVui lòng thử cấu hình khác.',
      { reply_markup: BACK_TO_START },
    )
    return 'SELECT_GAME'
  }
  Object.assign(state, { deck, index: 0, correct: 0, wrong: 0, hintRevealed: false })
  state.messageId = ctx.callbackQuery?.message?.message_id
  await showTranslationQuestion(ctx, (body, markup) => edit(ctx, body, markup))
  return 'PLAY_TRANSLATION'
}

function questionText(ctx: BotContext, clue?: string) {
  const state = gm(ctx)
  const deck = state.deck!
  const word = deck[state.index!]
  const head = `📝 *Translation Quiz — Q${state.index! + 1}/${deck.length}*\n${QUIZ_RULE}\n`
  const extra = clue ? `${clue}\n\n` : ''
  return state.direction === 'en'
    ? `${head}Dịch từ tiếng Anh sang tiếng Việt:\n🔤 *${word.vocab}* (${word.POS})\n\n${extra}💬 Gõ nghĩa tiếng Việt của từ...`
    : `${head}Gõ từ tiếng Anh có nghĩa tiếng Việt:\n💡 *${word.definition}* (${word.POS})\n\n${extra}💬 Gõ đúng chính tả tiếng Anh...`
}

async function showTranslationQuestion(ctx: BotContext, render: (body: string, markup: InlineKeyboardMarkup) => Promise<unknown>) {
  const state = gm(ctx)
  state.direction = Math.random() < 0.5 ? 'en' : 'vi'
  state.hintRevealed = false
  const prefix = state.prevFeedback ? `${state.prevFeedback}\n${QUIZ_RULE}` : ''
  state.prevFeedback = undefined
  await render(prefix + questionText(ctx), keyboard([[['💡 Show Clue', 'g_action:clue']]]))
}

const clueCallback: GamesHandler = async ctx => {
  await ctx.answerCallbackQuery()
  const state = gm(ctx)
  if (state.hintRevealed) return 'PLAY_TRANSLATION'
  state.hintRevealed = true
  await ctx.editMessageText(questionText(ctx, formatClue(state.deck![state.index!], state.direction!)), MD)
  return 'PLAY_TRANSLATION'
}

async function receiveTranslationAnswer(ctx: BotContext): Promise<GamesNext> {
  const state = gm(ctx)
  if (!state.deck || state.index === undefined) return 'END'
  const word = state.deck[state.index]
  const correctVal = state.direction === 'en' ? word.definition : word.vocab
  const isCorrect = checkTranslationAnswer(ctx.message!.text!, correctVal, state.direction!)

  await silently(ctx.deleteMessage())

  let feedback: string
  if (isCorrect) {
    state.correct = (state.correct ?? 0) + 1
    feedback = `✅ *Chính xác!* 🎉\n*${word.vocab}* ↔ ${word.definition}`
  } else {
    state.wrong = (state.wrong ?? 0) + 1
    feedback = `❌ *Chưa chính xác!*\nĐáp án đúng: *${correctVal}*\n*${word.vocab}* ↔ ${word.definition}`
  }
  await silently(updateProgress(ctx.session.user_id!, word.vocab, undefined, isCorrect))

  state.prevFeedback = feedback
  state.index += 1
  const chatId = ctx.chat!.id
  const render = (body: string, reply_markup: InlineKeyboardMarkup) =>
    ctx.api.editMessageText(chatId, state.messageId!, body, { ...MD, reply_markup })

  if (state.index >= state.deck.length) {
    const accuracy = Math.round(((state.correct ?? 0) / state.deck.length) * 100)
    await render(
      `${feedback}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🏆 *Translation Quiz Complete!*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `✅ Số câu đúng: ${state.correct ?? 0}\n❌ Số câu sai: ${state.wrong ?? 0}\n📊 Tỷ lệ chính xác: ${accuracy}%\n\n` +
        'Tiến trình học tập đã được cập nhật thành công!',
      END_KEYBOARD,
    )
    return 'PLAY_TRANSLATION'
  }
  await showTranslationQuestion(ctx, render)
  return 'PLAY_TRANSLATION'
}

async function startMatchingGame(ctx: BotContext): Promise<GamesNext> {
  const state = gm(ctx)
  const deck = await getPracticeWords(ctx.session.user_id!, state.scope ?? 'random', state.pos || undefined, 6)
  if (deck.length < 6) {
    await ctx.editMessageText(
      `⚠️ Không đủ từ vựng để bắt đầu (Cần 6 từ, chỉ có ${deck.length} từ).\nVui lòng thay đổi cấu hình hoặc chọn All Words.`,
      { reply_markup: BACK_TO_START },
    )
    return 'SELECT_GAME'
  }
  Object.assign(state, { tiles: buildMatchTiles(deck.slice(0, 6)), selected: null, startedAt: Date.now(), matchCorrect: 0, matchMsg: '' })
  await displayMatchingGrid(ctx)
  return 'PLAY_MATCHING'
}

const elapsedSeconds = (ctx: BotContext) => Math.floor((Date.now() - (gm(ctx).startedAt ?? Date.now())) / 1000)

async function displayMatchingGrid(ctx: BotContext) {
  const { tiles = [], selected, matchMsg } = gm(ctx)
  const buttons = tiles.map((t, i): [string, string] =>
    [t.matched ? '✅' : selected === i ? `⭐ ${i + 1}` : String(i + 1), `match:tile:${i}`])
  await edit(ctx, matchingGridText(tiles, selected, matchMsg, elapsedSeconds(ctx)), keyboard(grid(buttons, 6)))
}

const matchTileCallback: GamesHandler = async ctx => {
  await ctx.answerCallbackQuery()
  const state = gm(ctx)
  const tiles = state.tiles ?? []
  const idx = Number(ctx.callbackQuery!.data!.split(':')[2])
  if (!tiles[idx] || tiles[idx].matched) return 'PLAY_MATCHING'

  const selected = state.selected ?? null
  if (selected === null || selected === idx) {
    state.selected = selected === null ? idx : null
    state.matchMsg = ''
    await displayMatchingGrid(ctx)
    return 'PLAY_MATCHING'
  }

  const [t1, t2] = [tiles[selected], tiles[idx]]
  state.selected = null
  if (t1.match_id === t2.match_id && t1.type !== t2.type) {
    t1.matched = t2.matched = true
    state.matchCorrect = (state.matchCorrect ?? 0) + 1
    state.matchMsg = `✅ Ghép đúng: *${t1.vocab}*`
    await silently(updateProgress(ctx.session.user_id!, t1.vocab, undefined, true))
  } else {
    state.matchMsg = '❌ Sai rồi! Hãy thử lại.'
    await silently(updateProgress(ctx.session.user_id!, t1.vocab, undefined, false))
    await silently(updateProgress(ctx.session.user_id!, t2.vocab, undefined, false))
  }

  if (tiles.every(t => t.matched)) {
    await edit(ctx,
      `🏆 *Match Pairs Complete!*\n━━━━━━━━━━━━━━━━━━━━━━━\n\n⏱ Thời gian hoàn thành: ${elapsedSeconds(ctx)} giây\n` +
        '✅ Ghép thành công 6/6 cặp từ vựng!\n\nTiến trình của bạn đã được ghi nhận.',
      END_KEYBOARD)
  } else {
    await displayMatchingGrid(ctx)
  }
  return 'PLAY_MATCHING'
}

const gamesRestartCallback: GamesHandler = async ctx => {
  await ctx.answerCallbackQuery()
  await edit(ctx, MENU_TEXT, MENU_KEYBOARD)
  return 'SELECT_GAME'
}

const gamesCancel: GamesHandler = async ctx => {
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery()
    await ctx.editMessageText('👋 Đã kết thúc lượt chơi game.')
  } else {
    await ctx.reply('👋 Đã thoát khỏi phòng game.')
  }
  return 'END'
}

const GAMES_STATES: Record<GamesState, [RegExp, GamesHandler][]> = {
  SELECT_GAME: [[/^game:/, gameTypeCallback], [/^g_restart$/, gamesRestartCallback], [/^g_quit$/, gamesCancel]],
  SELECT_SCOPE: [[/^scope:/, gameScopeCallback], [/^g_restart$/, gamesRestartCallback]],
  SELECT_POS: [[/^g_pos:/, gamePosCallback], [/^g_restart$/, gamesRestartCallback]],
  SELECT_SIZE: [[/^g_size:/, gameSizeCallback], [/^g_restart$/, gamesRestartCallback]],
  PLAY_TRANSLATION: [[/^g_action:clue$/, clueCallback], [/^g_restart$/, gamesRestartCallback], [/^g_quit$/, gamesCancel]],
  PLAY_MATCHING: [[/^match:tile:/, matchTileCallback], [/^g_restart$/, gamesRestartCallback], [/^g_quit$/, gamesCancel]],
}
const GAMES_FALLBACKS: [RegExp, GamesHandler][] = [[/^g_quit$/, gamesCancel]]

async function applyGames(ctx: BotContext, handler: GamesHandler) {
  const next = await handler(ctx)
  if (next === 'END') delete ctx.session.games
  else if (ctx.session.games) ctx.session.games.state = next
}

async function gamesCallback(ctx: BotContext): Promise<boolean> {
  const state = ctx.session.games?.state
  if (!state) return false
  const data = ctx.callbackQuery?.data ?? ''
  const match = [...GAMES_STATES[state], ...GAMES_FALLBACKS].find(([pattern]) => pattern.test(data))
  if (!match) return false
  await applyGames(ctx, match[1])
  return true
}

async function gamesText(ctx: BotContext): Promise<boolean> {
  if (ctx.session.games?.state !== 'PLAY_TRANSLATION') return false
  await applyGames(ctx, receiveTranslationAnswer)
  return true
}
