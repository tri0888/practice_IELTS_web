from telegram import Update
from telegram.ext import ContextTypes
from app.modules.telegram.services import link_telegram_account

async def link_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    try:
        telegram_id = update.effective_user.id
        
        # Check arguments
        args = context.args
        if not args or len(args) < 2:
            try:
                await update.message.reply_text(
                    "⚠️ Sử dụng sai định dạng lệnh.\n"
                    "Cú pháp đúng: `/link <email> <password>`\n"
                    "Ví dụ: `/link tri@gmail.com minhtri123`"
                )
            except Exception as te:
                print(f"Failed to send argument hint: {str(te)}")
            return
            
        email = args[0]
        password = args[1]
        
        status_msg = None
        try:
            status_msg = await update.message.reply_text("⏳ Đang xác thực thông tin liên kết...")
        except Exception as te:
            print(f"Failed to send status message: {str(te)}")
            
        res = link_telegram_account(telegram_id, email, password)
        if res.get("success"):
            success_text = (
                f"✅ Đã liên kết tài khoản web thành công!\n"
                f"👤 Tài khoản: {res.get('name')} ({email})\n"
                f"Giờ đây bạn có thể bắt đầu sử dụng lệnh /flashcard và /games."
            )
            try:
                if status_msg:
                    await status_msg.edit_text(success_text)
                else:
                    await update.message.reply_text(success_text)
            except Exception as te:
                print(f"Failed to reply link success: {str(te)}")
        else:
            fail_text = f"❌ Liên kết thất bại: {res.get('message')}"
            try:
                if status_msg:
                    await status_msg.edit_text(fail_text)
                else:
                    await update.message.reply_text(fail_text)
            except Exception as te:
                print(f"Failed to reply link failure: {str(te)}")
    except Exception as e:
        print(f"General error in link_command: {str(e)}")


