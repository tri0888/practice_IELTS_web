from pathlib import Path
from fastapi import HTTPException
def stream_audio(file_name: str) -> str:
    from app.models import database as db
    relative_path = None
    
    # If the file_name is a subpath, try to resolve it directly using MongoDB
    if "/" in file_name or "\\" in file_name:
        file_name_clean = file_name.replace("\\", "/").strip("/")
        if db.is_available():
            is_toeic = "ets" in file_name_clean.lower() or "toeic" in file_name_clean.lower()
            coll = db.toeic_audio_collection() if is_toeic else db.audio_collection()
            if coll is not None:
                doc = coll.find_one({"$or": [
                    {"relative_path": f"Books/{file_name_clean}"},
                    {"relative_path": file_name_clean}
                ]})
                if doc:
                    relative_path = doc.get("relative_path")
        if not relative_path:
            relative_path = file_name_clean
    else:
        # Fallback to legacy single filename match
        if db.is_available():
            is_toeic = "ets" in file_name.lower() or "toeic" in file_name.lower()
            coll = db.toeic_audio_collection() if is_toeic else db.audio_collection()
            if coll is not None:
                doc = coll.find_one({"file_name": file_name})
                if doc:
                    relative_path = doc.get("relative_path")
                    
    repo_root = Path(__file__).resolve().parents[4]
    books_dir = repo_root / "Books"
    from app.modules.r2_client import is_r2_enabled
    
    # In local mode, or if not found in database: scan local filesystem
    if not relative_path and not is_r2_enabled():
        # extract plain filename for wildcard glob scanning if slashes present
        plain_filename = file_name.split("/")[-1].split("\\")[-1]
        if books_dir.exists():
            for p in books_dir.glob("**/Audio/*.mp3"):
                if p.name == plain_filename:
                    relative_path = p.relative_to(repo_root).as_posix()
                    break
            if not relative_path:
                for p in books_dir.glob("**/*.mp3"):
                    if p.name == plain_filename:
                        relative_path = p.relative_to(repo_root).as_posix()
                        break
                        
    # If not found locally/DB, and R2 is enabled: use file_name directly as key
    if not relative_path and is_r2_enabled():
        relative_path = file_name

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
