import re
import itertools
from datetime import datetime
from uuid import uuid4
from fastapi import HTTPException
from app.models import database as db
from app.models.schemas import AttemptCreate, AttemptSubmit
from app.modules.practice.services import get_test_answers_dict
from app.modules.tests.services import get_ets_answers

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

def clean_spaces(s: str) -> str:
    return re.sub(r'\s+', ' ', s).strip()

def clean_punctuation(s: str) -> str:
    return s.strip(".,;:!?\"' ")

def expand_parentheses(s: str) -> list[str]:
    match = re.search(r'\(([^)]*)\)', s)
    if not match:
        return [clean_spaces(s)]
    
    start, end = match.span()
    prefix = s[:start]
    inner = match.group(1)
    suffix = s[end:]
    
    opt1 = prefix + suffix
    opt2 = prefix + inner + suffix
    
    res1 = expand_parentheses(opt1)
    res2 = expand_parentheses(opt2)
    
    return list(set(res1 + res2))

def expand_slashes(s: str) -> list[str]:
    tokens = s.split()
    if not tokens:
        return [""]
    
    token_variations = []
    for token in tokens:
        if '/' in token:
            parts = token.split('/')
            parts = [p for p in parts if p]
            if parts:
                token_variations.append(parts)
            else:
                token_variations.append([token])
        else:
            token_variations.append([token])
            
    combinations = itertools.product(*token_variations)
    return [" ".join(combo) for combo in combinations]

def get_correct_answers_list(correct_ans_str: str) -> list[str]:
    if not correct_ans_str:
        return []
    
    main_options = re.split(r'\s+/\s+', correct_ans_str)
    all_correct = []
    
    for option in main_options:
        parenthetical_expanded = expand_parentheses(option)
        for p_expanded in parenthetical_expanded:
            slash_expanded = expand_slashes(p_expanded)
            for s_expanded in slash_expanded:
                all_correct.append(clean_punctuation(s_expanded.lower()))
                
    all_correct.append(clean_punctuation(correct_ans_str.lower()))
    return list(set(all_correct))

def check_user_answer(user_ans: str, correct_ans_str: str) -> bool:
    cleaned_user = clean_punctuation(clean_spaces(user_ans).lower())
    if not cleaned_user:
        return False
        
    correct_list = get_correct_answers_list(correct_ans_str)
    if cleaned_user in correct_list:
        return True
        
    parts = re.split(r'\s*[-–—]\s*', correct_ans_str)
    if len(parts) > 1:
        first_word_cleaned = clean_punctuation(clean_spaces(parts[0]).lower())
        if cleaned_user == first_word_cleaned:
            return True
            
    return False

def get_correct_answer_for_question(q: int, correct: dict) -> str:
    if str(q) in correct:
        val = correct[str(q)]
        return val.get("answer", "") if isinstance(val, dict) else str(val)
    if q in correct:
        val = correct[q]
        return val.get("answer", "") if isinstance(val, dict) else str(val)
        
    for key, val in correct.items():
        cleaned_key = str(key).replace('–', '-').replace('—', '-')
        if '-' in cleaned_key:
            parts = cleaned_key.split('-')
            if len(parts) == 2:
                try:
                    start = int(parts[0])
                    end = int(parts[1])
                    if start <= q <= end:
                        return val.get("answer", "") if isinstance(val, dict) else str(val)
                except ValueError:
                    pass
    return ""

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
