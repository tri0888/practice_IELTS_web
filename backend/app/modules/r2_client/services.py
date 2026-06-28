import os
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
    repo_root = Path(__file__).resolve().parents[4]
    local_path = repo_root / "Books" / relative_key
    return local_path.exists()

def get_local_file_path(relative_key: str) -> Path:
    repo_root = Path(__file__).resolve().parents[4]
    return repo_root / "Books" / relative_key

def _resolve_key(relative_key: str) -> str | None:
    """Tra MongoDB r2_keys, trả về matched_key hoặc None nếu không tìm thấy."""
    from app.models import database as db

    if not db.is_available():
        return None

    coll = db.r2_keys_collection()
    if coll is None:
        return None

    cached = coll.find_one({"target_key": relative_key})
    if cached:
        matched = cached.get("matched_key") or ""
        return matched if matched else None
    return None

def get_r2_file_stream(relative_key: str):
    client = get_r2_client()
    bucket = get_r2_bucket()

    def _fetch(key: str):
        response = client.get_object(Bucket=bucket, Key=key)
        content_type = response.get("ContentType", "application/octet-stream")
        if content_type in ("binary/octet-stream", "application/octet-stream"):
            if key.lower().endswith(".pdf"):
                content_type = "application/pdf"
            elif key.lower().endswith(".mp3"):
                content_type = "audio/mpeg"
        return response["Body"], content_type

    try:
        return _fetch(relative_key)
    except Exception:
        pass

    matched_key = _resolve_key(relative_key)
    if matched_key:
        try:
            return _fetch(matched_key)
        except Exception:
            pass

    raise HTTPException(status_code=404, detail=f"File not found: {relative_key}")

def get_file_bytes(relative_key: str) -> bytes:
    if not is_r2_enabled():
        local_path = get_local_file_path(relative_key)
        if local_path.exists():
            return local_path.read_bytes()
        raise FileNotFoundError(f"Local file {relative_key} not found")

    client = get_r2_client()
    bucket = get_r2_bucket()

    def _fetch(key: str) -> bytes:
        response = client.get_object(Bucket=bucket, Key=key)
        return response["Body"].read()

    try:
        return _fetch(relative_key)
    except Exception:
        pass

    matched_key = _resolve_key(relative_key)
    if matched_key:
        try:
            return _fetch(matched_key)
        except Exception:
            pass

    raise FileNotFoundError(f"File not found: {relative_key}")