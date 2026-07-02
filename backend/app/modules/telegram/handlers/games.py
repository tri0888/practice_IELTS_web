import random
import asyncio
from datetime import datetime
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    ContextTypes,
    ConversationHandler,
    CommandHandler,
    CallbackQueryHandler,
    MessageHandler,
    filters,
)
from app.modules.telegram.services import (
    get_user_id_by_telegram,
    check_translation_answer,
    format_clue,
)
from app.modules.vocabulary import services as vocab_services

# Conversation States
SELECT_GAME, SELECT_SCOPE, SELECT_POS, SELECT_SIZE, PLAY_TRANSLATION, PLAY_MATCHING = range(6)

async def games_start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    telegram_id = update.effective_user.id
    user_id = get_user_id_by_telegram(telegram_id)
    
    if not user_id:
        await update.message.reply_text(
            "⚠️ Bạn chưa liên kết tài khoản web.\n"
            "Vui lòng dùng lệnh: /link <email> <password> để liên kết trước."
        )
        return ConversationHandler.END
        
    context.user_data["user_id"] = user_id
    
    text = (
        "🎮 *Vocabulary Games*\n"
        "━━━━━━━━━━━━━━━━━━\n\n"
        "Chọn game bạn muốn chơi:"
    )
    keyboard = [
        [InlineKeyboardButton("📝 Translation Quiz", callback_data="game:translation")],
        [InlineKeyboardButton("⚡ Match Pairs", callback_data="game:matching")]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    await update.message.reply_text(text, reply_markup=reply_markup, parse_mode="Markdown")
    return SELECT_GAME

async def game_type_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    
    game_type = query.data.split(":")[1]
    context.user_data["game_type"] = game_type
    
    # Step 1: Select Scope
    game_label = "Translation Quiz" if game_type == "translation" else "Match Pairs"
    text = (
        f"⚙️ *Game Config — {game_label}*\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
        "Chọn Vocabulary Scope:"
    )
    keyboard = [
        [
            InlineKeyboardButton("📋 All Words", callback_data="scope:random"),
            InlineKeyboardButton("📖 Studied Only", callback_data="scope:studied")
        ]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    await query.edit_message_text(text, reply_markup=reply_markup, parse_mode="Markdown")
    return SELECT_SCOPE

async def scope_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    
    scope = query.data.split(":")[1]
    context.user_data["game_scope"] = scope
    
    # Check if studied count is 0
    if scope == "studied":
        user_id = context.user_data.get("user_id")
        stats = vocab_services.get_stats(user_id)
        if stats.get("studied_count", 0) == 0:
            await query.edit_message_text(
                "⚠️ Bạn chưa có từ nào trong mục Studied Words.\n"
                "Hãy chọn All Words để luyện tập trước.",
                reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("🔙 Quay lại", callback_data="g_restart")]])
            )
            return SELECT_GAME
            
    # Step 2: Select POS
    vocab_services.ensure_vocab_loaded()
    pos_list = vocab_services.unique_pos
    
    game_label = "Translation Quiz" if context.user_data["game_type"] == "translation" else "Match Pairs"
    scope_label = "All Words" if scope == "random" else "Studied Only"
    
    text = (
        f"⚙️ *Game Config — {game_label}*\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"✅ Scope: {scope_label}\n\n"
        "Chọn Word Type:"
    )
    
    keyboard = [[InlineKeyboardButton("📋 All Types", callback_data="g_pos:all")]]
    row = []
    for p in pos_list:
        row.append(InlineKeyboardButton(p, callback_data=f"g_pos:{p}"))
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
    context.user_data["game_pos"] = "" if pos == "all" else pos
    
    game_type = context.user_data["game_type"]
    scope_label = "All Words" if context.user_data["game_scope"] == "random" else "Studied Only"
    pos_label = "All Types" if pos == "all" else pos
    
    if game_type == "translation":
        # Step 3: Select Size
        text = (
            "⚙️ *Game Config — Translation Quiz*\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"✅ Scope: {scope_label}\n"
            f"✅ Word Type: {pos_label}\n\n"
            "Chọn Session Length:"
        )
        keyboard = [
            [
                InlineKeyboardButton("15 Qs", callback_data="g_size:15"),
                InlineKeyboardButton("20 Qs", callback_data="g_size:20"),
                InlineKeyboardButton("30 Qs", callback_data="g_size:30")
            ]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await query.edit_message_text(text, reply_markup=reply_markup, parse_mode="Markdown")
        return SELECT_SIZE
    else:
        # Match Pairs has fixed 6 words, start immediately
        return await start_matching_game(query, context)

async def size_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    
    size = int(query.data.split(":")[1])
    context.user_data["game_size"] = size
    
    # Start Translation Game
    return await start_translation_game(query, context)

# ----------------------------------------------------
# Game 1: Translation Quiz logic
# ----------------------------------------------------
async def start_translation_game(query, context: ContextTypes.DEFAULT_TYPE) -> int:
    user_id = context.user_data["user_id"]
    scope = context.user_data["game_scope"]
    pos = context.user_data["game_pos"]
    size = context.user_data["game_size"]
    
    deck = vocab_services.get_practice_words(
        user_id=user_id,
        mode=scope,
        pos=pos if pos else None,
        limit=size
    )
    
    if not deck:
        await query.edit_message_text(
            "⚠️ Không tìm thấy từ vựng phù hợp với bộ lọc (không tính từ Mastered).\n"
            "Vui lòng thử cấu hình khác.",
            reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("🔙 Quay lại bắt đầu", callback_data="g_restart")]])
        )
        return SELECT_GAME
        
    context.user_data["game_deck"] = deck
    context.user_data["game_index"] = 0
    context.user_data["correct_count"] = 0
    context.user_data["wrong_count"] = 0
    context.user_data["hint_revealed"] = False
    
    await show_translation_question(query, context)
    return PLAY_TRANSLATION

async def show_translation_question(query, context: ContextTypes.DEFAULT_TYPE):
    deck = context.user_data["game_deck"]
    index = context.user_data["game_index"]
    
    word_item = deck[index]
    vocab = word_item.get("vocab", "")
    pos = word_item.get("POS", "")
    definition = word_item.get("definition", "")
    
    # Random direction: en (EN->VI) or vi (VI->EN)
    direction = "en" if random.random() < 0.5 else "vi"
    context.user_data["q_direction"] = direction
    context.user_data["hint_revealed"] = False
    
    prev_feedback = context.user_data.pop("prev_feedback", "")
    prefix = f"{prev_feedback}\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n" if prev_feedback else ""
    
    if direction == "en":
        text = (
            f"{prefix}"
            f"📝 *Translation Quiz — Q{index + 1}/{len(deck)}*\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
            "Dịch từ tiếng Anh sang tiếng Việt:\n"
            f"🔤 *{vocab}* ({pos})\n\n"
            "💬 Gõ nghĩa tiếng Việt của từ..."
        )
    else:
        text = (
            f"{prefix}"
            f"📝 *Translation Quiz — Q{index + 1}/{len(deck)}*\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
            "Gõ từ tiếng Anh có nghĩa tiếng Việt:\n"
            f"💡 *{definition}* ({pos})\n\n"
            "💬 Gõ đúng chính tả tiếng Anh..."
        )
        
    keyboard = [[InlineKeyboardButton("💡 Show Clue", callback_data="g_action:clue")]]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    # Save message ID so we can edit it later with clue or when moving next
    msg = await query.edit_message_text(text, reply_markup=reply_markup, parse_mode="Markdown")
    context.user_data["game_message_id"] = msg.message_id


async def handle_translation_clue(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    
    if context.user_data.get("hint_revealed"):
        return
        
    context.user_data["hint_revealed"] = True
    deck = context.user_data["game_deck"]
    index = context.user_data["game_index"]
    direction = context.user_data["q_direction"]
    word_item = deck[index]
    
    clue_text = format_clue(word_item, direction)
    
    vocab = word_item.get("vocab", "")
    pos = word_item.get("POS", "")
    definition = word_item.get("definition", "")
    
    if direction == "en":
        text = (
            f"📝 *Translation Quiz — Q{index + 1}/{len(deck)}*\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
            "Dịch từ tiếng Anh sang tiếng Việt:\n"
            f"🔤 *{vocab}* ({pos})\n\n"
            f"{clue_text}\n\n"
            "💬 Gõ nghĩa tiếng Việt của từ..."
        )
    else:
        text = (
            f"📝 *Translation Quiz — Q{index + 1}/{len(deck)}*\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
            "Gõ từ tiếng Anh có nghĩa tiếng Việt:\n"
            f"💡 *{definition}* ({pos})\n\n"
            f"{clue_text}\n\n"
            "💬 Gõ đúng chính tả tiếng Anh..."
        )
        
    await query.edit_message_text(text, parse_mode="Markdown")

async def receive_translation_answer(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    telegram_id = update.effective_user.id
    user_id = context.user_data.get("user_id")
    deck = context.user_data.get("game_deck")
    index = context.user_data.get("game_index")
    direction = context.user_data.get("q_direction")
    
    if deck is None or index is None:
        return ConversationHandler.END
        
    user_answer = update.message.text
    word_item = deck[index]
    vocab = word_item.get("vocab", "")
    definition = word_item.get("definition", "")
    
    correct_val = definition if direction == "en" else vocab
    is_correct = check_translation_answer(user_answer, correct_val, direction)
    
    # Delete user's text message to keep chat clean
    try:
        await update.message.delete()
    except Exception:
        pass
        
    # Update stats
    if is_correct:
        context.user_data["correct_count"] += 1
        feedback_text = f"✅ *Chính xác!* 🎉\n*{vocab}* ↔ {definition}"
    else:
        context.user_data["wrong_count"] += 1
        feedback_text = (
            f"❌ *Chưa chính xác!*\n"
            f"Đáp án đúng: *{correct_val}*\n"
            f"*{vocab}* ↔ {definition}"
        )
        
    # Save progress to database
    try:
        vocab_services.update_progress(user_id=user_id, vocab=vocab, is_correct=is_correct)
    except Exception:
        pass
        
    # Save feedback to display in next question or final summary
    context.user_data["prev_feedback"] = feedback_text
    
    # Advance
    context.user_data["game_index"] = index + 1
    new_index = index + 1
    
    msg_id = context.user_data.get("game_message_id")
    chat_id = update.effective_chat.id
    
    # Check if game ends
    if new_index >= len(deck):
        correct = context.user_data["correct_count"]
        wrong = context.user_data["wrong_count"]
        accuracy = round((correct / len(deck)) * 100)
        
        summary_text = (
            f"{feedback_text}\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "🏆 *Translation Quiz Complete!*\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
            f"✅ Số câu đúng: {correct}\n"
            f"❌ Số câu sai: {wrong}\n"
            f"📊 Tỷ lệ chính xác: {accuracy}%\n\n"
            "Tiến trình học tập đã được cập nhật thành công!"
        )
        keyboard = [
            [
                InlineKeyboardButton("🔄 Chơi lại", callback_data="g_restart"),
                InlineKeyboardButton("🔙 Thoát", callback_data="g_quit")
            ]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await context.bot.edit_message_text(
            chat_id=chat_id,
            message_id=msg_id,
            text=summary_text,
            reply_markup=reply_markup,
            parse_mode="Markdown"
        )
        return PLAY_TRANSLATION
    else:
        class DummyQuery:
            def __init__(self, bot, chat_id, msg_id):
                self.bot = bot
                self.chat_id = chat_id
                self.msg_id = msg_id
            async def edit_message_text(self, text, reply_markup=None, parse_mode=None):
                return await self.bot.edit_message_text(
                    chat_id=self.chat_id,
                    message_id=self.msg_id,
                    text=text,
                    reply_markup=reply_markup,
                    parse_mode=parse_mode
                )
        dq = DummyQuery(context.bot, chat_id, msg_id)
        await show_translation_question(dq, context)
        return PLAY_TRANSLATION


# ----------------------------------------------------
# Game 2: Match Pairs logic
# ----------------------------------------------------
async def start_matching_game(query, context: ContextTypes.DEFAULT_TYPE) -> int:
    user_id = context.user_data["user_id"]
    scope = context.user_data["game_scope"]
    pos = context.user_data["game_pos"]
    
    deck = vocab_services.get_practice_words(
        user_id=user_id,
        mode=scope,
        pos=pos if pos else None,
        limit=6
    )
    
    if len(deck) < 6:
        await query.edit_message_text(
            f"⚠️ Không đủ từ vựng để bắt đầu (Cần 6 từ, chỉ có {len(deck)} từ).\n"
            "Vui lòng thay đổi cấu hình hoặc chọn All Words.",
            reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("🔙 Quay lại bắt đầu", callback_data="g_restart")]])
        )
        return SELECT_GAME
        
    # Construct 12 matching tiles
    tiles = []
    for idx, w in enumerate(deck[:6]):
        vocab = w.get("vocab", "")
        definition = w.get("definition", "")
        pos = w.get("POS", "")
        
        # Word tile
        tiles.append({
            "vocab": vocab,
            "text": f"{vocab} ({pos})",
            "type": "word",
            "match_id": idx,
            "matched": False
        })
        # Definition tile
        tiles.append({
            "vocab": vocab,
            "text": definition,
            "type": "def",
            "match_id": idx,
            "matched": False
        })
        
    random.shuffle(tiles)
    context.user_data["match_tiles"] = tiles
    context.user_data["match_selected"] = None  # Stores selected index
    context.user_data["match_start_time"] = datetime.utcnow()
    context.user_data["match_correct"] = 0
    context.user_data["match_msg"] = ""  # Temporary status message
    
    await display_matching_grid(query, context)
    return PLAY_MATCHING

async def display_matching_grid(query, context: ContextTypes.DEFAULT_TYPE):
    tiles = context.user_data["match_tiles"]
    selected = context.user_data["match_selected"]
    start_time = context.user_data["match_start_time"]
    elapsed = int((datetime.utcnow() - start_time).total_seconds())
    status_msg = context.user_data.get("match_msg", "")
    
    # 1. Prepare description text
    text = (
        "⚡ *Match Pairs*\n"
        "━━━━━━━━━━━━━\n\n"
        "Ghép từ tiếng Anh với nghĩa tương ứng:\n"
        f"⏱ Thời gian: {elapsed}s\n\n"
    )
    
    # Add matched ones at top
    matched_pairs = []
    matched_set = set()
    for t in tiles:
        if t["matched"] and t["match_id"] not in matched_set:
            matched_set.add(t["match_id"])
            # find corresponding word and def definition
            w_tile = [x for x in tiles if x["match_id"] == t["match_id"] and x["type"] == "word"][0]
            d_tile = [x for x in tiles if x["match_id"] == t["match_id"] and x["type"] == "def"][0]
            matched_pairs.append(f"✅ {w_tile['text']} ↔ {d_tile['text']}")
            
    if matched_pairs:
        text += "\n".join(matched_pairs) + "\n━━━━━━━━━━━━━\n\n"
        
    # List tiles
    for idx, t in enumerate(tiles):
        if t["matched"]:
            text += f"{idx + 1}. [Đã ghép ✅]\n"
        else:
            prefix = "👉 " if selected == idx else ""
            text += f"{prefix}{idx + 1}. {t['text']}\n"
            
    if status_msg:
        text += f"\n{status_msg}\n"
        
    # 2. Build keyboard
    keyboard = []
    row = []
    for idx, t in enumerate(tiles):
        if t["matched"]:
            btn_text = "✅"
        elif selected == idx:
            btn_text = f"⭐ {idx + 1}"
        else:
            btn_text = str(idx + 1)
            
        row.append(InlineKeyboardButton(btn_text, callback_data=f"match:tile:{idx}"))
        if len(row) == 6:
            keyboard.append(row)
            row = []
    if row:
        keyboard.append(row)
        
    reply_markup = InlineKeyboardMarkup(keyboard)
    await query.edit_message_text(text, reply_markup=reply_markup, parse_mode="Markdown")

async def match_tile_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    
    idx = int(query.data.split(":")[2])
    tiles = context.user_data["match_tiles"]
    selected = context.user_data["match_selected"]
    user_id = context.user_data["user_id"]
    
    if tiles[idx]["matched"]:
        return PLAY_MATCHING
        
    if selected is None:
        # Select first tile
        context.user_data["match_selected"] = idx
        context.user_data["match_msg"] = ""
        await display_matching_grid(query, context)
        return PLAY_MATCHING
        
    if selected == idx:
        # Deselect if clicked again
        context.user_data["match_selected"] = None
        context.user_data["match_msg"] = ""
        await display_matching_grid(query, context)
        return PLAY_MATCHING
        
    # Second tile selected - check match
    t1 = tiles[selected]
    t2 = tiles[idx]
    
    is_match = (t1["match_id"] == t2["match_id"] and t1["type"] != t2["type"])
    
    if is_match:
        t1["matched"] = True
        t2["matched"] = True
        context.user_data["match_selected"] = None
        context.user_data["match_correct"] += 1
        context.user_data["match_msg"] = f"✅ Ghép đúng: *{t1['vocab']}*"
        
        # Save progress to database
        try:
            vocab_services.update_progress(user_id=user_id, vocab=t1["vocab"], is_correct=True)
        except Exception:
            pass
    else:
        context.user_data["match_selected"] = None
        context.user_data["match_msg"] = "❌ Sai rồi! Hãy thử lại."
        
        # Save progress as wrong for both words
        try:
            vocab_services.update_progress(user_id=user_id, vocab=t1["vocab"], is_correct=False)
            vocab_services.update_progress(user_id=user_id, vocab=t2["vocab"], is_correct=False)
        except Exception:
            pass
            
    # Check if game ends
    all_matched = all(t["matched"] for t in tiles)
    if all_matched:
        start_time = context.user_data["match_start_time"]
        elapsed = int((datetime.utcnow() - start_time).total_seconds())
        
        summary = (
            "🏆 *Match Pairs Complete!*\n"
            "━━━━━━━━━━━━━━━━━━━━━━━\n\n"
            f"⏱ Thời gian hoàn thành: {elapsed} giây\n"
            "✅ Ghép thành công 6/6 cặp từ vựng!\n\n"
            "Tiến trình của bạn đã được ghi nhận."
        )
        keyboard = [
            [
                InlineKeyboardButton("🔄 Chơi lại", callback_data="g_restart"),
                InlineKeyboardButton("🔙 Thoát", callback_data="g_quit")
            ]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await query.edit_message_text(summary, reply_markup=reply_markup, parse_mode="Markdown")
        return PLAY_MATCHING
    else:
        await display_matching_grid(query, context)
        return PLAY_MATCHING

# ----------------------------------------------------
# General callbacks
# ----------------------------------------------------
async def g_restart_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    await query.answer()
    
    text = (
        "🎮 *Vocabulary Games*\n"
        "━━━━━━━━━━━━━━━━━━\n\n"
        "Chọn game bạn muốn chơi:"
    )
    keyboard = [
        [InlineKeyboardButton("📝 Translation Quiz", callback_data="game:translation")],
        [InlineKeyboardButton("⚡ Match Pairs", callback_data="game:matching")]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    await query.edit_message_text(text, reply_markup=reply_markup, parse_mode="Markdown")
    return SELECT_GAME

async def g_cancel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if update.message:
        await update.message.reply_text("👋 Đã thoát khỏi phòng game.")
    elif update.callback_query:
        query = update.callback_query
        await query.answer()
        await query.edit_message_text("👋 Đã kết thúc lượt chơi game.")
    return ConversationHandler.END

games_handler = ConversationHandler(
    entry_points=[CommandHandler("games", games_start)],
    states={
        SELECT_GAME: [
            CallbackQueryHandler(game_type_callback, pattern="^game:"),
            CallbackQueryHandler(g_restart_callback, pattern="^g_restart$"),
            CallbackQueryHandler(g_cancel, pattern="^g_quit$")
        ],
        SELECT_SCOPE: [
            CallbackQueryHandler(scope_callback, pattern="^scope:"),
            CallbackQueryHandler(g_restart_callback, pattern="^g_restart$")
        ],
        SELECT_POS: [
            CallbackQueryHandler(pos_callback, pattern="^g_pos:"),
            CallbackQueryHandler(g_restart_callback, pattern="^g_restart$")
        ],
        SELECT_SIZE: [
            CallbackQueryHandler(size_callback, pattern="^g_size:"),
            CallbackQueryHandler(g_restart_callback, pattern="^g_restart$")
        ],
        PLAY_TRANSLATION: [
            CallbackQueryHandler(handle_translation_clue, pattern="^g_action:clue$"),
            CallbackQueryHandler(g_restart_callback, pattern="^g_restart$"),
            CallbackQueryHandler(g_cancel, pattern="^g_quit$"),
            MessageHandler(filters.TEXT & ~filters.COMMAND, receive_translation_answer)
        ],
        PLAY_MATCHING: [
            CallbackQueryHandler(match_tile_callback, pattern="^match:tile:"),
            CallbackQueryHandler(g_restart_callback, pattern="^g_restart$"),
            CallbackQueryHandler(g_cancel, pattern="^g_quit$")
        ]
    },
    fallbacks=[
        CommandHandler("cancel", g_cancel),
        CallbackQueryHandler(g_cancel, pattern="^g_quit$")
    ]
)

