import re
import fitz  # PyMuPDF
from fastapi import HTTPException
from app.models import database as db
from app.modules.tests.services import find_book_pdf_path
from app.modules.practice.services import get_practice_layout_dict, get_test_answers_dict, get_pdf_part_bytes

def admin_get_test_info(book: int, test: int):
    layout = get_practice_layout_dict(book, test)
    answers = get_test_answers_dict(book, test)
    audio = []
    if db.is_available():
        coll = db.audio_collection()
        if coll is not None:
            audio = list(coll.find({"book": book, "test_number": test}, {"_id": 0}))
    return {
        "book": book,
        "test": test,
        "layout": layout,
        "answers": answers,
        "audio_assets": audio
    }

def admin_update_layout(book: int, test: int, layout: dict):
    if not db.is_available():
        raise HTTPException(status_code=503, detail="DB not available")
    coll = db.layouts_collection()
    coll.update_one({"book": book, "test": test}, {"$set": {"layout": layout}}, upsert=True)
    
    # Clear stitched parts in-memory cache
    get_pdf_part_bytes.cache_clear()
    
    return {"status": "ok"}

def admin_update_answers(book: int, test: int, answers: dict):
    if not db.is_available():
        raise HTTPException(status_code=503, detail="DB not available")
    coll = db.answers_collection()
    coll.update_one({"book": book, "test": test}, {"$set": {"answers": answers}}, upsert=True)
    return {"status": "ok"}

def admin_update_audio(book: int, test: int, audio_assets: list):
    if not db.is_available():
        raise HTTPException(status_code=503, detail="DB not available")
    coll = db.audio_collection()
    coll.delete_many({"book": book, "test_number": test})
    for a in audio_assets:
        # Avoid mutating MongoDB _id key if it exists in input
        a_copy = dict(a)
        a_copy.pop("_id", None)
        a_copy["book"] = book
        a_copy["test_number"] = test
        coll.insert_one(a_copy)
    return {"status": "ok"}

def extract_answers(book: int, test: int, page_number: int, skill: str):
    from app.r2_client import get_file_bytes
    try:
        pdf_key = find_book_pdf_path(book, "solution")
        pdf_bytes = get_file_bytes(pdf_key)
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=404, detail=f"Cambridge IELTS {book} PDF not found")
        
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        page_num_actual = min(max(1, page_number), len(doc))
        page = doc[page_num_actual - 1]
        text = page.get_text("text")
        doc.close()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
    extracted = {}
    lines = text.split("\n")
    pattern = re.compile(r"^\s*(\d+)[\.\)]?\s+(.+)$")
    for line in lines:
        line = line.strip()
        m = pattern.match(line)
        if m:
            q_num = int(m.group(1))
            ans_text = m.group(2).strip()
            if q_num >= 1 and q_num <= 40:
                extracted[str(q_num)] = ans_text
                
    return {"extracted": extracted, "raw_text": text}
