import os
from pymongo import MongoClient, errors


MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("MONGODB_DB", "ielts_platform_dev")


def get_client():
    try:
        client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=2000)
        # trigger server selection
        client.server_info()
        return client
    except errors.ServerSelectionTimeoutError:
        return None


_client = get_client()
_db = _client[DB_NAME] if _client is not None else None


def is_available() -> bool:
    return _db is not None


def tests_collection():
    return _db["tests"] if _db is not None else None


def attempts_collection():
    return _db["attempts"] if _db is not None else None


def users_collection():
    return _db["users"] if _db is not None else None


def audio_collection():
    return _db["audio_assets"] if _db is not None else None


def layouts_collection():
    return _db["layouts"] if _db is not None else None


def answers_collection():
    return _db["answers"] if _db is not None else None
