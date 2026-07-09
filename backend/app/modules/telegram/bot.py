import os
import asyncio
import threading
from telegram.ext import Application, CommandHandler
from telegram.request import HTTPXRequest
from app.modules.telegram.handlers.start import start_command, stats_command
from app.modules.telegram.handlers.link import link_command
from app.modules.telegram.handlers.flashcard import flashcard_handler
from app.modules.telegram.handlers.games import games_handler

# Global application instance
application = None

async def init_telegram_bot():
    """
    Initializes the Telegram bot and registers handlers, then sets the webhook URL if provided.
    """
    global application
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    if not token or not token.strip():
        print("WARNING: TELEGRAM_BOT_TOKEN is not set or empty in .env. Skipping Telegram Bot initialization.")
        return
        
    try:
        # Build application
        request = HTTPXRequest(connect_timeout=30.0, read_timeout=30.0)
        application = Application.builder().token(token.strip()).request(request).build()
        
        # Register command handlers
        application.add_handler(CommandHandler("start", start_command))
        application.add_handler(CommandHandler("stats", stats_command))
        application.add_handler(CommandHandler("link", link_command))
        
        # Register conversation handlers
        application.add_handler(flashcard_handler)
        application.add_handler(games_handler)
        
        # Initialize and start
        await application.initialize()
        await application.start()
        print("Telegram Bot application initialized.")
        
        # Set Webhook URL if provided
        webhook_base = os.getenv("TELEGRAM_WEBHOOK_URL")
        if not webhook_base or not webhook_base.strip():
            print("WARNING: TELEGRAM_WEBHOOK_URL is not set in .env. Webhook endpoint will not receive updates.")
        elif os.getenv("TELEGRAM_SET_WEBHOOK", "true").strip().lower() not in ("1", "true", "yes"):
            print("TELEGRAM_SET_WEBHOOK is disabled. Skipping webhook registration (set it manually).")
        else:
            webhook_url = f"{webhook_base.strip().rstrip('/')}/api/telegram/webhook"
            
            try:
                info = await application.bot.get_webhook_info()
                current_url = getattr(info, "url", "") or ""
            except Exception as e:
                print(f"Could not fetch current webhook info ({e}); will set webhook anyway.")
                current_url = ""

            if current_url == webhook_url:
                print(f"Telegram Bot webhook already set to: {webhook_url}. Skipping.")
            else:
                await application.bot.set_webhook(url=webhook_url)
                print(f"Telegram Bot webhook set successfully to: {webhook_url}")
            
    except Exception as e:
        print(f"Error initializing Telegram Bot: {str(e)}")

async def shutdown_telegram_bot():
    """
    Cleans up the bot webhook connection and shuts down application resources safely.
    """
    global application
    if application:
        try:
            print("Deleting Telegram webhook...")
            await application.bot.delete_webhook()
            await application.stop()
            await application.shutdown()
            print("Telegram Bot application shut down successfully.")
        except Exception as e:
            print(f"Error during Telegram Bot shutdown: {str(e)}")

