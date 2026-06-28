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
        coll = db.layouts_collection()
        if coll is not None:
            docs = list(coll.find({}, {"book": 1, "test": 1, "layout": 1, "_id": 0}))
            results = []
            for doc in docs:
                book = doc.get("book")
                test_number = doc.get("test")
                layout = doc.get("layout", {})
                sections = [{"name": skill} for skill in ["listening", "reading", "writing", "speaking"] if skill in layout]
                results.append({
                    "book": book,
                    "test_number": test_number,
                    "sections": sections
                })
            return results
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
        coll = db.layouts_collection()
        if coll is not None:
            doc = coll.find_one({"book": book, "test": test}, {"_id": 0})
            if doc:
                layout = doc.get("layout", {})
                sections = [{"name": skill} for skill in ["listening", "reading", "writing", "speaking"] if skill in layout]
                return {
                    "book": book,
                    "test_number": test,
                    "sections": sections
                }
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
    coll = db.toeic_audio_collection()
    if coll is None:
        return []
    results = list(coll.find({"book": int(year), "test_number": test_number}, {"file_name": 1, "_id": 0}))
    files = [r["file_name"] for r in results]
    
    def natural_sort_key(s):
        return [int(text) if text.isdigit() else text.lower() for text in re.split(r'(\d+)', s)]
    
    files.sort(key=natural_sort_key)
    return files

def get_ets_audio_file_path(test_number: int, file_name: str, year: str = "2026") -> str:
    coll = db.toeic_audio_collection()
    if coll is not None:
        doc = coll.find_one({"book": int(year), "test_number": test_number, "file_name": file_name})
        if doc and "relative_path" in doc:
            return doc["relative_path"]
    raise HTTPException(status_code=404, detail=f"ETS {year} Audio Test {test_number} File {file_name} not found")

def get_ets_answers(pdf_type: str, test_number: int, year: str = "2026") -> dict:
    coll = db.toeic_answers_collection()
    if coll is None:
        return {"test": test_number, "type": pdf_type, "answers": {}}
    doc = coll.find_one({"book": int(year), "test": test_number})
    if doc:
        field_name = "listening" if pdf_type.lower() in ("lc", "listening") else "reading"
        answers = doc.get(field_name, {})
        simple_answers = {}
        for q_num, ans_obj in answers.items():
            if isinstance(ans_obj, dict):
                simple_answers[q_num] = ans_obj.get("answer", "")
            else:
                simple_answers[q_num] = ans_obj
        return {"test": test_number, "type": pdf_type, "answers": simple_answers}
    return {"test": test_number, "type": pdf_type, "answers": {}}

def list_toeic_tests() -> list:
    if db.is_available():
        coll = db.toeic_layouts_collection()
        if coll is not None:
            docs = list(coll.find({}, {"book": 1, "test": 1, "layout": 1, "_id": 0}))
            results = []
            for doc in docs:
                book = doc.get("book")
                test_number = doc.get("test")
                layout = doc.get("layout", {})
                sections = [{"name": skill} for skill in ["listening", "reading"] if skill in layout]
                results.append({
                    "book": book,
                    "test_number": test_number,
                    "sections": sections
                })
            return results
    return []



