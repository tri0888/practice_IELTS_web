/**
 * Register the bot webhook (the Python backend did this on startup; serverless has no startup hook).
 *
 *   npm run telegram:webhook            set TELEGRAM_WEBHOOK_URL + /api/telegram/webhook
 *   npm run telegram:webhook -- --info  show the current webhook
 *   npm run telegram:webhook -- --delete
 *
 * If TELEGRAM_WEBHOOK_SECRET is set (recommended), Telegram sends it with every
 * update and the API rejects requests without it.
 */
import { Api } from 'grammy'
import { flag } from './_env'
import { telegramWebhookUrl } from '../src/modules/telegram/bot'

async function main() {
  const token = (process.env.TELEGRAM_BOT_TOKEN ?? '').trim()
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not set')
  const api = new Api(token)

  if (flag('info')) return console.log(await api.getWebhookInfo())
  if (flag('delete')) {
    await api.deleteWebhook()
    return console.log('Webhook deleted.')
  }

  const url = telegramWebhookUrl()
  if (!url) throw new Error('TELEGRAM_WEBHOOK_URL is not set (e.g. https://your-app.vercel.app)')
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || undefined
  await api.setWebhook(url, { secret_token: secret, allowed_updates: ['message', 'callback_query'] })
  console.log(`Telegram webhook set to: ${url}${secret ? ' (with secret token)' : ''}`)
}

main().then(() => process.exit(0), err => {
  console.error(`ERROR: ${(err as Error).message}`)
  process.exit(1)
})
