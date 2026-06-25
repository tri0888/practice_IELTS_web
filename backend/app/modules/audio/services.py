from pathlib import Path
from fastapi import HTTPException

def stream_audio(file_name: str) -> str:
    from app.models import database as db
    relative_path = None
    if db.is_available():
        coll = db.audio_collection()
        if coll is not None:
            doc = coll.find_one({"file_name": file_name})
            if doc:
                relative_path = doc.get("relative_path")
                
    repo_root = Path(__file__).resolve().parents[4]
    books_dir = repo_root / "Books"
    from app.r2_client import is_r2_enabled, find_key_on_r2
    
    # In local mode, or if not found in database: scan local filesystem
    if not relative_path and not is_r2_enabled():
        if books_dir.exists():
            for p in books_dir.glob("**/Audio/*.mp3"):
                if p.name == file_name:
                    relative_path = p.relative_to(repo_root).as_posix()
                    break
            if not relative_path:
                for p in books_dir.glob("**/*.mp3"):
                    if p.name == file_name:
                        relative_path = p.relative_to(repo_root).as_posix()
                        break
                        
    # If not found locally, and R2 is enabled: search on R2
    if not relative_path and is_r2_enabled():
        matched_key = find_key_on_r2(file_name)
        if matched_key:
            return matched_key

    if not relative_path:
        raise HTTPException(status_code=404, detail=f"Audio file {file_name} not found")
        
    # Strip "Books/" prefix if present to obtain the relative key
    if relative_path.startswith("Books/"):
        relative_key = relative_path[len("Books/"):]
    else:
        relative_key = relative_path
        
    # Check if file exists (either locally or on R2)
    if not is_r2_enabled():
        if not (books_dir / relative_key).exists():
            raise HTTPException(status_code=404, detail=f"Audio file {file_name} not found")
            
    return relative_key

def list_book_audio_files(book: int):
    repo_root = Path(__file__).resolve().parents[4]
    book_audio_dir = repo_root / "Books" / "Cambridge IELTS 11-20" / f"Cam {book}" / "Audio"
    
    files = []
    if book_audio_dir.exists():
        for p in book_audio_dir.glob("**/*.mp3"):
            if "__MACOSX" not in p.parts:
                rel_path = p.relative_to(repo_root).as_posix()
                files.append({
                    "file_name": p.name,
                    "relative_path": rel_path
                })
    # Fallback to scanning everything under Books/Cambridge IELTS 11-20/Cam {book}
    if not files:
        book_dir = repo_root / "Books" / "Cambridge IELTS 11-20" / f"Cam {book}"
        if book_dir.exists():
            for p in book_dir.glob("**/*.mp3"):
                if "__MACOSX" not in p.parts:
                    rel_path = p.relative_to(repo_root).as_posix()
                    files.append({
                        "file_name": p.name,
                        "relative_path": rel_path
                    })
                    
    # Cloudflare R2 listing fallback
    if not files:
        from app.r2_client import get_r2_client, get_r2_bucket, is_r2_enabled
        if is_r2_enabled():
            try:
                client = get_r2_client()
                bucket = get_r2_bucket()
                paginator = client.get_paginator('list_objects_v2')
                prefix = f"Cambridge IELTS 11-20/Cam {book}"
                
                for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
                    for obj in page.get('Contents', []):
                        key = obj['Key']
                        if key.lower().endswith(".mp3") and "__macosx" not in key.lower():
                            files.append({
                                "file_name": Path(key).name,
                                "relative_path": f"Books/{key}"
                            })
            except Exception:
                pass
            
    # Sort files by name
    files.sort(key=lambda x: x["file_name"])
    return files
