from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from uuid import uuid4
from typing import List
from pathlib import Path
from functools import lru_cache

import fitz

from . import seeder, db
from .auth import create_access_token, create_user, verify_user

app = FastAPI(title="IELTS Backend - Phase1b")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

seed = seeder.load_seed()
in_memory_attempts = {}


@lru_cache(maxsize=4)
def load_test_content(book: int, test: int) -> dict | None:
    repo_root = Path(__file__).resolve().parents[2]
    content_path = repo_root / "phase0" / "output" / f"cambridge_{book}_test{test}_content.json"
    if content_path.exists():
        import json
        return json.loads(content_path.read_text(encoding="utf-8"))
    # Fallback: check for the generic content file (test 1 only for now)
    content_path = repo_root / "phase0" / "output" / f"cambridge_{book}_test1_content.json"
    if content_path.exists() and test == 1:
        import json
        return json.loads(content_path.read_text(encoding="utf-8"))
    return None


@lru_cache(maxsize=1)
def get_full_book_pdf_path() -> Path:
    repo_root = Path(__file__).resolve().parents[2]
    candidates: list[Path] = []
    for candidate in repo_root.rglob("Cambridge-IELTS-11-Academic.pdf"):
        if "__MACOSX" not in candidate.parts:
            candidates.append(candidate)
    if not candidates:
        # Fallback to book 12 or others if 11 is missing
        for candidate in repo_root.rglob("*.pdf"):
            if "__MACOSX" not in candidate.parts and "Academic" in candidate.name:
                candidates.append(candidate)
    if not candidates:
        raise FileNotFoundError("Full Cambridge IELTS PDF not found")
    return max(candidates, key=lambda path: path.stat().st_size)


def find_book_pdf_path(book: int, pdf_type: str = "academic") -> Path:
    repo_root = Path(__file__).resolve().parents[2]
    books_roots = [
        path
        for path in repo_root.iterdir()
        if path.is_dir()
        and "CAMBRIDGE IELTS" in path.name.upper()
        and "ACADEMIC" in path.name.upper()
    ]
    if not books_roots:
        return get_full_book_pdf_path()

    book_folder = books_roots[0] / f"Cambridge IELTS {book}"
    filename = f"Cambridge_IELTS_{book}_Academic.pdf"
    if pdf_type == "solution":
        filename = f"Cambridge_IELTS_{book}_Solution.pdf"

    pdf_path = book_folder / filename
    if pdf_path.exists():
        return pdf_path

    candidates = [
        path
        for path in book_folder.rglob("*.pdf")
        if "__MACOSX" not in path.parts
    ]
    if pdf_type == "solution":
        solution_candidates = [path for path in candidates if "SOLUTION" in path.name.upper()]
        if solution_candidates:
            return max(solution_candidates, key=lambda path: path.stat().st_size)

    academic_candidates = [
        path
        for path in candidates
        if "SOLUTION" not in path.name.upper() and "CHU" not in path.name.upper()
    ]
    if academic_candidates:
        return max(academic_candidates, key=lambda path: path.stat().st_size)

    return get_full_book_pdf_path()


def render_pdf_page_typed(book: int, page_number: int, pdf_type: str = "academic") -> Path:
    cache_dir = Path(__file__).resolve().parents[2] / ".cache" / "pdf-pages"
    cache_dir.mkdir(parents=True, exist_ok=True)
    output_path = cache_dir / f"cambridge{book}-{pdf_type}-page-{page_number}.png"
    if output_path.exists():
        return output_path
        
    pdf_path = find_book_pdf_path(book, pdf_type)
            
    doc = fitz.open(str(pdf_path))
    # Safeguard page index
    page_num_actual = min(max(1, page_number), len(doc))
    page = doc[page_num_actual - 1]
    pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
    pix.save(str(output_path))
    doc.close()
    return output_path


def render_pdf_page(page_number: int) -> Path:
    return render_pdf_page_typed(11, page_number, "academic")


@app.get("/")
def root():
    return {
        "service": "IELTS Backend",
        "status": "ok",
        "docs": "/docs",
        "tests_endpoint": "/api/tests",
    }


class RegisterIn(BaseModel):
    email: str
    password: str


class LoginIn(BaseModel):
    email: str
    password: str


class AttemptCreate(BaseModel):
    user_id: str | None = None
    book: int = 11
    test: int
    skill: str


class AttemptSubmit(BaseModel):
    responses: List[dict]


@app.post("/api/auth/register")
def register(data: RegisterIn):
    try:
        if not db.is_available():
            raise HTTPException(status_code=503, detail="DB not available; cannot register")
        user = create_user(data.email, data.password)
    except ValueError:
        raise HTTPException(status_code=400, detail="user exists")
    token = create_access_token({"sub": data.email})
    return {"access_token": token}


@app.post("/api/auth/login")
def login(data: LoginIn):
    if not db.is_available():
        raise HTTPException(status_code=503, detail="DB not available; cannot login")
    if not verify_user(data.email, data.password):
        raise HTTPException(status_code=401, detail="invalid credentials")
    token = create_access_token({"sub": data.email})
    return {"access_token": token}


@app.get("/api/tests")
def list_tests():
    if db.is_available():
        coll = db.tests_collection()
        docs = list(coll.find({}, {"book": 1, "test_number": 1, "sections": 1, "_id": 0}))
        return docs
    return seeder.get_tests_list(seed)


@app.get("/api/tests/{book}/{test}")
def get_test(book: int, test: int):
    if db.is_available():
        coll = db.tests_collection()
        doc = coll.find_one({"book": book, "test_number": test}, {"_id": 0})
        if not doc:
            raise HTTPException(status_code=404, detail="test not found in DB")
        return doc
    t = seeder.find_test(seed, book, test)
    if not t:
        raise HTTPException(status_code=404, detail="test not found")
    return t


@app.get("/api/tests/{book}/{test}/audio")
def get_test_audio(book: int, test: int):
    if db.is_available():
        coll = db.audio_collection()
        docs = list(coll.find({"book": book, "test_number": test}, {"_id": 0}))
        return docs
    return seeder.collect_audio_assets(seed, book, test)


@lru_cache(maxsize=1)
def load_all_layouts() -> dict:
    repo_root = Path(__file__).resolve().parents[2]
    layout_path = repo_root / "phase0" / "output" / "cambridge_all_layouts.json"
    if layout_path.exists():
        import json
        try:
            return json.loads(layout_path.read_text(encoding="utf-8"))
        except Exception as e:
            print(f"Error loading layout JSON: {e}")
    return {}


@app.get("/api/tests/{book}/{test}/practice")
def get_practice_layout(book: int, test: int):
    layouts = load_all_layouts()
    book_str = str(book)
    test_str = str(test)
    if book_str not in layouts or test_str not in layouts[book_str]:
        # Fallback layout calculation if layout mapping is not found
        try:
            from phase0.generate_perfect_layouts import BOOK_LAYOUTS
            if book in BOOK_LAYOUTS and test in BOOK_LAYOUTS[book]:
                return BOOK_LAYOUTS[book][test]
        except Exception as e:
            print(f"Fallback layout error: {e}")
        raise HTTPException(status_code=404, detail=f"Practice layout not mapped for Book {book} Test {test}")
    return layouts[book_str][test_str]


@app.get("/api/tests/{book}/{test}/content")
def get_test_content(book: int, test: int):
    """Return structured text content (passages + questions) extracted from PDF."""
    content = load_test_content(book, test)
    if not content:
        raise HTTPException(status_code=404, detail="Content not available for this test")
    return content


@app.get("/api/tests/{book}/{test}/answers")
def get_test_answers(book: int, test: int):
    """Return answer key from the seed data."""
    t = seeder.find_test(seed, book, test)
    if not t:
        raise HTTPException(status_code=404, detail="test not found")
    answers = {}
    for section in t.get("sections", []):
        for row in section.get("rows", []):
            answers[row["question_number"]] = {
                "answer": row.get("answer_text", ""),
                "explanation": row.get("explanation_text", ""),
            }
    return {"book": book, "test": test, "answers": answers}


@app.get("/api/tests/{book}/{test}/{skill}")
def get_skill(book: int, test: int, skill: str):
    t = seeder.find_test(seed, book, test)
    if not t:
        raise HTTPException(status_code=404, detail="test not found")
    for s in t.get("sections", []):
        if s.get("name", "").lower().startswith(skill.lower()[:7]):
            return s
    raise HTTPException(status_code=404, detail="skill not found")


@app.post("/api/attempts")
def start_attempt(a: AttemptCreate):
    attempt = {"user_id": a.user_id, "book": a.book, "test": a.test, "skill": a.skill, "started_at": None, "submitted_at": None, "responses": [], "result": None}
    if db.is_available():
        coll = db.attempts_collection()
        attempt_id = str(uuid4())
        attempt["id"] = attempt_id
        coll.insert_one(attempt)
        return {"id": attempt_id}
    else:
        attempt_id = str(uuid4())
        attempt["id"] = attempt_id
        in_memory_attempts[attempt_id] = attempt
        return {"id": attempt_id}


@app.put("/api/attempts/{attempt_id}/submit")
def submit_attempt(attempt_id: str, body: AttemptSubmit):
    # locate attempt either in DB or in-memory
    if db.is_available():
        coll = db.attempts_collection()
        attempt = coll.find_one({"id": attempt_id})
        if attempt is None:
            raise HTTPException(status_code=404, detail="attempt not found")
        # grade
        is_reading = attempt.get("skill", "").lower().startswith("passage") or attempt.get("skill", "").lower() == "reading"
        is_listening = attempt.get("skill", "").lower() == "listening"
        if is_reading or is_listening:
            if is_reading:
                correct = seeder.collect_reading_answers(seed, attempt.get("book", 11), attempt["test"])
            else:
                correct = seeder.collect_listening_answers(seed, attempt.get("book", 11), attempt["test"])
            total = 0
            right = 0
            for r in body.responses:
                q = int(r.get("question_number"))
                ans = str(r.get("answer", "")).strip()
                total += 1
                correct_ans = str(correct.get(q, "")).strip()
                if correct_ans and correct_ans.lower() == ans.lower():
                    right += 1
            result = {"total": total, "correct": right}
        else:
            result = {"note": "auto-grading not implemented for this skill"}
        coll.update_one({"id": attempt_id}, {"$set": {"responses": body.responses, "result": result, "submitted_at": None}})
        return {"id": attempt_id, "result": result}
    else:
        attempt = in_memory_attempts.get(attempt_id)
        if not attempt:
            raise HTTPException(status_code=404, detail="attempt not found")
        attempt["responses"] = body.responses
        is_reading = attempt.get("skill", "").lower().startswith("passage") or attempt.get("skill", "").lower() == "reading"
        is_listening = attempt.get("skill", "").lower() == "listening"
        if is_reading or is_listening:
            if is_reading:
                correct = seeder.collect_reading_answers(seed, attempt.get("book", 11), attempt["test"])
            else:
                correct = seeder.collect_listening_answers(seed, attempt.get("book", 11), attempt["test"])
            total = 0
            right = 0
            for r in body.responses:
                q = int(r.get("question_number"))
                ans = str(r.get("answer", "")).strip()
                total += 1
                correct_ans = str(correct.get(q, "")).strip()
                if correct_ans and correct_ans.lower() == ans.lower():
                    right += 1
            attempt["result"] = {"total": total, "correct": right}
        else:
            attempt["result"] = {"note": "auto-grading not implemented for this skill"}
        return {"id": attempt_id, "result": attempt["result"]}


@app.get("/api/attempts/{attempt_id}/result")
def get_result(attempt_id: str):
    if db.is_available():
        coll = db.attempts_collection()
        attempt = coll.find_one({"id": attempt_id}, {"_id": 0})
        if not attempt:
            raise HTTPException(status_code=404, detail="attempt not found")
        return {"id": attempt_id, "result": attempt.get("result")}
    attempt = in_memory_attempts.get(attempt_id)
    if not attempt:
        raise HTTPException(status_code=404, detail="attempt not found")
    return {"id": attempt_id, "result": attempt.get("result")}


@app.post("/api/tests/import")
def import_tests():
    if not db.is_available():
        raise HTTPException(status_code=503, detail="DB not available; cannot import tests")
    coll = db.tests_collection()
    coll.delete_many({})
    seed_data = seed
    inserted = 0
    for t in seed_data.get("tests", []):
        book_id = t.get("book", 11)
        coll.update_one({"book": book_id, "test_number": t["test_number"]}, {"$set": t}, upsert=True)
        inserted += 1
    # audio assets
    audio_coll = db.audio_collection()
    audio_coll.delete_many({})
    for a in seed_data.get("audio_assets", []):
        book_id = a.get("book", 11)
        audio_coll.update_one({"book": book_id, "test_number": a["test_number"], "file_name": a["file_name"]}, {"$set": a}, upsert=True)
    return {"inserted_tests": inserted}


@app.get("/api/audio/{file_name}")
def stream_audio(file_name: str):
    seed_data = seed
    matches = [a for a in seed_data.get("audio_assets", []) if a.get("file_name") == file_name]
    if not matches:
        raise HTTPException(status_code=404, detail="audio not found")
    relative_path = matches[0].get("relative_path")
    if not relative_path:
        raise HTTPException(status_code=404, detail="audio path not found")
    repo_root = Path(__file__).resolve().parents[2]
    audio_path = repo_root / relative_path
    if not audio_path.exists():
        raise HTTPException(status_code=404, detail="audio file missing")
    return FileResponse(path=audio_path, media_type="audio/mpeg", filename=file_name)


@app.get("/api/pdf-pages/{page_number}.png")
def get_pdf_page_image(page_number: int):
    pdf_path = render_pdf_page(page_number)
    return FileResponse(path=pdf_path, media_type="image/png")


@app.get("/api/pdf-pages/{book}/{pdf_type}/{page_number}.png")
def get_pdf_page_image_typed(book: int, pdf_type: str, page_number: int):
    pdf_path = render_pdf_page_typed(book, page_number, pdf_type)
    return FileResponse(path=pdf_path, media_type="image/png")


@lru_cache(maxsize=4)
def load_boundaries(version: int) -> dict:
    repo_root = Path(__file__).resolve().parents[2]
    boundaries_path = repo_root / "phase0" / "output" / "cambridge_boundaries.json"
    if boundaries_path.exists():
        import json
        try:
            return json.loads(boundaries_path.read_text(encoding="utf-8"))
        except Exception as e:
            print(f"Error loading boundaries JSON: {e}")
    return {}


def boundaries_cache_version() -> int:
    repo_root = Path(__file__).resolve().parents[2]
    boundaries_path = repo_root / "phase0" / "output" / "cambridge_boundaries.json"
    if boundaries_path.exists():
        return boundaries_path.stat().st_mtime_ns
    return 0


def render_pdf_part_typed(book: int, pdf_type: str, test: int, part_key: str) -> Path:
    cache_dir = Path(__file__).resolve().parents[2] / ".cache" / "pdf-parts"
    cache_dir.mkdir(parents=True, exist_ok=True)
    cache_version = boundaries_cache_version()
    output_path = cache_dir / f"cambridge{book}-{pdf_type}-test{test}-{part_key}-{cache_version}.png"
    if output_path.exists():
        return output_path
        
    boundaries = load_boundaries(cache_version)
    book_str = str(book)
    test_str = str(test)
    
    segments = None
    if book_str in boundaries and test_str in boundaries[book_str]:
        segments = boundaries[book_str][test_str].get(part_key)
        
    pdf_path = find_book_pdf_path(book, pdf_type)
            
    doc = fitz.open(str(pdf_path))
    
    if not segments:
        layouts = load_all_layouts()
        pages = []
        if book_str in layouts and test_str in layouts[book_str]:
            layout = layouts[book_str][test_str]
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
            doc.close()
            raise HTTPException(status_code=404, detail=f"Part {part_key} not found for Book {book} Test {test}")
            
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
        # If the provided y_end is larger than the page, bound it
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
    pix.save(str(output_path))
    
    doc.close()
    out_doc.close()
    return output_path


@app.get("/api/pdf-parts/{book}/{pdf_type}/{test}/{part_key}.png")
def get_pdf_part_image(book: int, pdf_type: str, test: int, part_key: str):
    try:
        pdf_path = render_pdf_part_typed(book, pdf_type, test, part_key)
        return FileResponse(path=pdf_path, media_type="image/png")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



