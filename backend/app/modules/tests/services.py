import re
from pathlib import Path
import fitz  # PyMuPDF
from fastapi import HTTPException
from app.models import database as db
from app import seeder

def find_book_pdf_path(book: int, pdf_type: str = "academic") -> Path:
    repo_root = Path(__file__).resolve().parents[4]
    cambridge_dir = repo_root / "Books" / "Cambridge IELTS 11-20"
    
    # 1. Direct path lookup under the expected structure
    pdf_path = cambridge_dir / f"Cam {book}" / f"Cambridge {book}.pdf"
    if pdf_path.exists():
        return pdf_path
        
    # 2. Case-insensitive rglob search fallback
    for p in repo_root.rglob("*.pdf"):
        if "__MACOSX" not in p.parts:
            # Check if directory name matches "Cam {book}" or filename matches "Cambridge {book}"
            if f"Cam {book}" in p.parts or f"Cambridge {book}" in p.name or f"Cambridge-{book}" in p.name or f"Cambridge_{book}" in p.name:
                return p
                
    raise FileNotFoundError(f"Full Cambridge IELTS {book} PDF not found")

def list_tests():
    if db.is_available():
        coll = db.tests_collection()
        return list(coll.find({}, {"book": 1, "test_number": 1, "sections": 1, "_id": 0}))
    return seeder.get_tests_list(seeder.get_seed_data())

def get_pdf_page_count(book: int, pdf_type: str = "academic"):
    try:
        pdf_path = find_book_pdf_path(book, pdf_type)
        doc = fitz.open(str(pdf_path))
        page_count = len(doc)
        doc.close()
        return {"book": book, "pdf_type": pdf_type, "page_count": page_count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def get_test(book: int, test: int):
    if db.is_available():
        coll = db.tests_collection()
        doc = coll.find_one({"book": book, "test_number": test}, {"_id": 0})
        if not doc:
            raise HTTPException(status_code=404, detail="test not found in DB")
        return doc
    t = seeder.find_test(seeder.get_seed_data(), book, test)
    if not t:
        raise HTTPException(status_code=404, detail="test not found")
    return t

def get_test_audio(book: int, test: int):
    if db.is_available():
        coll = db.audio_collection()
        return list(coll.find({"book": book, "test_number": test}, {"_id": 0}))
    return seeder.collect_audio_assets(seeder.get_seed_data(), book, test)

def get_skill(book: int, test: int, skill: str):
    t = get_test(book, test)
    for s in t.get("sections", []):
        if s.get("name", "").lower().startswith(skill.lower()[:7]):
            return s
    raise HTTPException(status_code=404, detail="skill not found")

def get_ets_pdf_path(pdf_type: str, test_number: int, year: str = "2026") -> Path:
    repo_root = Path(__file__).resolve().parents[4]
    ets_dir = repo_root / "Books" / "ETS 24-26" / f"ETS {year}"
    
    if pdf_type.lower() == "lc":
        pdf_path = ets_dir / f"ETS-{year}-LC" / f"TEST_{test_number:02d}.pdf"
    elif pdf_type.lower() == "rc":
        pdf_path = ets_dir / f"ETS-{year}-RC" / f"TEST_{test_number:02d}.pdf"
    else:
        raise HTTPException(status_code=400, detail="Invalid PDF type. Use lc or rc")
        
    if not pdf_path.exists():
        pdf_path_alt = ets_dir / f"ETS-{year}-{pdf_type.upper()}" / f"TEST_{test_number}.pdf"
        if pdf_path_alt.exists():
            return pdf_path_alt
        legacy_dir = repo_root / "Books" / f"ETS {year}"
        pdf_path_legacy = legacy_dir / f"ETS-{year}-{pdf_type.upper()}" / f"TEST_{test_number:02d}.pdf"
        if pdf_path_legacy.exists():
            return pdf_path_legacy
        raise HTTPException(status_code=404, detail=f"ETS {year} {pdf_type.upper()} Test {test_number} PDF not found")
    return pdf_path

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
    if not audio_dir.exists():
        return []
        
    files = [f.name for f in audio_dir.glob("*.mp3") if f.is_file()]
    
    def natural_sort_key(s):
        return [int(text) if text.isdigit() else text.lower() for text in re.split(r'(\d+)', s)]
    
    files.sort(key=natural_sort_key)
    return files

def get_ets_audio_file_path(test_number: int, file_name: str, year: str = "2026") -> Path:
    audio_dir = get_ets_audio_dir(year, test_number)
    audio_path = audio_dir / file_name
    if not audio_path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found")
    return audio_path

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


