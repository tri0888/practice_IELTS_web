import type { InlineKeyboardMarkup } from 'grammy/types'
import type { BotContext } from './session'

/** Rows of [label, callback_data] -> inline keyboard. */
export const keyboard = (rows: [string, string][][]): InlineKeyboardMarkup => ({
  inline_keyboard: rows.map(row => row.map(([text, callback_data]) => ({ text, callback_data }))),
})

/** Lay buttons out `perRow` at a time. */
export function grid(buttons: [string, string][], perRow: number): [string, string][][] {
  const rows: [string, string][][] = []
  for (let i = 0; i < buttons.length; i += perRow) rows.push(buttons.slice(i, i + perRow))
  return rows
}

export const MD = { parse_mode: 'Markdown' as const }

export const NOT_LINKED =
  '⚠️ Bạn chưa liên kết tài khoản web.\n' +
  'Vui lòng dùng lệnh: /link <email> <password> để liên kết trước.'

/** Edit the message that carries the pressed inline button. */
export const edit = (ctx: BotContext, text: string, reply_markup?: InlineKeyboardMarkup) =>
  ctx.editMessageText(text, { ...MD, reply_markup })

/** Telegram rejects edits that change nothing; those are harmless. */
export const ignoreTelegramError = () => undefined
