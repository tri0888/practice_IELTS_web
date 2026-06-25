import re
from pathlib import Path
import fitz  # PyMuPDF
from fastapi import HTTPException
from app.models import database as db

def find_book_pdf_path(book: int, pdf_type: str = "academic") -> str:
    file_suffix = " Solution" if pdf_type == "solution" else ""
    standard_key = f"Cambridge IELTS 11-20/Cam {book}/Cambridge {book}{file_suffix}.pdf"
    
    from app.modules.r2_client import is_r2_enabled
    if is_r2_enabled():
        return standard_key
        
    # Local mode:
    repo_root = Path(__file__).resolve().parents[4]
    books_dir = repo_root / "Books"
    
    # Check standard local path
    local_path = books_dir / standard_key
    if local_path.exists():
        return standard_key
        
    # Scan locally fallback
    if books_dir.exists():
        for p in books_dir.rglob("*.pdf"):
            if "__MACOSX" not in p.parts:
                if f"Cam {book}" in p.parts or f"Cambridge {book}" in p.name or f"Cambridge-{book}" in p.name or f"Cambridge_{book}" in p.name:
                    return p.relative_to(books_dir).as_posix()
                    
    raise HTTPException(status_code=404, detail=f"Cambridge IELTS {book} PDF not found")

def list_tests():
    if db.is_available():
        coll = db.tests_collection()
        if coll is not None:
            return list(coll.find({}, {"book": 1, "test_number": 1, "sections": 1, "_id": 0}))
    return []

def get_pdf_page_count(book: int, pdf_type: str = "academic"):
    try:
        from app.modules.r2_client import get_file_bytes
        pdf_key = find_book_pdf_path(book, pdf_type)
        pdf_bytes = get_file_bytes(pdf_key)
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        page_count = len(doc)
        doc.close()
        return {"book": book, "pdf_type": pdf_type, "page_count": page_count}
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=404, detail=f"Cambridge IELTS {book} PDF not found")

def get_test(book: int, test: int):
    if db.is_available():
        coll = db.tests_collection()
        if coll is not None:
            doc = coll.find_one({"book": book, "test_number": test}, {"_id": 0})
            if doc:
                return doc
    raise HTTPException(status_code=404, detail="test not found")
def get_test_audio(book: int, test: int):
    if db.is_available():
        coll = db.audio_collection()
        if coll is not None:
            results = list(coll.find({"book": book, "test_number": test}, {"_id": 0}))
            for doc in results:
                rel_path = doc.get("relative_path", "")
                if rel_path.startswith("Books/"):
                    doc["file_name"] = rel_path[len("Books/"):]
                elif rel_path:
                    doc["file_name"] = rel_path
            return results
    return []
def get_skill(book: int, test: int, skill: str):
    t = get_test(book, test)
    for s in t.get("sections", []):
        if s.get("name", "").lower().startswith(skill.lower()[:7]):
            return s
    raise HTTPException(status_code=404, detail="skill not found")

def get_ets_pdf_path(pdf_type: str, test_number: int, year: str = "2026") -> str:
    pdf_type_upper = pdf_type.upper()
    standard_keys = [
        f"ETS 24-26/ETS {year}/ETS-{year}-{pdf_type_upper}/TEST_{test_number:02d}.pdf",
        f"ETS 24-26/ETS {year}/ETS-{year}-{pdf_type_upper}/TEST_{test_number}.pdf",
        f"ETS {year}/ETS-{year}-{pdf_type_upper}/TEST_{test_number:02d}.pdf"
    ]
    
    from app.modules.r2_client import is_r2_enabled
    if is_r2_enabled():
        return standard_keys[0]
        
    # Local mode:
    repo_root = Path(__file__).resolve().parents[4]
    books_dir = repo_root / "Books"
    
    for key in standard_keys:
        if (books_dir / key).exists():
            return key
            
    # Scan local books directory
    if books_dir.exists():
        ets_sub = books_dir / "ETS 24-26" / f"ETS {year}"
        if not ets_sub.exists():
            ets_sub = books_dir / f"ETS {year}"
        if ets_sub.exists():
            for p in ets_sub.rglob("*.pdf"):
                if f"TEST_{test_number:02d}" in p.name or f"TEST_{test_number}" in p.name or f"Test_{test_number:02d}" in p.name or f"test_{test_number}" in p.name:
                    if pdf_type_upper in p.parts or pdf_type_upper in p.name or pdf_type.lower() in p.name:
                        return p.relative_to(books_dir).as_posix()
                        
    raise HTTPException(status_code=404, detail=f"ETS {year} {pdf_type_upper} Test {test_number} PDF not found")

def get_ets_audio_dir(year: str, test_number: int) -> Path:
    repo_root = Path(__file__).resolve().parents[4]
    ets_dir = repo_root / "Books" / "ETS 24-26" / f"ETS {year}"
    
    patterns = [
        f"Test_{test_number:02d}",
        f"test_{test_number:02d}",
        f"TEST_{test_number:02d}",
        f"Test {test_number}",
        f"test {test_number}",
        f"TEST {test_number}"
    ]
    for p in patterns:
        audio_dir = ets_dir / "AUDIO" / p
        if audio_dir.exists():
            return audio_dir
            
    for p in patterns:
        audio_dir = repo_root / "Books" / f"ETS {year}" / "AUDIO" / p
        if audio_dir.exists():
            return audio_dir
            
    return ets_dir / "AUDIO" / f"Test {test_number}"

def get_ets_audio_list(test_number: int, year: str = "2026") -> list[str]:
    audio_dir = get_ets_audio_dir(year, test_number)
    files = []
    if audio_dir.exists():
        files = [f.name for f in audio_dir.glob("*.mp3") if f.is_file()]
        
    if not files:
        from app.modules.r2_client import get_r2_client, get_r2_bucket, is_r2_enabled
        if is_r2_enabled():
            try:
                client = get_r2_client()
                bucket = get_r2_bucket()
                paginator = client.get_paginator('list_objects_v2')
                prefixes = [
                    f"ETS 24-26/ETS {year}/AUDIO/Test_{test_number:02d}/",
                    f"ETS 24-26/ETS {year}/AUDIO/TEST_{test_number:02d}/",
                    f"ETS 24-26/ETS {year}/AUDIO/Test {test_number}/",
                    f"ETS {year}/AUDIO/Test_{test_number:02d}/",
                    f"ETS {year}/AUDIO/Test {test_number}/"
                ]
                for prefix in prefixes:
                    for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
                        for obj in page.get('Contents', []):
                            key = obj['Key']
                            if key.lower().endswith(".mp3") and "__macosx" not in key.lower():
                                files.append(Path(key).name)
                    if files:
                        break
            except Exception:
                pass
            
    def natural_sort_key(s):
        return [int(text) if text.isdigit() else text.lower() for text in re.split(r'(\d+)', s)]
    
    files.sort(key=natural_sort_key)
    return files

def get_ets_audio_file_path(test_number: int, file_name: str, year: str = "2026") -> str:
    standard_keys = [
        f"ETS 24-26/ETS {year}/AUDIO/Test_{test_number:02d}/{file_name}",
        f"ETS 24-26/ETS {year}/AUDIO/TEST_{test_number:02d}/{file_name}",
        f"ETS 24-26/ETS {year}/AUDIO/Test {test_number}/{file_name}",
        f"ETS {year}/AUDIO/Test_{test_number:02d}/{file_name}",
        f"ETS {year}/AUDIO/Test {test_number}/{file_name}"
    ]
    
    from app.modules.r2_client import is_r2_enabled
    if is_r2_enabled():
        return standard_keys[0]
        
    # Local mode:
    repo_root = Path(__file__).resolve().parents[4]
    books_dir = repo_root / "Books"
    
    for key in standard_keys:
        if (books_dir / key).exists():
            return key
            
    if books_dir.exists():
        audio_dir = get_ets_audio_dir(year, test_number)
        if audio_dir.exists():
            audio_path = audio_dir / file_name
            if audio_path.exists():
                return audio_path.relative_to(books_dir).as_posix()
                
    raise HTTPException(status_code=404, detail=f"ETS {year} Audio Test {test_number} File {file_name} not found")

def get_ets_answers(pdf_type: str, test_number: int, year: str = "2026") -> dict:
    import json
    repo_root = Path(__file__).resolve().parents[4]
    answers_json = repo_root / "backend" / "config" / f"ets_{year}_answers.json"
    
    if not answers_json.exists():
        return {"test": test_number, "type": pdf_type, "answers": {}}
        
    try:
        data = json.loads(answers_json.read_text(encoding="utf-8"))
        test_data = data.get(str(test_number), {})
        answers = test_data.get(pdf_type.lower(), {})
        return {"test": test_number, "type": pdf_type, "answers": answers}
    except Exception as e:
        print(f"Error loading ETS answers: {e}")
        return {"test": test_number, "type": pdf_type, "answers": {}}


