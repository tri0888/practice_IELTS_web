import { Bot, session, webhookCallback } from 'grammy'
import type { UserFromGetMe } from 'grammy/types'
import { applyFlashcard, flashcardCallback, flashcardCancel, flashcardStart } from './handlers/flashcard'
import { applyGames, gamesCallback, gamesCancel, gamesStart, gamesText } from './handlers/games'
import { linkCommand, startCommand, statsCommand } from './handlers/start'
import { mongoSessionStorage, sessionKey, type BotContext, type SessionData } from './session'

type BotCache = { token: string; bot: Bot<BotContext>; handle: (req: Request) => Promise<Response> }
const g = globalThis as typeof globalThis & { __practiceHubBot?: BotCache }

/** Exported for tests, which pass `botInfo` to skip the getMe call. */
export function createBot(token: string, botInfo?: UserFromGetMe): Bot<BotContext> {
  const bot = new Bot<BotContext>(token, { client: { timeoutSeconds: 30 }, botInfo })

  bot.use(session<SessionData, BotContext>({ initial: () => ({}), storage: mongoSessionStorage, getSessionKey: sessionKey }))

  bot.command('start', startCommand)
  bot.command('stats', statsCommand)
  bot.command('link', linkCommand)
  bot.command('flashcard', flashcardStart)
  bot.command('games', gamesStart)
  bot.command('cancel', async ctx => {
    // Like the old ConversationHandler fallbacks: ends whichever conversation is open.
    if (ctx.session.flashcard) await applyFlashcard(ctx, flashcardCancel)
    else if (ctx.session.games) await applyGames(ctx, gamesCancel)
  })

  bot.on('callback_query:data', async ctx => {
    if (await flashcardCallback(ctx)) return
    if (await gamesCallback(ctx)) return
    // Button from a finished/expired conversation: just stop the loading spinner.
    await ctx.answerCallbackQuery().catch(() => undefined)
  })

  bot.on('message:text', async ctx => {
    if (ctx.message.text.startsWith('/')) return
    await gamesText(ctx)
  })

  bot.catch(err => console.error(`Telegram update ${err.ctx.update.update_id} failed:`, err.error))
  return bot
}

/** The bot + webhook handler, or null when TELEGRAM_BOT_TOKEN is not set. */
export function getTelegramBot(): BotCache | null {
  const token = (process.env.TELEGRAM_BOT_TOKEN ?? '').trim()
  if (!token) return null
  if (g.__practiceHubBot?.token !== token) {
    const bot = createBot(token)
    const handle = webhookCallback(bot, 'std/http', {
      secretToken: process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || undefined,
      // Stay below the function's maxDuration so Telegram gets an answer and does not retry forever.
      timeoutMilliseconds: 50_000,
      onTimeout: 'return',
    })
    g.__practiceHubBot = { token, bot, handle }
  }
  return g.__practiceHubBot
}

export const telegramWebhookUrl = () => {
  const base = (process.env.TELEGRAM_WEBHOOK_URL ?? '').trim().replace(/\/+$/, '')
  return base ? `${base}/api/telegram/webhook` : null
}
