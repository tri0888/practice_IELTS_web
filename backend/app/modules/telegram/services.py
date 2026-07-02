import re
from datetime import datetime
from app.models import database as db
from app.modules.auth import services as auth_services
from app.modules.vocabulary import services as vocab_services

def link_telegram_account(telegram_id: int, email: str, password: str) -> dict:
    """
    Links a Telegram user ID to an existing web account.
    """
    email_clean = email.strip().lower()
    
    if not db.is_available():
        return {"success": False, "message": "Database is not available."}
        
    users_coll = db.users_collection()
    if users_coll is None:
        return {"success": False, "message": "Users collection is not available."}
        
    user = users_coll.find_one({"email": email_clean})
    if not user:
        return {"success": False, "message": "Email không tồn tại trên hệ thống."}
        
    # Check password
    if not auth_services.verify_password(password, user.get("password_hash", "")):
        return {"success": False, "message": "Mật khẩu không chính xác."}
        
    # Check if approved
    if user.get("role") != "approved":
        return {"success": False, "message": "Tài khoản của bạn đang chờ phê duyệt, chưa được phép sử dụng."}
        
    # Save mapping
    tg_coll = db.telegram_users_collection()
    if tg_coll is None:
        return {"success": False, "message": "Telegram users collection is not available."}
        
    tg_coll.update_one(
        {"telegram_id": telegram_id},
        {"$set": {
            "telegram_id": telegram_id,
            "user_id": user["id"],
            "email": email_clean,
            "linked_at": datetime.utcnow().isoformat()
        }},
        upsert=True
    )
    
    return {"success": True, "name": user.get("name", "User")}

def get_user_id_by_telegram(telegram_id: int) -> str | None:
    """
    Retrieves the linked user_id for a given telegram_id.
    """
    if not db.is_available():
        return None
    tg_coll = db.telegram_users_collection()
    if tg_coll is None:
        return None
    doc = tg_coll.find_one({"telegram_id": telegram_id})
    return doc.get("user_id") if doc else None

def check_translation_answer(input_text: str, correct_val: str, direction: str) -> bool:
    """
    Checks if the user's answer is correct, allowing for synonym matches in EN->VI direction.
    """
    clean_input = input_text.strip().lower()
    if direction == "en":
        # EN -> VI: Check synonyms in the definition
        synonyms = re.split(r'[,;]', correct_val)
        synonyms_clean = [s.strip().lower() for s in synonyms if s.strip()]
        return clean_input in synonyms_clean or clean_input == correct_val.strip().lower()
    else:
        # VI -> EN: Strict match of vocabulary word
        return clean_input == correct_val.strip().lower()

def format_clue(word: dict, direction: str) -> str:
    """
    Formats clue string based on direction.
    """
    pron = word.get("pronunciation", "")
    pos = word.get("POS", "")
    
    if direction == "en":
        # Translate to VI: Show pronunciation and type
        return f"📖 Pronunciation: {pron}\n🔤 Type: ({pos})"
    else:
        # Translate to EN: Show first letter, length, pronunciation, and type
        vocab = word.get("vocab", "")
        if vocab:
            hint = vocab[0] + "_" * (len(vocab) - 1)
            length = len(vocab)
            return f"🔍 Hint: {hint} ({length} letters)\n📖 Pronunciation: {pron}\n🔤 Type: ({pos})"
        return "No clue available."

