from fastapi import APIRouter, Request, Response, status
from telegram import Update
from . import bot as telegram_bot

router = APIRouter(prefix="/api/telegram", tags=["Telegram"])

@router.post("/webhook")
async def telegram_webhook(request: Request):
    """
    Receives JSON updates from Telegram API and feeds them into the bot application.
    """
    if telegram_bot.application is None:
        return Response(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, 
            content="Telegram bot application is not initialized"
        )
        
    try:
        data = await request.json()
        update = Update.de_json(data, telegram_bot.application.bot)
        await telegram_bot.application.process_update(update)
    except Exception as e:
        print(f"Error processing telegram webhook update: {str(e)}")
        return {"status": "error", "message": str(e)}
        
    return {"status": "ok"}

