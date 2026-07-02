from datetime import datetime
from uuid import uuid4
from fastapi import HTTPException
from app.models import database as db
from app.models.schemas import AttemptCreate, AttemptSubmit
from app.modules.practice.services import get_test_answers_dict
from app.modules.tests.services import get_ets_answers
# Grading primitives live in grading.py (SRP). Re-exported here for backward
# compatibility so existing imports of these names keep working.
from app.modules.attempts.grading import (  # noqa: F401
    clean_spaces,
    clean_punctuation,
    expand_parentheses,
    expand_slashes,
    get_correct_answers_list,
    check_user_answer,
    get_correct_answer_for_question,
)

in_memory_attempts = {}

def start_attempt(a: AttemptCreate):
    attempt = {
        "user_id": a.user_id,
        "book": a.book,
        "test": a.test,
        "skill": a.skill,
        "started_at": datetime.utcnow().isoformat(),
        "submitted_at": None,
        "responses": [],
        "result": None
    }
    attempt_id = str(uuid4())
    attempt["id"] = attempt_id
    
    # Store draft attempt temporarily in-memory only (do not write to MongoDB yet)
    in_memory_attempts[attempt_id] = attempt
        
    return {"id": attempt_id}

def submit_attempt(attempt_id: str, body: AttemptSubmit):
    # Locate attempt first in memory
    attempt = in_memory_attempts.get(attempt_id)
    
    if not attempt:
        # Fallback to histories collection if it was already submitted
        if db.is_available():
            coll = db.histories_collection()
            attempt = coll.find_one({"id": attempt_id})
        if not attempt:
            raise HTTPException(status_code=404, detail="attempt not found")
            
    result = _grade_attempt(attempt, body.responses)
    attempt["responses"] = body.responses
    attempt["result"] = result
    attempt["submitted_at"] = datetime.utcnow().isoformat()
    
    # Save the graded history to MongoDB if available
    if db.is_available():
        coll = db.histories_collection()
        coll.update_one({"id": attempt_id}, {"$set": attempt}, upsert=True)
        # Pop from in-memory store once saved to DB
        in_memory_attempts.pop(attempt_id, None)
    else:
        in_memory_attempts[attempt_id] = attempt
        
    return {"id": attempt_id, "result": result}

def get_result(attempt_id: str):
    attempt = None
    if db.is_available():
        coll = db.histories_collection()
        attempt = coll.find_one({"id": attempt_id}, {"_id": 0})
        
    if not attempt:
        attempt = in_memory_attempts.get(attempt_id)
        
    if not attempt:
        raise HTTPException(status_code=404, detail="attempt not found")
            
    skill = attempt.get("skill", "").lower()
    is_reading = skill.startswith("passage") or skill == "reading"
    is_listening = skill == "listening"
    
    correct_answers = {}
    if is_reading or is_listening:
        skill_key = "reading" if is_reading else "listening"
        db_answers = get_test_answers_dict(attempt.get("book", 11), attempt["test"], skill=skill_key)
        correct = db_answers if db_answers else {}
            
        for q in range(1, 41):
            ans = get_correct_answer_for_question(q, correct)
            correct_answers[str(q)] = ans
    elif skill in ("toeic_lc", "toeic_rc"):
        pdf_type = "lc" if skill == "toeic_lc" else "rc"
        year = str(attempt.get("book", "2026"))
        ans_data = get_ets_answers(pdf_type, attempt.get("test", 1), year)
        correct = ans_data.get("answers", {})
        for q, ans in correct.items():
            correct_answers[str(q)] = ans
            
    return {
        "id": attempt_id,
        "book": attempt.get("book"),
        "test": attempt.get("test"),
        "skill": attempt.get("skill"),
        "started_at": attempt.get("started_at"),
        "submitted_at": attempt.get("submitted_at"),
        "responses": attempt.get("responses", []),
        "result": attempt.get("result"),
        "correct_answers": correct_answers
    }

def _grade_attempt(attempt: dict, responses: list) -> dict:
    skill = attempt.get("skill", "").lower()
    is_reading = skill.startswith("passage") or skill == "reading"
    is_listening = skill == "listening"
    
    if is_reading or is_listening:
        skill_key = "reading" if is_reading else "listening"
        db_answers = get_test_answers_dict(attempt.get("book", 11), attempt["test"], skill=skill_key)
        correct = db_answers if db_answers else {}
            
        total = 0
        right = 0
        for r in responses:
            try:
                q = int(r.get("question_number"))
                ans = str(r.get("answer", "")).strip()
                total += 1
                correct_ans = get_correct_answer_for_question(q, correct)
                if check_user_answer(ans, correct_ans):
                    right += 1
            except Exception:
                pass
        return {"total": total, "correct": right}
    elif skill in ("toeic_lc", "toeic_rc"):
        pdf_type = "lc" if skill == "toeic_lc" else "rc"
        year = str(attempt.get("book", "2026"))
        ans_data = get_ets_answers(pdf_type, attempt.get("test", 1), year)
        correct = ans_data.get("answers", {})
        
        total = 0
        right = 0
        for r in responses:
            try:
                q = int(r.get("question_number"))
                ans = str(r.get("answer", "")).strip().upper()
                total += 1
                correct_ans = correct.get(str(q), "").strip().upper()
                if ans and correct_ans and ans == correct_ans:
                    right += 1
            except Exception:
                pass
        return {"total": total, "correct": right}
    else:
        return {"note": "auto-grading not implemented for this skill"}

def list_attempts():
    if db.is_available():
        coll = db.histories_collection()
        # Return all histories sorted by started_at descending
        return list(coll.find({}, {"_id": 0}).sort("started_at", -1))
    else:
        # Only return attempts that have been submitted (result is not None)
        attempts_list = [att for att in in_memory_attempts.values() if att.get("result") is not None]
        attempts_list.sort(key=lambda x: x.get("started_at") or "", reverse=True)
        return attempts_list

def delete_attempt(attempt_id: str):
    deleted_from_db = False
    deleted_from_mem = False
    
    if db.is_available():
        coll = db.histories_collection()
        res = coll.delete_one({"id": attempt_id})
        if res.deleted_count > 0:
            deleted_from_db = True
            
    if attempt_id in in_memory_attempts:
        del in_memory_attempts[attempt_id]
        deleted_from_mem = True
        
    if not (deleted_from_db or deleted_from_mem):
        raise HTTPException(status_code=404, detail="attempt not found")
        
    return {"status": "ok", "deleted": attempt_id}
