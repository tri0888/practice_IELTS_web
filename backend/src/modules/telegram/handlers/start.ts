import { getStats } from '../../vocabulary/services'
import { getUserIdByTelegram, linkTelegramAccount } from '../services'
import type { BotContext } from '../session'
import { MD, NOT_LINKED } from '../ui'

export async function startCommand(ctx: BotContext) {
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

export async function statsCommand(ctx: BotContext) {
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

export async function linkCommand(ctx: BotContext) {
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
  const text = res.success
    ? `✅ Đã liên kết tài khoản web thành công!\n👤 Tài khoản: ${res.name} (${email})\n` +
      'Giờ đây bạn có thể bắt đầu sử dụng lệnh /flashcard và /games.'
    : `❌ Liên kết thất bại: ${"message" in res ? res.message : ""}`

  try {
    if (status) await ctx.api.editMessageText(status.chat.id, status.message_id, text)
    else await ctx.reply(text)
  } catch (err) {
    console.error('Failed to reply link result:', err)
  }
  // The password should not stay in the chat history.
  await ctx.deleteMessage().catch(() => undefined)
}
