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
