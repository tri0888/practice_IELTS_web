from uuid import uuid4
from fastapi import HTTPException
from app.models import database as db
from app import seeder
from app.models.schemas import AttemptCreate, AttemptSubmit
from app.modules.practice.services import get_test_answers_dict

in_memory_attempts = {}

def start_attempt(a: AttemptCreate):
    attempt = {
        "user_id": a.user_id,
        "book": a.book,
        "test": a.test,
        "skill": a.skill,
        "started_at": None,
        "submitted_at": None,
        "responses": [],
        "result": None
    }
    attempt_id = str(uuid4())
    attempt["id"] = attempt_id
    
    if db.is_available():
        coll = db.attempts_collection()
        coll.insert_one(attempt)
    else:
        in_memory_attempts[attempt_id] = attempt
        
    return {"id": attempt_id}

def submit_attempt(attempt_id: str, body: AttemptSubmit):
    # Locate attempt either in DB or in-memory
    if db.is_available():
        coll = db.attempts_collection()
        attempt = coll.find_one({"id": attempt_id})
        if attempt is None:
            raise HTTPException(status_code=404, detail="attempt not found")
            
        result = _grade_attempt(attempt, body.responses)
        coll.update_one({"id": attempt_id}, {"$set": {"responses": body.responses, "result": result, "submitted_at": None}})
        return {"id": attempt_id, "result": result}
    else:
        attempt = in_memory_attempts.get(attempt_id)
        if not attempt:
            raise HTTPException(status_code=404, detail="attempt not found")
            
        result = _grade_attempt(attempt, body.responses)
        attempt["responses"] = body.responses
        attempt["result"] = result
        return {"id": attempt_id, "result": result}

def get_result(attempt_id: str):
    if db.is_available():
        coll = db.attempts_collection()
        attempt = coll.find_one({"id": attempt_id}, {"_id": 0})
        if not attempt:
            raise HTTPException(status_code=404, detail="attempt not found")
        return {"id": attempt_id, "result": attempt.get("result")}
    else:
        attempt = in_memory_attempts.get(attempt_id)
        if not attempt:
            raise HTTPException(status_code=404, detail="attempt not found")
        return {"id": attempt_id, "result": attempt.get("result")}

def _grade_attempt(attempt: dict, responses: list) -> dict:
    skill = attempt.get("skill", "").lower()
    is_reading = skill.startswith("passage") or skill == "reading"
    is_listening = skill == "listening"
    
    if is_reading or is_listening:
        db_answers = get_test_answers_dict(attempt.get("book", 11), attempt["test"])
        if db_answers:
            correct = {int(k): v.get("answer", "") for k, v in db_answers.items()}
        elif is_reading:
            correct = seeder.collect_reading_answers(seeder.get_seed_data(), attempt.get("book", 11), attempt["test"])
        else:
            correct = seeder.collect_listening_answers(seeder.get_seed_data(), attempt.get("book", 11), attempt["test"])
            
        total = 0
        right = 0
        for r in responses:
            try:
                q = int(r.get("question_number"))
                ans = str(r.get("answer", "")).strip()
                total += 1
                correct_ans = str(correct.get(q, "")).strip()
                if correct_ans and correct_ans.lower() == ans.lower():
                    right += 1
            except Exception:
                pass
        return {"total": total, "correct": right}
    else:
        return {"note": "auto-grading not implemented for this skill"}
