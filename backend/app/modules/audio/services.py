from pathlib import Path
from fastapi import HTTPException

def stream_audio(file_name: str):
    from app.models import database as db
    relative_path = None
    if db.is_available():
        coll = db.audio_collection()
        if coll is not None:
            doc = coll.find_one({"file_name": file_name})
            if doc:
                relative_path = doc.get("relative_path")
                
    repo_root = Path(__file__).resolve().parents[4]
    
    if not relative_path:
        # Fallback: scan Books directory for this file_name
        books_dir = repo_root / "Books"
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
                        
    if not relative_path:
        raise HTTPException(status_code=404, detail="audio not found")
        
    audio_path = repo_root / relative_path
    if not audio_path.exists():
        raise HTTPException(status_code=404, detail="audio file missing")
    return audio_path

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
    # Sort files by name
    files.sort(key=lambda x: x["file_name"])
    return files
