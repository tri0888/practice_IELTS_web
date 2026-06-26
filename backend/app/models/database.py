import os
import re
from pymongo import MongoClient, errors
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

def get_formatted_mongodb_uri():
    uri = os.getenv("MONGODB_URI")
    if not uri:
        return None
        
    password = os.getenv("DB_PASSWORD")
    db_name = os.getenv("DB_NAME")
    
    # 1. Replace the password in the URI if DB_PASSWORD is provided
    if password:
        scheme_match = re.match(r'^(mongodb(?:\+srv)?://)(.*)$', uri)
        if scheme_match:
            scheme, rest = scheme_match.groups()
            if '@' in rest:
                user_info, host_info = rest.split('@', 1)
                if ':' in user_info:
                    username, _ = user_info.split(':', 1)
                    uri = f"{scheme}{username}:{password}@{host_info}"
                else:
                    uri = f"{scheme}{user_info}:{password}@{host_info}"
                    
    # 2. Replace or append the database name in the URI path if DB_NAME is provided
    if db_name:
        scheme_match = re.match(r'^(mongodb(?:\+srv)?://)(.*)$', uri)
        if scheme_match:
            scheme, rest = scheme_match.groups()
            path_part = rest
            query_part = ""
            if '?' in rest:
                path_part, query_part = rest.split('?', 1)
                
            if '/' in path_part:
                host_part, _ = path_part.split('/', 1)
                path_part = f"{host_part}/{db_name}"
            else:
                path_part = f"{path_part}/{db_name}"
                
            uri = f"{scheme}{path_part}"
            if query_part:
                uri = f"{uri}?{query_part}"
                
    return uri

MONGODB_URI = get_formatted_mongodb_uri()
DB_NAME = os.getenv("DB_NAME", "ielts_platform_dev")

def get_client():
    try:
        client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=2000)
        client.server_info()
        return client
    except errors.ServerSelectionTimeoutError:
        return None

_client = get_client()
_db = _client[DB_NAME] if _client is not None else None

def is_available() -> bool:
    return _db is not None

def tests_collection():
    return _db["ielts_tests"] if _db is not None else None

def histories_collection():
    return _db["histories"] if _db is not None else None

def users_collection():
    return _db["users"] if _db is not None else None

def audio_collection():
    return _db["ielts_audio_assets"] if _db is not None else None

def layouts_collection():
    return _db["ielts_layouts"] if _db is not None else None

def answers_collection():
    return _db["ielts_answers"] if _db is not None else None

# TOEIC collections
def toeic_tests_collection():
    return _db["toeic_tests"] if _db is not None else None

def toeic_audio_collection():
    return _db["toeic_audio_assets"] if _db is not None else None

def toeic_layouts_collection():
    return _db["toeic_layouts"] if _db is not None else None

def toeic_answers_collection():
    return _db["toeic_answers"] if _db is not None else None
