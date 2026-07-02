from telegram import Update
from telegram.ext import ContextTypes
from app.modules.telegram.services import get_user_id_by_telegram
from app.modules.vocabulary import services as vocab_services

async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = (
        "👋 Chào mừng đến IELTS Vocabulary Bot!\n\n"
        "Các lệnh có sẵn:\n"
        "/link <email> <password> — Liên kết tài khoản web\n"
        "/flashcard — Ôn tập từ vựng bằng flashcard\n"
        "/games — Chơi game luyện từ vựng\n"
        "/stats — Xem thống kê học tập\n\n"
        "⚠️ Hãy dùng /link trước để liên kết tài khoản của bạn."
    )
    await update.message.reply_text(text)

async def stats_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    telegram_id = update.effective_user.id
    user_id = get_user_id_by_telegram(telegram_id)
    
    if not user_id:
        await update.message.reply_text(
            "⚠️ Bạn chưa liên kết tài khoản web.\n"
            "Vui lòng dùng lệnh: /link <email> <password> để liên kết trước."
        )
        return
        
    try:
        stats = vocab_services.get_stats(user_id)
        text = (
            "📊 *Thống kê học tập của bạn:*\n"
            "━━━━━━━━━━━━━━━━━━━\n"
            f"📚 Tổng số từ hệ thống: {stats.get('total_words', 0)}\n"
            f"✅ Số từ đã thuộc (Mastered): {stats.get('mastered_count', 0)}\n"
            f"📖 Số từ đang học (Learning): {stats.get('learning_count', 0)}\n"
            f"✍️ Tổng số từ đã luyện tập (Studied): {stats.get('studied_count', 0)}\n"
            f"🎯 Tỷ lệ chính xác: {stats.get('accuracy', 0)}%\n"
            f"📈 Số câu đúng/sai: {stats.get('total_correct', 0)} / {stats.get('total_wrong', 0)}"
        )
        await update.message.reply_text(text, parse_mode="Markdown")
    except Exception as e:
        await update.message.reply_text(f"⚠️ Đã có lỗi xảy ra khi lấy thống kê: {str(e)}")

