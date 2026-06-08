from datetime import datetime, timedelta
from typing import Optional

from passlib.context import CryptContext
from jose import jwt

from . import db

PWD_CONTEXT = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = "dev-secret-key-change-me"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60


def create_access_token(data: dict, expires_delta: int | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=(expires_delta or ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_user(email: str, password: str) -> dict:
    users = db.users_collection()
    hashed = PWD_CONTEXT.hash(password)
    user_doc = {"email": email, "password": hashed, "created_at": datetime.utcnow()}
    if users is None:
        # fallback: raise so caller can handle
        raise RuntimeError("DB not available")
    existing = users.find_one({"email": email})
    if existing:
        raise ValueError("user exists")
    users.insert_one(user_doc)
    return user_doc


def verify_user(email: str, password: str) -> bool:
    users = db.users_collection()
    if users is None:
        return False
    user = users.find_one({"email": email})
    if not user:
        return False
    return PWD_CONTEXT.verify(password, user.get("password", ""))

