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
    # Try to find Cambridge 11 PDF first as a standard fallback
    for p in repo_root.rglob("*.pdf"):
        if "__MACOSX" not in p.parts and "Cambridge 11" in p.name:
            return p
    # If not found, return any Cambridge PDF
    for p in repo_root.rglob("*.pdf"):
        if "__MACOSX" not in p.parts and "Cambridge" in p.name:
            return p
    raise FileNotFoundError("Full Cambridge IELTS PDF not found")


def find_book_pdf_path(book: int, pdf_type: str = "academic") -> Path:
    repo_root = Path(__file__).resolve().parents[2]
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
                
    # 3. Ultimate fallback
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

class AdminLayoutIn(BaseModel):
    layout: dict

class AdminAnswersIn(BaseModel):
    answers: dict

class ExtractAnswersIn(BaseModel):
    page_number: int
    skill: str  # "listening" or "reading"

class AdminAudioIn(BaseModel):
    audio_assets: list


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


@app.get("/api/tests/{book}/page-count")
def get_pdf_page_count(book: int, pdf_type: str = "academic"):
    try:
        pdf_path = find_book_pdf_path(book, pdf_type)
        doc = fitz.open(str(pdf_path))
        page_count = len(doc)
        doc.close()
        return {"book": book, "pdf_type": pdf_type, "page_count": page_count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
    layout_path = repo_root / "backend" / "config" / "cambridge_all_layouts.json"
    if layout_path.exists():
        import json
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

@app.get("/api/tests/{book}/{test}/practice")
def get_practice_layout(book: int, test: int):
    layout = get_practice_layout_dict(book, test)
    if layout:
        return layout
    
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


def get_test_answers_dict(book: int, test: int) -> dict:
    if db.is_available():
        coll = db.answers_collection()
        if coll is not None:
            doc = coll.find_one({"book": book, "test": test}, {"_id": 0})
            if doc and "answers" in doc:
                return doc["answers"]
                
    t = seeder.find_test(seed, book, test)
    if not t:
        return {}
    answers = {}
    for section in t.get("sections", []):
        for row in section.get("rows", []):
            answers[str(row["question_number"])] = {
                "answer": row.get("answer_text", ""),
                "explanation": row.get("explanation_text", ""),
            }
    return answers

@app.get("/api/tests/{book}/{test}/answers")
def get_test_answers(book: int, test: int):
    """Return answer key from the seed data."""
    answers = get_test_answers_dict(book, test)
    if answers:
        return {"book": book, "test": test, "answers": answers}
        
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
            db_answers = get_test_answers_dict(attempt.get("book", 11), attempt["test"])
            if db_answers:
                correct = {int(k): v.get("answer", "") for k, v in db_answers.items()}
            elif is_reading:
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
            db_answers = get_test_answers_dict(attempt.get("book", 11), attempt["test"])
            if db_answers:
                correct = {int(k): v.get("answer", "") for k, v in db_answers.items()}
            elif is_reading:
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
        
    # 1. Tests
    coll = db.tests_collection()
    coll.delete_many({})
    seed_data = seed
    inserted = 0
    for t in seed_data.get("tests", []):
        book_id = t.get("book", 11)
        coll.update_one({"book": book_id, "test_number": t["test_number"]}, {"$set": t}, upsert=True)
        inserted += 1
        
    # 2. Audio Assets
    audio_coll = db.audio_collection()
    if audio_coll is not None:
        audio_coll.delete_many({})
        for a in seed_data.get("audio_assets", []):
            book_id = a.get("book", 11)
            audio_coll.update_one({"book": book_id, "test_number": a["test_number"], "file_name": a["file_name"]}, {"$set": a}, upsert=True)
            
    # 3. Layouts
    layout_coll = db.layouts_collection()
    if layout_coll is not None:
        layout_coll.delete_many({})
        layouts = load_all_layouts()
        for b_str, tests in layouts.items():
            b = int(b_str)
            for t_str, l_data in tests.items():
                t_num = int(t_str)
                layout_coll.update_one({"book": b, "test": t_num}, {"$set": {"layout": l_data}}, upsert=True)
                
    # 4. Answers
    ans_coll = db.answers_collection()
    if ans_coll is not None:
        ans_coll.delete_many({})
        for t in seed_data.get("tests", []):
            book_id = t.get("book", 11)
            test_number = t["test_number"]
            answers = {}
            for section in t.get("sections", []):
                for row in section.get("rows", []):
                    answers[str(row["question_number"])] = {
                        "answer": row.get("answer_text", ""),
                        "explanation": row.get("explanation_text", "")
                    }
            ans_coll.update_one({"book": book_id, "test": test_number}, {"$set": {"answers": answers}}, upsert=True)
            
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


@app.get("/api/admin/books/{book}/audio-files")
def list_book_audio_files(book: int):
    repo_root = Path(__file__).resolve().parents[2]
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
    
    pages = []
    layout = get_practice_layout_dict(book, test)
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

    pdf_path = find_book_pdf_path(book, pdf_type)
    doc = fitz.open(str(pdf_path))
    
    segments = None
    if pages:
        segments = []
        for p in pages:
            page_num_actual = min(max(1, p), len(doc))
            page_h = doc[page_num_actual - 1].rect.height
            segments.append({"page": page_num_actual, "y_start": 0.0, "y_end": page_h})
    else:
        # Fallback to static boundaries
        boundaries = load_boundaries(cache_version)
        book_str = str(book)
        test_str = str(test)
        if book_str in boundaries and test_str in boundaries[book_str]:
            segments = boundaries[book_str][test_str].get(part_key)

    if not segments:
        doc.close()
        raise HTTPException(status_code=404, detail=f"Part {part_key} not found for Book {book} Test {test}")
            
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




@app.get("/api/admin/tests/{book}/{test}")
def admin_get_test_info(book: int, test: int):
    layout = get_practice_layout_dict(book, test)
    answers = get_test_answers_dict(book, test)
    audio = []
    if db.is_available():
        coll = db.audio_collection()
        if coll is not None:
            audio = list(coll.find({"book": book, "test_number": test}, {"_id": 0}))
    if not audio:
        audio = seeder.collect_audio_assets(seed, book, test)
    return {
        "book": book,
        "test": test,
        "layout": layout,
        "answers": answers,
        "audio_assets": audio
    }

@app.put("/api/admin/tests/{book}/{test}/layout")
def admin_update_layout(book: int, test: int, data: AdminLayoutIn):
    if not db.is_available():
        raise HTTPException(status_code=503, detail="DB not available")
    coll = db.layouts_collection()
    coll.update_one({"book": book, "test": test}, {"$set": {"layout": data.layout}}, upsert=True)
    
    # Clear stitched parts cache for this book and test to force regeneration
    cache_dir = Path(__file__).resolve().parents[2] / ".cache" / "pdf-parts"
    if cache_dir.exists():
        for p in cache_dir.glob(f"cambridge{book}-*-test{test}-*.png"):
            try:
                p.unlink()
            except Exception as e:
                print(f"Error clearing cache file {p}: {e}")
                
    return {"status": "ok"}

@app.put("/api/admin/tests/{book}/{test}/answers")
def admin_update_answers(book: int, test: int, data: AdminAnswersIn):
    if not db.is_available():
        raise HTTPException(status_code=503, detail="DB not available")
    coll = db.answers_collection()
    coll.update_one({"book": book, "test": test}, {"$set": {"answers": data.answers}}, upsert=True)
    return {"status": "ok"}

@app.put("/api/admin/tests/{book}/{test}/audio")
def admin_update_audio(book: int, test: int, data: AdminAudioIn):
    if not db.is_available():
        raise HTTPException(status_code=503, detail="DB not available")
    coll = db.audio_collection()
    coll.delete_many({"book": book, "test_number": test})
    for a in data.audio_assets:
        a["book"] = book
        a["test_number"] = test
        coll.insert_one(a)
    return {"status": "ok"}

import re
@app.post("/api/admin/tests/{book}/{test}/extract-answers")
def extract_answers(book: int, test: int, data: ExtractAnswersIn):
    pdf_path = find_book_pdf_path(book, "solution")
    try:
        doc = fitz.open(str(pdf_path))
        page_num_actual = min(max(1, data.page_number), len(doc))
        page = doc[page_num_actual - 1]
        text = page.get_text("text")
        doc.close()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        
    extracted = {}
    lines = text.split("\n")
    # A simple heuristic to find "1. answer" or "1 answer"
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
