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
        raise FileNotFoundError("Full Cambridge IELTS 11 PDF not found")
    return max(candidates, key=lambda path: path.stat().st_size)


@lru_cache(maxsize=1)
def get_pdf_document() -> fitz.Document:
    return fitz.open(str(get_full_book_pdf_path()))


def render_pdf_page(page_number: int) -> Path:
    cache_dir = Path(__file__).resolve().parents[2] / ".cache" / "pdf-pages"
    cache_dir.mkdir(parents=True, exist_ok=True)
    output_path = cache_dir / f"cambridge11-page-{page_number}.png"
    if output_path.exists():
        return output_path
    doc = get_pdf_document()
    page = doc[page_number - 1]
    pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
    pix.save(str(output_path))
    return output_path


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
        docs = list(coll.find({}, {"test_number": 1, "sections": 1, "_id": 0}))
        return docs
    return seeder.get_tests_list(seed)


@app.get("/api/tests/{book}/{test}")
def get_test(book: int, test: int):
    if db.is_available():
        coll = db.tests_collection()
        doc = coll.find_one({"test_number": test}, {"_id": 0})
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
        docs = list(coll.find({"test_number": test}, {"_id": 0}))
        return docs
    return seeder.collect_audio_assets(seed, test)


PRACTICE_LAYOUTS = {
    1: {
        "listening": [
            {"section": 1, "pages": [11, 12]},
            {"section": 2, "pages": [13, 14]},
            {"section": 3, "pages": [15, 16]},
            {"section": 4, "pages": [17, 18]},
        ],
        "reading": [
            {
                "passage": 1,
                "passage_pages": [19, 20],
                "groups": [
                    {"range": "1-7", "title": "Questions 1-7", "page": 21},
                    {"range": "8-13", "title": "Questions 8-13", "page": 21}
                ]
            },
            {
                "passage": 2,
                "passage_pages": [22, 23],
                "groups": [
                    {"range": "14-19", "title": "Questions 14-19", "page": 24},
                    {"range": "20-26", "title": "Questions 20-26", "page": 25}
                ]
            },
            {
                "passage": 3,
                "passage_pages": [26, 27],
                "groups": [
                    {"range": "27-29", "title": "Questions 27-29", "page": 28},
                    {"range": "30-36", "title": "Questions 30-36", "page": 29},
                    {"range": "37-40", "title": "Questions 37-40", "page": 30}
                ]
            },
        ],
        "writing": [
            {"task": 1, "pages": [31]},
            {"task": 2, "pages": [32]}
        ],
        "speaking": [
            {"part": 1, "pages": [33]}
        ]
    },
    2: {
        "listening": [
            {"section": 1, "pages": [34, 35]},
            {"section": 2, "pages": [36, 37]},
            {"section": 3, "pages": [38, 39]},
            {"section": 4, "pages": [40, 41]},
        ],
        "reading": [
            {
                "passage": 1,
                "passage_pages": [42, 43],
                "groups": [
                    {"range": "1-4", "title": "Questions 1-4", "page": 44},
                    {"range": "5-8", "title": "Questions 5-8", "page": 44},
                    {"range": "9-13", "title": "Questions 9-13", "page": 45}
                ]
            },
            {
                "passage": 2,
                "passage_pages": [47, 48],
                "groups": [
                    {"range": "14-20", "title": "Questions 14-20", "page": 46},
                    {"range": "21-24", "title": "Questions 21-24", "page": 49},
                    {"range": "25-26", "title": "Questions 25-26", "page": 49}
                ]
            },
            {
                "passage": 3,
                "passage_pages": [50, 51],
                "groups": [
                    {"range": "27-30", "title": "Questions 27-30", "page": 52},
                    {"range": "31-33", "title": "Questions 31-33", "page": 53},
                    {"range": "34-40", "title": "Questions 34-40", "page": 54}
                ]
            },
        ],
        "writing": [
            {"task": 1, "pages": [55]},
            {"task": 2, "pages": [56]}
        ],
        "speaking": [
            {"part": 1, "pages": [57]}
        ]
    },
    3: {
        "listening": [
            {"section": 1, "pages": [58, 59]},
            {"section": 2, "pages": [60, 61]},
            {"section": 3, "pages": [62, 63]},
            {"section": 4, "pages": [64, 65]},
        ],
        "reading": [
            {
                "passage": 1,
                "passage_pages": [66, 67],
                "groups": [
                    {"range": "1-9", "title": "Questions 1-9", "page": 68},
                    {"range": "10-13", "title": "Questions 10-13", "page": 69}
                ]
            },
            {
                "passage": 2,
                "passage_pages": [70, 71],
                "groups": [
                    {"range": "14-18", "title": "Questions 14-18", "page": 72},
                    {"range": "19-22", "title": "Questions 19-22", "page": 73},
                    {"range": "23-26", "title": "Questions 23-26", "page": 73}
                ]
            },
            {
                "passage": 3,
                "passage_pages": [74, 75],
                "groups": [
                    {"range": "27-34", "title": "Questions 27-34", "page": 76},
                    {"range": "35-40", "title": "Questions 35-40", "page": 77}
                ]
            },
        ],
        "writing": [
            {"task": 1, "pages": [78]},
            {"task": 2, "pages": [79]}
        ],
        "speaking": [
            {"part": 1, "pages": [80]}
        ]
    },
    4: {
        "listening": [
            {"section": 1, "pages": [81, 82]},
            {"section": 2, "pages": [83, 84]},
            {"section": 3, "pages": [85, 86]},
            {"section": 4, "pages": [87]},
        ],
        "reading": [
            {
                "passage": 1,
                "passage_pages": [88, 89],
                "groups": [
                    {"range": "1-4", "title": "Questions 1-4", "page": 90},
                    {"range": "5-9", "title": "Questions 5-9", "page": 90},
                    {"range": "10-13", "title": "Questions 10-13", "page": 91}
                ]
            },
            {
                "passage": 2,
                "passage_pages": [92, 93],
                "groups": [
                    {"range": "14-18", "title": "Questions 14-18", "page": 94},
                    {"range": "19-23", "title": "Questions 19-23", "page": 95},
                    {"range": "24-26", "title": "Questions 24-26", "page": 96}
                ]
            },
            {
                "passage": 3,
                "passage_pages": [98, 99],
                "groups": [
                    {"range": "27-32", "title": "Questions 27-32", "page": 97},
                    {"range": "33-36", "title": "Questions 33-36", "page": 100},
                    {"range": "37-40", "title": "Questions 37-40", "page": 100}
                ]
            },
        ],
        "writing": [
            {"task": 1, "pages": [101]},
            {"task": 2, "pages": [102]}
        ],
        "speaking": [
            {"part": 1, "pages": [103]}
        ]
    }
}


@app.get("/api/tests/{book}/{test}/practice")
def get_practice_layout(book: int, test: int):
    if book != 11 or test not in PRACTICE_LAYOUTS:
        raise HTTPException(status_code=404, detail="practice layout only prepared for Cambridge 11")
    return PRACTICE_LAYOUTS[test]


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
                correct = seeder.collect_reading_answers(seed, attempt["test"])
            else:
                correct = seeder.collect_listening_answers(seed, attempt["test"])
            total = 0
            right = 0
            for r in body.responses:
                q = int(r.get("question_number"))
                ans = str(r.get("answer", "")).strip()
                total += 1
                if str(correct.get(q, "")).strip().lower() == ans.lower():
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
                correct = seeder.collect_reading_answers(seed, attempt["test"])
            else:
                correct = seeder.collect_listening_answers(seed, attempt["test"])
            total = 0
            right = 0
            for r in body.responses:
                q = int(r.get("question_number"))
                ans = str(r.get("answer", "")).strip()
                total += 1
                if str(correct.get(q, "")).strip().lower() == ans.lower():
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
    seed_data = seed
    inserted = 0
    for t in seed_data.get("tests", []):
        coll.update_one({"test_number": t["test_number"]}, {"$set": t}, upsert=True)
        inserted += 1
    # audio assets
    audio_coll = db.audio_collection()
    for a in seed_data.get("audio_assets", []):
        audio_coll.update_one({"file_name": a["file_name"]}, {"$set": a}, upsert=True)
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


