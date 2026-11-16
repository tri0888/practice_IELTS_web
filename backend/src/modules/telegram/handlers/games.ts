import type { InlineKeyboardMarkup } from 'grammy/types'
import { getPracticeWords, getStats, getVocab, updateProgress } from '../../vocabulary/services'
import { checkTranslationAnswer, formatClue, getUserIdByTelegram } from '../services'
import type { BotContext, GamesState, MatchTile } from '../session'
import { MD, NOT_LINKED, edit, grid, keyboard } from '../ui'

type Next = GamesState | 'END'
type Handler = (ctx: BotContext) => Promise<Next>

const MENU_TEXT = '🎮 *Vocabulary Games*\n━━━━━━━━━━━━━━━━━━\n\nChọn game bạn muốn chơi:'
const MENU_KEYBOARD = keyboard([[['📝 Translation Quiz', 'game:translation']], [['⚡ Match Pairs', 'game:matching']]])
const CONFIG_RULE = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
const QUIZ_RULE = '━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
const END_KEYBOARD = keyboard([[['🔄 Chơi lại', 'g_restart'], ['🔙 Thoát', 'g_quit']]])
const BACK_TO_START = keyboard([[['🔙 Quay lại bắt đầu', 'g_restart']]])

const gm = (ctx: BotContext) => ctx.session.games!
const gameLabel = (ctx: BotContext) => (gm(ctx).type === 'translation' ? 'Translation Quiz' : 'Match Pairs')
const scopeLabel = (ctx: BotContext) => (gm(ctx).scope === 'random' ? 'All Words' : 'Studied Only')
const silently = (p: Promise<unknown>) => p.catch(() => undefined)

export async function gamesStart(ctx: BotContext) {
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

const gameTypeCallback: Handler = async ctx => {
  await ctx.answerCallbackQuery()
  gm(ctx).type = ctx.callbackQuery!.data!.split(':')[1] as 'translation' | 'matching'
  await edit(ctx, `⚙️ *Game Config — ${gameLabel(ctx)}*\n${CONFIG_RULE}\nChọn Vocabulary Scope:`,
    keyboard([[['📋 All Words', 'scope:random'], ['📖 Studied Only', 'scope:studied']]]))
  return 'SELECT_SCOPE'
}

const scopeCallback: Handler = async ctx => {
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

const posCallback: Handler = async ctx => {
  await ctx.answerCallbackQuery()
  const pos = ctx.callbackQuery!.data!.split(':')[1]
  gm(ctx).pos = pos === 'all' ? '' : pos
  if (gm(ctx).type !== 'translation') return startMatchingGame(ctx) // Match Pairs uses a fixed 6 words
  await edit(ctx,
    `⚙️ *Game Config — Translation Quiz*\n${CONFIG_RULE}✅ Scope: ${scopeLabel(ctx)}\n✅ Word Type: ${pos === 'all' ? 'All Types' : pos}\n\nChọn Session Length:`,
    keyboard([[['15 Qs', 'g_size:15'], ['20 Qs', 'g_size:20'], ['30 Qs', 'g_size:30']]]))
  return 'SELECT_SIZE'
}

const sizeCallback: Handler = async ctx => {
  await ctx.answerCallbackQuery()
  gm(ctx).size = Number(ctx.callbackQuery!.data!.split(':')[1])
  return startTranslationGame(ctx)
}

// ---------------------------------------------------------------- Translation Quiz
async function startTranslationGame(ctx: BotContext): Promise<Next> {
  const g = gm(ctx)
  const deck = await getPracticeWords(ctx.session.user_id!, g.scope ?? 'random', g.pos || undefined, g.size ?? 15)
  if (!deck.length) {
    await ctx.editMessageText(
      '⚠️ Không tìm thấy từ vựng phù hợp với bộ lọc (không tính từ Mastered).\nVui lòng thử cấu hình khác.',
      { reply_markup: BACK_TO_START },
    )
    return 'SELECT_GAME'
  }
  Object.assign(g, { deck, index: 0, correct: 0, wrong: 0, hintRevealed: false })
  g.messageId = ctx.callbackQuery?.message?.message_id
  await showTranslationQuestion(ctx, (text, markup) => edit(ctx, text, markup))
  return 'PLAY_TRANSLATION'
}

function questionText(ctx: BotContext, clue?: string) {
  const g = gm(ctx)
  const deck = g.deck!
  const word = deck[g.index!]
  const head = `📝 *Translation Quiz — Q${g.index! + 1}/${deck.length}*\n${QUIZ_RULE}\n`
  const extra = clue ? `${clue}\n\n` : ''
  return g.direction === 'en'
    ? `${head}Dịch từ tiếng Anh sang tiếng Việt:\n🔤 *${word.vocab}* (${word.POS})\n\n${extra}💬 Gõ nghĩa tiếng Việt của từ...`
    : `${head}Gõ từ tiếng Anh có nghĩa tiếng Việt:\n💡 *${word.definition}* (${word.POS})\n\n${extra}💬 Gõ đúng chính tả tiếng Anh...`
}

async function showTranslationQuestion(ctx: BotContext, render: (text: string, markup: InlineKeyboardMarkup) => Promise<unknown>) {
  const g = gm(ctx)
  g.direction = Math.random() < 0.5 ? 'en' : 'vi'
  g.hintRevealed = false
  const prefix = g.prevFeedback ? `${g.prevFeedback}\n${QUIZ_RULE}` : ''
  g.prevFeedback = undefined
  await render(prefix + questionText(ctx), keyboard([[['💡 Show Clue', 'g_action:clue']]]))
}

const clueCallback: Handler = async ctx => {
  await ctx.answerCallbackQuery()
  const g = gm(ctx)
  if (g.hintRevealed) return 'PLAY_TRANSLATION'
  g.hintRevealed = true
  await ctx.editMessageText(questionText(ctx, formatClue(g.deck![g.index!], g.direction!)), MD)
  return 'PLAY_TRANSLATION'
}

async function receiveTranslationAnswer(ctx: BotContext): Promise<Next> {
  const g = gm(ctx)
  if (!g.deck || g.index === undefined) return 'END'
  const word = g.deck[g.index]
  const correctVal = g.direction === 'en' ? word.definition : word.vocab
  const isCorrect = checkTranslationAnswer(ctx.message!.text!, correctVal, g.direction!)

  await silently(ctx.deleteMessage()) // keep the chat clean

  let feedback: string
  if (isCorrect) {
    g.correct = (g.correct ?? 0) + 1
    feedback = `✅ *Chính xác!* 🎉\n*${word.vocab}* ↔ ${word.definition}`
  } else {
    g.wrong = (g.wrong ?? 0) + 1
    feedback = `❌ *Chưa chính xác!*\nĐáp án đúng: *${correctVal}*\n*${word.vocab}* ↔ ${word.definition}`
  }
  await silently(updateProgress(ctx.session.user_id!, word.vocab, undefined, isCorrect))

  g.prevFeedback = feedback
  g.index += 1
  const chatId = ctx.chat!.id
  const render = (text: string, reply_markup: InlineKeyboardMarkup) =>
    ctx.api.editMessageText(chatId, g.messageId!, text, { ...MD, reply_markup })

  if (g.index >= g.deck.length) {
    const accuracy = Math.round(((g.correct ?? 0) / g.deck.length) * 100)
    await render(
      `${feedback}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🏆 *Translation Quiz Complete!*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `✅ Số câu đúng: ${g.correct ?? 0}\n❌ Số câu sai: ${g.wrong ?? 0}\n📊 Tỷ lệ chính xác: ${accuracy}%\n\n` +
        'Tiến trình học tập đã được cập nhật thành công!',
      END_KEYBOARD,
    )
    return 'PLAY_TRANSLATION'
  }
  await showTranslationQuestion(ctx, render)
  return 'PLAY_TRANSLATION'
}

// ---------------------------------------------------------------- Match Pairs
function shuffle<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[items[i], items[j]] = [items[j], items[i]]
  }
  return items
}

async function startMatchingGame(ctx: BotContext): Promise<Next> {
  const g = gm(ctx)
  const deck = await getPracticeWords(ctx.session.user_id!, g.scope ?? 'random', g.pos || undefined, 6)
  if (deck.length < 6) {
    await ctx.editMessageText(
      `⚠️ Không đủ từ vựng để bắt đầu (Cần 6 từ, chỉ có ${deck.length} từ).\nVui lòng thay đổi cấu hình hoặc chọn All Words.`,
      { reply_markup: BACK_TO_START },
    )
    return 'SELECT_GAME'
  }
  const tiles: MatchTile[] = deck.slice(0, 6).flatMap((w, i) => [
    { vocab: w.vocab, text: `${w.vocab} (${w.POS})`, type: 'word' as const, match_id: i, matched: false },
    { vocab: w.vocab, text: w.definition, type: 'def' as const, match_id: i, matched: false },
  ])
  Object.assign(g, { tiles: shuffle(tiles), selected: null, startedAt: Date.now(), matchCorrect: 0, matchMsg: '' })
  await displayMatchingGrid(ctx)
  return 'PLAY_MATCHING'
}

const elapsedSeconds = (ctx: BotContext) => Math.floor((Date.now() - (gm(ctx).startedAt ?? Date.now())) / 1000)

async function displayMatchingGrid(ctx: BotContext) {
  const { tiles = [], selected, matchMsg } = gm(ctx)
  let text = `⚡ *Match Pairs*\n━━━━━━━━━━━━━\n\nGhép từ tiếng Anh với nghĩa tương ứng:\n⏱ Thời gian: ${elapsedSeconds(ctx)}s\n\n`

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

  const buttons = tiles.map((t, i): [string, string] =>
    [t.matched ? '✅' : selected === i ? `⭐ ${i + 1}` : String(i + 1), `match:tile:${i}`])
  await edit(ctx, text, keyboard(grid(buttons, 6)))
}

const matchTileCallback: Handler = async ctx => {
  await ctx.answerCallbackQuery()
  const g = gm(ctx)
  const tiles = g.tiles ?? []
  const idx = Number(ctx.callbackQuery!.data!.split(':')[2])
  if (!tiles[idx] || tiles[idx].matched) return 'PLAY_MATCHING'

  const selected = g.selected ?? null
  if (selected === null || selected === idx) {
    // First pick selects; tapping the same tile again deselects.
    g.selected = selected === null ? idx : null
    g.matchMsg = ''
    await displayMatchingGrid(ctx)
    return 'PLAY_MATCHING'
  }

  const [t1, t2] = [tiles[selected], tiles[idx]]
  g.selected = null
  if (t1.match_id === t2.match_id && t1.type !== t2.type) {
    t1.matched = t2.matched = true
    g.matchCorrect = (g.matchCorrect ?? 0) + 1
    g.matchMsg = `✅ Ghép đúng: *${t1.vocab}*`
    await silently(updateProgress(ctx.session.user_id!, t1.vocab, undefined, true))
  } else {
    g.matchMsg = '❌ Sai rồi! Hãy thử lại.'
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

// ---------------------------------------------------------------- General
const restartCallback: Handler = async ctx => {
  await ctx.answerCallbackQuery()
  await edit(ctx, MENU_TEXT, MENU_KEYBOARD)
  return 'SELECT_GAME'
}

export const gamesCancel: Handler = async ctx => {
  if (ctx.callbackQuery) {
    await ctx.answerCallbackQuery()
    await ctx.editMessageText('👋 Đã kết thúc lượt chơi game.')
  } else {
    await ctx.reply('👋 Đã thoát khỏi phòng game.')
  }
  return 'END'
}

// Same state table as the old ConversationHandler.
const STATES: Record<GamesState, [RegExp, Handler][]> = {
  SELECT_GAME: [[/^game:/, gameTypeCallback], [/^g_restart$/, restartCallback], [/^g_quit$/, gamesCancel]],
  SELECT_SCOPE: [[/^scope:/, scopeCallback], [/^g_restart$/, restartCallback]],
  SELECT_POS: [[/^g_pos:/, posCallback], [/^g_restart$/, restartCallback]],
  SELECT_SIZE: [[/^g_size:/, sizeCallback], [/^g_restart$/, restartCallback]],
  PLAY_TRANSLATION: [[/^g_action:clue$/, clueCallback], [/^g_restart$/, restartCallback], [/^g_quit$/, gamesCancel]],
  PLAY_MATCHING: [[/^match:tile:/, matchTileCallback], [/^g_restart$/, restartCallback], [/^g_quit$/, gamesCancel]],
}
const FALLBACKS: [RegExp, Handler][] = [[/^g_quit$/, gamesCancel]]

export async function applyGames(ctx: BotContext, handler: Handler) {
  const next = await handler(ctx)
  if (next === 'END') delete ctx.session.games
  else if (ctx.session.games) ctx.session.games.state = next
}

export async function gamesCallback(ctx: BotContext): Promise<boolean> {
  const state = ctx.session.games?.state
  if (!state) return false
  const data = ctx.callbackQuery?.data ?? ''
  const match = [...STATES[state], ...FALLBACKS].find(([pattern]) => pattern.test(data))
  if (!match) return false
  await applyGames(ctx, match[1])
  return true
}

/** Plain text while a Translation Quiz question is open = the user's answer. */
export async function gamesText(ctx: BotContext): Promise<boolean> {
  if (ctx.session.games?.state !== 'PLAY_TRANSLATION') return false
  await applyGames(ctx, receiveTranslationAnswer)
  return true
}
