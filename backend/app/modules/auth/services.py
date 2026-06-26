import os
from datetime import datetime, timedelta
from uuid import uuid4

import bcrypt
import jwt
from fastapi import HTTPException

from app.models import database as db

JWT_SECRET = os.getenv("JWT_SECRET", "change-this-secret-in-production")
JWT_ALGORITHM = "HS256"
TOKEN_EXPIRE_DAYS = 7


def _get_users_collection():
    if not db.is_available():
        raise HTTPException(status_code=503, detail="Database is not available")
    coll = db.users_collection()
    if coll is None:
        raise HTTPException(status_code=503, detail="Users collection is not available")
    return coll


def _public_user(user: dict) -> dict:
    return {
        "id": user.get("id"),
        "email": user.get("email"),
        "name": user.get("name"),
        "role": user.get("role", "pending"),
    }


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


def create_access_token(user: dict) -> str:
    now = datetime.utcnow()
    payload = {
        "sub": user["id"],
        "email": user["email"],
        "role": user.get("role", "pending"),
        "iat": now,
        "exp": now + timedelta(days=TOKEN_EXPIRE_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Authentication token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid authentication token")


def find_user_by_id(user_id: str | None) -> dict | None:
    if not user_id or not db.is_available():
        return None
    coll = db.users_collection()
    if coll is None:
        return None
    return coll.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})


def register_user(email: str, password: str, name: str) -> dict:
    email = email.strip().lower()
    name = name.strip()
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="A valid email is required")
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")

    coll = _get_users_collection()
    if coll.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="Email is already registered")

    user = {
        "id": str(uuid4()),
        "email": email,
        "name": name,
        "password_hash": hash_password(password),
        "role": "pending",
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }
    coll.insert_one(user)
    return _public_user(user)


def login_user(email: str, password: str) -> dict:
    coll = _get_users_collection()
    user = coll.find_one({"email": email.strip().lower()})
    if not user or not verify_password(password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    public_user = _public_user(user)
    return {"token": create_access_token(user), "user": public_user}


def seed_approved_user():
    if not db.is_available():
        return
    coll = db.users_collection()
    if coll is None:
        return

    email = "tri@gmail.com"
    now = datetime.utcnow().isoformat()
    existing = coll.find_one({"email": email})
    if existing:
        updates = {
            "password_hash": hash_password("minhtri123"),
            "role": "approved",
            "updated_at": now,
        }
        coll.update_one({"email": email}, {"$set": updates})
        return

    coll.insert_one({
        "id": str(uuid4()),
        "email": email,
        "name": "Tri",
        "password_hash": hash_password("minhtri123"),
        "role": "approved",
        "created_at": now,
        "updated_at": now,
    })
