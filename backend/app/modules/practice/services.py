import json
from pathlib import Path
from functools import lru_cache
import fitz  # PyMuPDF
from fastapi import HTTPException
from app.models import database as db
from app.modules.tests.services import find_book_pdf_path


def is_toeic(book: int) -> bool:
    """Single source of the exam-type rule: TOEIC 'books' are encoded as their
    exam year (e.g. 2026), while IELTS Cambridge books use small numbers (11-20)."""
    return book >= 2000

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

@lru_cache(maxsize=1)
def load_ets_layouts() -> dict:
    repo_root = Path(__file__).resolve().parents[4]
    layout_path = repo_root / "backend" / "config" / "ETS_all_layouts.json"
    if layout_path.exists():
        try:
            return json.loads(layout_path.read_text(encoding="utf-8"))
        except Exception as e:
            print(f"Error loading ETS layout JSON: {e}")
    return {}

import threading

_pdf_cache = {}
_download_lock = threading.Lock()

def get_pdf_bytes_cached(pdf_key: str) -> bytes:
    if pdf_key in _pdf_cache:
        return _pdf_cache[pdf_key]
        
    with _download_lock:
        if pdf_key in _pdf_cache:
            return _pdf_cache[pdf_key]
            
        from app.modules.r2_client import is_r2_enabled
        if is_r2_enabled():
            from app.modules.r2_client import get_r2_file_stream
            stream, _ = get_r2_file_stream(pdf_key)
            data = stream.read()
        else:
            from app.modules.r2_client import get_file_bytes
            data = get_file_bytes(pdf_key)
            
        _pdf_cache[pdf_key] = data
        return data

def get_practice_layout_dict(book: int, test: int):
    if db.is_available():
        if is_toeic(book):
            coll = db.toeic_layouts_collection()
        else:
            coll = db.layouts_collection()
        if coll is not None:
            doc = coll.find_one({"book": book, "test": test}, {"_id": 0})
            if doc and "layout" in doc:
                return doc["layout"]

    if is_toeic(book):
        ets_layouts_data = load_ets_layouts()
        year_key = f"ETS {book}"
        if year_key in ets_layouts_data:
            lc_list = ets_layouts_data[year_key].get("lc", [])
            rc_list = ets_layouts_data[year_key].get("rc", [])
            
            lc_item = next((item for item in lc_list if item.get("test") == test), None)
            rc_item = next((item for item in rc_list if item.get("test") == test), None)
            
            if lc_item and rc_item:
                return {
                    "listening": [
                        { "section": 1, "pages": list(range(lc_item["part1"][0], lc_item["part1"][1] + 1)) },
                        { "section": 2, "pages": list(range(lc_item["part2"][0], lc_item["part2"][1] + 1)) },
                        { "section": 3, "pages": list(range(lc_item["part3"][0], lc_item["part3"][1] + 1)) },
                        { "section": 4, "pages": list(range(lc_item["part4"][0], lc_item["part4"][1] + 1)) }
                    ],
                    "reading": [
                        { "passage": 5, "passage_pages": list(range(rc_item["part5"][0], rc_item["part5"][1] + 1)) },
                        { "passage": 6, "passage_pages": list(range(rc_item["part6"][0], rc_item["part6"][1] + 1)) },
                        { "passage": 7, "passage_pages": list(range(rc_item["part7"][0], rc_item["part7"][1] + 1)) }
                    ]
                }
        return None
    
    layouts = load_all_layouts()
    book_str = str(book)
    test_str = str(test)
    if book_str in layouts and test_str in layouts[book_str]:
        return layouts[book_str][test_str]
    return None

def get_test_answers_dict(book: int, test: int, skill: str = None) -> dict:
    if db.is_available():
        if is_toeic(book):
            coll = db.toeic_answers_collection()
        else:
            coll = db.answers_collection()
        if coll is not None:
            doc = coll.find_one({"book": book, "test": test}, {"_id": 0})
            if doc:
                if skill and skill in doc:
                    return doc[skill]
                elif "answers" in doc:
                    return doc["answers"]
    return {}

def resolve_part_pages(layout: dict, part_key: str) -> list[int]:
    """Map a practice ``part_key`` (e.g. ``listening_2``, ``reading_1``,
    ``reading_all``, ``writing_1``, ``speaking``) to the ordered list of PDF
    page numbers for that part, using the given practice layout."""
    pages: list[int] = []
    if not layout:
        return pages

    if part_key.startswith("listening_"):
        try:
            sec_num = int(part_key.split("_")[1])
            item = next((x for x in layout.get("listening", []) if x["section"] == sec_num), None)
            if item: pages = item["pages"]
        except ValueError:
            if part_key == "listening_all":
                for x in layout.get("listening", []):
                    pages.extend(x.get("pages", []))
    elif part_key.startswith("reading_q_"):
        pas_num = int(part_key.split("_")[2])
        item = next((x for x in layout.get("reading", []) if x["passage"] == pas_num), None)
        if item and item.get("groups"):
            pages = list(set([g["page"] for g in item["groups"]]))
            pages.sort()
    elif part_key.startswith("reading_"):
        try:
            pas_num = int(part_key.split("_")[1])
            item = next((x for x in layout.get("reading", []) if x["passage"] == pas_num), None)
            if item: pages = item["passage_pages"]
        except ValueError:
            if part_key == "reading_all":
                for x in layout.get("reading", []):
                    pages.extend(x.get("passage_pages", []))
    elif part_key.startswith("writing_"):
        task_num = int(part_key.split("_")[1])
        item = next((x for x in layout.get("writing", []) if x["task"] == task_num), None)
        if item: pages = item["pages"]
    elif part_key == "speaking":
        item = layout.get("speaking", [None])[0]
        if item: pages = item["pages"]

    return pages

def get_pdf_part_file(book: int, pdf_type: str, test: int, part_key: str) -> bytes:
    layout = get_practice_layout_dict(book, test)
    pages = resolve_part_pages(layout, part_key)

    if not pages:
        raise HTTPException(status_code=404, detail=f"Part {part_key} not mapped or found for Book {book} Test {test}")

    try:
        if is_toeic(book):
            from app.modules.tests.services import get_ets_pdf_path
            pdf_key = get_ets_pdf_path(pdf_type, test, str(book))
        else:
            pdf_key = find_book_pdf_path(book, pdf_type)
        pdf_bytes = get_pdf_bytes_cached(pdf_key)
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=404, detail=f"PDF not found: {str(e)}")
        
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        out_doc = fitz.open()
        
        for p in pages:
            page_num_actual = min(max(1, p), len(doc))
            out_doc.insert_pdf(doc, from_page=page_num_actual - 1, to_page=page_num_actual - 1)
            
        pdf_out_bytes = out_doc.write()
        doc.close()
        out_doc.close()
        return pdf_out_bytes
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def get_pdf_page_file(book: int, page_number: int, pdf_type: str = "academic", test: int = 1) -> bytes:
    try:
        if is_toeic(book):
            from app.modules.tests.services import get_ets_pdf_path
            pdf_key = get_ets_pdf_path(pdf_type, test, str(book))
        else:
            pdf_key = find_book_pdf_path(book, pdf_type)
        pdf_bytes = get_pdf_bytes_cached(pdf_key)
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=404, detail=f"PDF not found: {str(e)}")
        
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        out_doc = fitz.open()
        
        page_num_actual = min(max(1, page_number), len(doc))
        out_doc.insert_pdf(doc, from_page=page_num_actual - 1, to_page=page_num_actual - 1)
        
        pdf_out_bytes = out_doc.write()
        doc.close()
        out_doc.close()
        return pdf_out_bytes
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

