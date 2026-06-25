import json
from pathlib import Path
from functools import lru_cache
import fitz  # PyMuPDF
from fastapi import HTTPException
from app.models import database as db
from app.modules.tests.services import find_book_pdf_path

@lru_cache(maxsize=1)
def load_all_layouts() -> dict:
    repo_root = Path(__file__).resolve().parents[4]
    layout_path = repo_root / "backend" / "config" / "cambridge_all_layouts.json"
    if layout_path.exists():
        try:
            return json.loads(layout_path.read_text(encoding="utf-8"))
        except Exception as e:
            print(f"Error loading layout JSON: {e}")
    return {}

def get_practice_layout_dict(book: int, test: int):
    if db.is_available():
        coll = db.layouts_collection()
        if coll is not None:
            doc = coll.find_one({"book": book, "test": test}, {"_id": 0})
            if doc and "layout" in doc:
                return doc["layout"]
    
    layouts = load_all_layouts()
    book_str = str(book)
    test_str = str(test)
    if book_str in layouts and test_str in layouts[book_str]:
        return layouts[book_str][test_str]
    return None

def get_test_answers_dict(book: int, test: int, skill: str = None) -> dict:
    if db.is_available():
        coll = db.answers_collection()
        if coll is not None:
            doc = coll.find_one({"book": book, "test": test}, {"_id": 0})
            if doc:
                if skill and skill in doc:
                    return doc[skill]
                elif "answers" in doc:
                    return doc["answers"]
    return {}

@lru_cache(maxsize=128)
def get_pdf_page_bytes(book: int, page_number: int, pdf_type: str = "academic") -> bytes:
    from app.r2_client import get_file_bytes
    try:
        pdf_key = find_book_pdf_path(book, pdf_type)
        pdf_bytes = get_file_bytes(pdf_key)
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=404, detail=f"Cambridge IELTS {book} PDF not found")
        
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        page_num_actual = min(max(1, page_number), len(doc))
        page = doc[page_num_actual - 1]
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
        png_bytes = pix.tobytes("png")
        doc.close()
        return png_bytes
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@lru_cache(maxsize=64)
def get_pdf_part_bytes(book: int, pdf_type: str, test: int, part_key: str) -> bytes:
    layout = get_practice_layout_dict(book, test)
    pages = []
    if layout:
        if part_key.startswith("listening_"):
            sec_num = int(part_key.split("_")[1])
            item = next((x for x in layout.get("listening", []) if x["section"] == sec_num), None)
            if item: pages = item["pages"]
        elif part_key.startswith("reading_q_"):
            pas_num = int(part_key.split("_")[2])
            item = next((x for x in layout.get("reading", []) if x["passage"] == pas_num), None)
            if item and item.get("groups"):
                 pages = list(set([g["page"] for g in item["groups"]]))
                 pages.sort()
        elif part_key.startswith("reading_"):
            pas_num = int(part_key.split("_")[1])
            item = next((x for x in layout.get("reading", []) if x["passage"] == pas_num), None)
            if item: pages = item["passage_pages"]
        elif part_key.startswith("writing_"):
            task_num = int(part_key.split("_")[1])
            item = next((x for x in layout.get("writing", []) if x["task"] == task_num), None)
            if item: pages = item["pages"]
        elif part_key == "speaking":
            item = layout.get("speaking", [None])[0]
            if item: pages = item["pages"]

    if not pages:
        raise HTTPException(status_code=404, detail=f"Part {part_key} not mapped or found for Book {book} Test {test}")

    from app.r2_client import get_file_bytes
    try:
        pdf_key = find_book_pdf_path(book, pdf_type)
        pdf_bytes = get_file_bytes(pdf_key)
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=404, detail=f"Cambridge IELTS {book} PDF not found")
        
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
    segments = []
    for p in pages:
        page_num_actual = min(max(1, p), len(doc))
        page_h = doc[page_num_actual - 1].rect.height
        segments.append({"page": page_num_actual, "y_start": 0.0, "y_end": page_h})
            
    first_page_num = min(max(1, segments[0]["page"]), len(doc))
    width = doc[first_page_num - 1].rect.width
    
    total_height = 0.0
    valid_segments = []
    for seg in segments:
        p_num = min(max(1, seg["page"]), len(doc))
        page_h = doc[p_num - 1].rect.height
        y_s = max(0.0, float(seg.get("y_start", 0.0)))
        y_e = float(seg.get("y_end", page_h))
        y_e = min(page_h, y_e)
        
        h = y_e - y_s
        if h > 0:
            total_height += h
            valid_segments.append((p_num, y_s, y_e, h))
            
    if not valid_segments or total_height <= 0:
        doc.close()
        raise HTTPException(status_code=400, detail="Invalid segments for stitching")
        
    out_doc = fitz.open()
    new_page = out_doc.new_page(width=width, height=total_height)
    
    curr_y = 0.0
    for p_num, y_s, y_e, h in valid_segments:
        dest_rect = fitz.Rect(0.0, curr_y, width, curr_y + h)
        clip_rect = fitz.Rect(0.0, y_s, width, y_e)
        new_page.show_pdf_page(dest_rect, doc, p_num - 1, clip=clip_rect)
        curr_y += h
        
    pix = new_page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
    png_bytes = pix.tobytes("png")
    
    doc.close()
    out_doc.close()
    return png_bytes
