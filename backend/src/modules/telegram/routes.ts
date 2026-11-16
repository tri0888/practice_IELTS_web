import { Hono } from 'hono'
import { getTelegramBot } from './bot'

/** /api/telegram — Telegram posts updates here (register it with `npm run telegram:webhook`). */
export const telegramRoutes = new Hono().post('/webhook', async c => {
  const telegram = getTelegramBot()
  if (!telegram) return c.text('Telegram bot application is not initialized', 503)
  return telegram.handle(c.req.raw)
})
