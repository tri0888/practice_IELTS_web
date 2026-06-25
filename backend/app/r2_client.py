import os
import re
import boto3
from pathlib import Path
from fastapi import HTTPException

_client = None

def get_r2_client():
    global _client
    if _client is None:
        account_id = os.getenv("R2_ACCOUNT_ID")
        access_key_id = os.getenv("R2_ACCESS_KEY_ID")
        secret_access_key = os.getenv("R2_SECRET_ACCESS_KEY")
        if not (account_id and access_key_id and secret_access_key):
            raise HTTPException(status_code=500, detail="Cloudflare R2 credentials not fully configured in env")
        _client = boto3.client(
            "s3",
            endpoint_url=f"https://{account_id}.r2.cloudflarestorage.com",
            aws_access_key_id=access_key_id,
            aws_secret_access_key=secret_access_key,
        )
    return _client

def get_r2_bucket():
    return os.getenv("R2_BUCKET", "mybucket")

def is_r2_enabled() -> bool:
    return os.getenv("USE_R2", "false").lower() == "true"

def is_local_file(relative_key: str) -> bool:
    if is_r2_enabled():
        return False
    repo_root = Path(__file__).resolve().parents[2]
    local_path = repo_root / "Books" / relative_key
    return local_path.exists()

def get_local_file_path(relative_key: str) -> Path:
    repo_root = Path(__file__).resolve().parents[2]
    return repo_root / "Books" / relative_key

def get_r2_file_stream(relative_key: str):
    client = get_r2_client()
    bucket = get_r2_bucket()
    try:
        response = client.get_object(Bucket=bucket, Key=relative_key)
        content_type = response.get('ContentType', 'application/octet-stream')
        if content_type in ['binary/octet-stream', 'application/octet-stream']:
            if relative_key.lower().endswith('.pdf'):
                content_type = 'application/pdf'
            elif relative_key.lower().endswith('.mp3'):
                content_type = 'audio/mpeg'
        return response['Body'], content_type
    except Exception as e:
        try:
            matched_key = find_key_on_r2(relative_key)
            if matched_key:
                response = client.get_object(Bucket=bucket, Key=matched_key)
                content_type = response.get('ContentType', 'application/octet-stream')
                if content_type in ['binary/octet-stream', 'application/octet-stream']:
                    if matched_key.lower().endswith('.pdf'):
                        content_type = 'application/pdf'
                    elif matched_key.lower().endswith('.mp3'):
                        content_type = 'audio/mpeg'
                return response['Body'], content_type
        except Exception:
            pass
        raise HTTPException(status_code=404, detail=f"File {relative_key} not found on Cloudflare R2: {e}")

def get_file_bytes(relative_key: str) -> bytes:
    if not is_r2_enabled():
        local_path = get_local_file_path(relative_key)
        if local_path.exists():
            return local_path.read_bytes()
        raise FileNotFoundError(f"Local file {relative_key} not found")
        
    client = get_r2_client()
    bucket = get_r2_bucket()
    try:
        response = client.get_object(Bucket=bucket, Key=relative_key)
        return response['Body'].read()
    except Exception as e:
        try:
            matched_key = find_key_on_r2(relative_key)
            if matched_key:
                response = client.get_object(Bucket=bucket, Key=matched_key)
                return response['Body'].read()
        except Exception:
            pass
        raise FileNotFoundError(f"File {relative_key} not found on Cloudflare R2: {e}")

def find_key_on_r2(target_key: str) -> str:
    client = get_r2_client()
    bucket = get_r2_bucket()
    
    paginator = client.get_paginator('list_objects_v2')
    
    cam_match = re.search(r'Cam[bridge]*\s*(\d+)', target_key, re.IGNORECASE)
    book_num = cam_match.group(1) if cam_match else None
    
    target_parts = [p.lower() for p in target_key.split("/")]
    
    for page in paginator.paginate(Bucket=bucket):
        for obj in page.get('Contents', []):
            key = obj['Key']
            key_lower = key.lower()
            
            if key_lower == target_key.lower():
                return key
                
            if book_num and "cambridge" in key_lower and key_lower.endswith(".pdf"):
                if f"cam {book_num}" in key_lower or f"cambridge {book_num}" in key_lower or f"cambridge_{book_num}" in key_lower or f"cambridge-{book_num}" in key_lower:
                    is_solution_target = "solution" in target_key.lower()
                    is_solution_key = "solution" in key_lower
                    if is_solution_target == is_solution_key:
                        return key
                        
            if key_lower.endswith(".mp3") and target_key.lower().endswith(".mp3"):
                target_filename = target_parts[-1]
                key_filename = key_lower.split("/")[-1]
                if target_filename == key_filename:
                    target_test_match = re.search(r'test_?(\d+)', target_key.lower())
                    key_test_match = re.search(r'test_?(\d+)', key_lower)
                    
                    target_test = int(target_test_match.group(1)) if target_test_match else None
                    key_test = int(key_test_match.group(1)) if key_test_match else None
                    
                    target_year_match = re.search(r'ets_?(\d{4})', target_key.lower())
                    key_year_match = re.search(r'ets_?(\d{4})', key_lower)
                    
                    target_year = target_year_match.group(1) if target_year_match else None
                    key_year = key_year_match.group(1) if key_year_match else None
                    
                    target_book_match = re.search(r'cam_?(\d+)', target_key.lower())
                    key_book_match = re.search(r'cam_?(\d+)', key_lower)
                    target_book = target_book_match.group(1) if target_book_match else None
                    key_book = key_book_match.group(1) if key_book_match else None
                    
                    if target_test == key_test and target_year == key_year and target_book == key_book:
                        return key
    return None
