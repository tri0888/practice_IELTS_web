from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    ContextTypes,
    ConversationHandler,
    CommandHandler,
    CallbackQueryHandler,
)
from app.modules.telegram.services import get_user_id_by_telegram
from app.modules.vocabulary import services as vocab_services

# Conversation States
SELECT_FOCUS, SELECT_POS, SELECT_SIZE, PLAY_CARDS = range(4)

async def flashcard_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    telegram_id = update.effective_user.id
    user_id = get_user_id_by_telegram(telegram_id)
    
    if not user_id:
        await update.message.reply_text(
            "⚠️ Bạn chưa liên kết tài khoản web.\n"
            "Vui lòng dùng lệnh: /link <email> <password> để liên kết trước."
        )
        return ConversationHandler.END
        
    context.user_data["user_id"] = user_id
    
    # Step 1: Select Focus
    text = (
        "📚 *Flashcard Practice*\n"
        "━━━━━━━━━━━━━━━━━━━\n\n"
        "Chọn Practice Focus:"
    )
    keyboard = [
        [
            InlineKeyboardButton("🔀 Random", callback_data="focus:random"),
            InlineKeyboardButton("📖 Studied Words", callback_data="focus:studied")
        ]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    await update.message.reply_text(text, reply_markup=reply_markup, parse_mode="Markdown")
    return SELECT_FOCUS

async def focus_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    
    focus = query.data.split(":")[1]
    context.user_data["fc_focus"] = focus
    
    # Check if studied count is 0
    if focus == "studied":
        user_id = context.user_data.get("user_id")
        stats = vocab_services.get_stats(user_id)
        if stats.get("studied_count", 0) == 0:
            await query.edit_message_text(
                "⚠️ Bạn chưa có từ nào trong mục Studied Words.\n"
                "Hãy chọn Random để học từ mới trước.",
                reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("🔙 Quay lại", callback_data="fc_restart")]])
            )
            return SELECT_FOCUS

    # Step 2: Select POS
    vocab_services.ensure_vocab_loaded()
    pos_list = vocab_services.unique_pos
    
    focus_label = "Random" if focus == "random" else "Studied Words"
    text = (
        "📚 *Flashcard Practice*\n"
        "━━━━━━━━━━━━━━━━━━━\n"
        f"✅ Focus: {focus_label}\n\n"
        "Chọn Word Type:"
    )
    
    keyboard = [[InlineKeyboardButton("📋 All Types", callback_data="pos:all")]]
    row = []
    for p in pos_list:
        row.append(InlineKeyboardButton(p, callback_data=f"pos:{p}"))
        if len(row) == 3:
            keyboard.append(row)
            row = []
    if row:
        keyboard.append(row)
        
    reply_markup = InlineKeyboardMarkup(keyboard)
    await query.edit_message_text(text, reply_markup=reply_markup, parse_mode="Markdown")
    return SELECT_POS

async def pos_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    
    pos = query.data.split(":")[1]
    context.user_data["fc_pos"] = "" if pos == "all" else pos
    
    focus_label = "Random" if context.user_data["fc_focus"] == "random" else "Studied Words"
    pos_label = "All Types" if pos == "all" else pos
    
    # Step 3: Select Size
    text = (
        "📚 *Flashcard Practice*\n"
        "━━━━━━━━━━━━━━━━━━━\n"
        f"✅ Focus: {focus_label}\n"
        f"✅ Word Type: {pos_label}\n\n"
        "Chọn Deck Size:"
    )
    keyboard = [
        [
            InlineKeyboardButton("15 cards", callback_data="size:15"),
            InlineKeyboardButton("20 cards", callback_data="size:20"),
            InlineKeyboardButton("30 cards", callback_data="size:30")
        ]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    await query.edit_message_text(text, reply_markup=reply_markup, parse_mode="Markdown")
    return SELECT_SIZE

async def size_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    
    size = int(query.data.split(":")[1])
    context.user_data["fc_size"] = size
    
    user_id = context.user_data.get("user_id")
    focus = context.user_data.get("fc_focus")
    pos = context.user_data.get("fc_pos")
    
    # Fetch practice words
    deck = vocab_services.get_practice_words(
        user_id=user_id,
        mode=focus,
        pos=pos if pos else None,
        limit=size
    )
    
    if not deck:
        await query.edit_message_text(
            "⚠️ Không tìm thấy từ vựng phù hợp với bộ lọc đã chọn (không tính từ Mastered).\n"
            "Vui lòng thử cấu hình khác.",
            reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("🔙 Quay lại bắt đầu", callback_data="fc_restart")]])
        )
        return SELECT_FOCUS
        
    context.user_data["fc_deck"] = deck
    context.user_data["fc_index"] = 0
    
    await show_card(query, context)
    return PLAY_CARDS

async def show_card(query, context: ContextTypes.DEFAULT_TYPE):
    deck = context.user_data["fc_deck"]
    index = context.user_data["fc_index"]
    user_id = context.user_data["user_id"]
    
    word_item = deck[index]
    vocab = word_item.get("vocab", "")
    pron = word_item.get("pronunciation", "")
    pos = word_item.get("POS", "")
    definition = word_item.get("definition", "")
    
    # Auto mark as learning if unlearned
    if word_item.get("status") == "unlearned":
        try:
            vocab_services.update_progress(user_id=user_id, vocab=vocab, status="learning")
        except Exception:
            pass # ignore if db fails temporarily

    text = (
        f"📝 *Card {index + 1}/{len(deck)}*\n"
        "━━━━━━━━━━━━\n"
        f"*{vocab}*\n"
        f"{pron} • {pos}\n"
        f"💡 {definition}"
    )
    
    # Button logic: Next or Finish
    is_last = (index == len(deck) - 1)
    btn_text = "✅ Finish" if is_last else "⏭ Next"
    btn_data = "fc:finish" if is_last else "fc:next"
    
    keyboard = [[InlineKeyboardButton(btn_text, callback_data=btn_data)]]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await query.edit_message_text(text, reply_markup=reply_markup, parse_mode="Markdown")

async def card_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    
    action = query.data
    deck = context.user_data.get("fc_deck", [])
    index = context.user_data.get("fc_index", 0)
    
    if action == "fc:next":
        context.user_data["fc_index"] = index + 1
        await show_card(query, context)
        return PLAY_CARDS
    elif action == "fc:finish":
        # Show end screen
        text = (
            "🎉 *Session Complete!*\n"
            "━━━━━━━━━━━━━━━━━━━\n"
            f"📚 Đã ôn tập hoàn thành {len(deck)} từ vựng!\n"
            "Tiến trình của bạn đã được cập nhật tự động lên hệ thống."
        )
        keyboard = [
            [
                InlineKeyboardButton("🔄 New Session", callback_data="fc_restart"),
                InlineKeyboardButton("🔙 Thoát", callback_data="fc_quit")
            ]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await query.edit_message_text(text, reply_markup=reply_markup, parse_mode="Markdown")
        return PLAY_CARDS # wait for restart or quit
        
    return PLAY_CARDS

async def fc_restart_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    
    # Step 1: Select Focus again
    text = (
        "📚 *Flashcard Practice*\n"
        "━━━━━━━━━━━━━━━━━━━\n\n"
        "Chọn Practice Focus:"
    )
    keyboard = [
        [
            InlineKeyboardButton("🔀 Random", callback_data="focus:random"),
            InlineKeyboardButton("📖 Studied Words", callback_data="focus:studied")
        ]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    await query.edit_message_text(text, reply_markup=reply_markup, parse_mode="Markdown")
    return SELECT_FOCUS

async def fc_cancel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    # Handler for Cancel commands
    if update.message:
        await update.message.reply_text("👋 Đã thoát khỏi phiên ôn tập Flashcard.")
    elif update.callback_query:
        query = update.callback_query
        await query.answer()
        await query.edit_message_text("👋 Đã kết thúc phiên ôn tập Flashcard.")
    return ConversationHandler.END

flashcard_handler = ConversationHandler(
    entry_points=[CommandHandler("flashcard", flashcard_start)],
    states={
        SELECT_FOCUS: [
            CallbackQueryHandler(focus_callback, pattern="^focus:"),
            CallbackQueryHandler(fc_restart_callback, pattern="^fc_restart$"),
            CallbackQueryHandler(fc_cancel, pattern="^fc_quit$")
        ],
        SELECT_POS: [
            CallbackQueryHandler(pos_callback, pattern="^pos:"),
            CallbackQueryHandler(fc_restart_callback, pattern="^fc_restart$")
        ],
        SELECT_SIZE: [
            CallbackQueryHandler(size_callback, pattern="^size:"),
            CallbackQueryHandler(fc_restart_callback, pattern="^fc_restart$")
        ],
        PLAY_CARDS: [
            CallbackQueryHandler(card_callback, pattern="^fc:"),
            CallbackQueryHandler(fc_restart_callback, pattern="^fc_restart$"),
            CallbackQueryHandler(fc_cancel, pattern="^fc_quit$")
        ]
    },
    fallbacks=[
        CommandHandler("cancel", fc_cancel),
        CallbackQueryHandler(fc_cancel, pattern="^fc_quit$")
    ]
)

