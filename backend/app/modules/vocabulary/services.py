import json
import random
from datetime import datetime
from pathlib import Path
from fastapi import HTTPException
from app.models import database as db

# In-memory cached vocabulary lists populated from MongoDB or JSON fallback
vocab_list = []
vocab_by_word = {}
unique_pos = []

def ensure_vocab_loaded():
    global vocab_list, vocab_by_word, unique_pos
    if vocab_list:
        return
        
    local_list = []
    local_by_word = {}
    loaded_from_db = False
    
    if db.is_available():
        try:
            coll = db.vocabulary_collection()
            if coll is not None:
                docs = list(coll.find({}, {"_id": 0}))
                if docs:
                    for doc in docs:
                        word = doc.get("vocab", "").strip()
                        if not word:
                            continue
                        word_lower = word.lower()
                        local_list.append(doc)
                        local_by_word[word_lower] = doc
                    loaded_from_db = True
        except Exception as e:
            print(f"Error lazy loading vocab from MongoDB: {e}")

    # Fallback to local JSON if DB has no records
    if not loaded_from_db:
        vocab_file = Path(__file__).resolve().parents[3] / "config" / "Vocabulary.json"
        try:
            if vocab_file.exists():
                with open(vocab_file, "r", encoding="utf-8") as f:
                    raw_data = json.load(f)
                    seen = set()
                    for item in raw_data:
                        word = item.get("vocab", "").strip()
                        if not word:
                            continue
                        word_lower = word.lower()
                        if word_lower not in seen:
                            seen.add(word_lower)
                            standardized = {
                                "vocab": word,
                                "pronunciation": item.get("pronunciation", "").strip(),
                                "POS": item.get("POS", "").strip(),
                                "definition": item.get("definition", "").strip()
                            }
                            local_list.append(standardized)
                            local_by_word[word_lower] = standardized
        except Exception as e:
            print(f"Error loading fallback Vocabulary.json: {e}")

    # Compute unique parts of speech
    local_unique_pos = sorted(list(set(item["POS"] for item in local_list if item.get("POS"))))

    # Atomic Reference Assignments (avoids duplication race condition in concurrent calls)
    vocab_list = local_list
    vocab_by_word = local_by_word
    unique_pos = local_unique_pos

def get_vocabulary_list(
    user_id: str,
    search: str | None = None,
    pos: str | None = None,
    status: str | None = None,
    page: int = 1,
    limit: int = 50
):
    ensure_vocab_loaded()
    
    # 1. Filter by search & pos in memory
    filtered = vocab_list
    if search:
        search_lower = search.lower().strip()
        filtered = [
            item for item in filtered
            if search_lower in item["vocab"].lower() or search_lower in item["definition"].lower()
        ]
    
    if pos:
        pos_lower = pos.lower().strip()
        filtered = [item for item in filtered if item["POS"].lower() == pos_lower]
        
    # 2. Retrieve user progress if DB is available
    progress_dict = {}
    if db.is_available() and user_id:
        coll = db.vocabulary_progress_collection()
        if coll is not None:
            records = coll.find({"user_id": user_id})
            for r in records:
                progress_dict[r["vocab"].lower()] = r

    # 3. Attach progress information and filter by progress status
    final_list = []
    for item in filtered:
        word_lower = item["vocab"].lower()
        prog = progress_dict.get(word_lower, {})
        
        status_val = prog.get("status", "unlearned")
        correct_count = prog.get("correct_count", 0)
        wrong_count = prog.get("wrong_count", 0)
        
        # Apply progress status filtering
        if status:
            status_lower = status.lower().strip()
            if status_lower == "learning" and status_val != "learning":
                continue
            elif status_lower == "mastered" and status_val != "mastered":
                continue
            elif status_lower == "unlearned" and status_val != "unlearned":
                continue

        item_with_progress = {
            **item,
            "status": status_val,
            "correct_count": correct_count,
            "wrong_count": wrong_count
        }
        final_list.append(item_with_progress)
        
    # 4. Perform pagination
    total = len(final_list)
    start = (page - 1) * limit
    end = start + limit
    paginated_items = final_list[start:end]
    
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "items": paginated_items
    }

def get_stats(user_id: str):
    ensure_vocab_loaded()
    stats = {
        "total_words": len(vocab_list),
        "mastered_count": 0,
        "learning_count": 0,
        "studied_count": 0,
        "accuracy": 0,
        "total_correct": 0,
        "total_wrong": 0,
        "unique_pos": unique_pos,
        "studied_pos": []
    }
    
    if db.is_available() and user_id:
        coll = db.vocabulary_progress_collection()
        if coll is not None:
            cursor = coll.find({"user_id": user_id})
            total_correct = 0
            total_wrong = 0
            studied_pos_set = set()
            for doc in cursor:
                status = doc.get("status")
                
                if status == "mastered":
                    stats["mastered_count"] += 1
                elif status == "learning":
                    stats["learning_count"] += 1
                    stats["studied_count"] += 1
                    
                    vocab_key = doc.get("vocab", "").strip().lower()
                    if vocab_key in vocab_by_word:
                        p_val = vocab_by_word[vocab_key].get("POS")
                        if p_val:
                            studied_pos_set.add(p_val)
                    
                total_correct += doc.get("correct_count", 0)
                total_wrong += doc.get("wrong_count", 0)
                
            stats["total_correct"] = total_correct
            stats["total_wrong"] = total_wrong
            stats["studied_pos"] = sorted(list(studied_pos_set))
            total_attempts = total_correct + total_wrong
            if total_attempts > 0:
                stats["accuracy"] = round((total_correct / total_attempts) * 100)
                
    return stats

def get_practice_words(user_id: str, mode: str = "random", pos: str | None = None, limit: int = 15):
    ensure_vocab_loaded()
    
    source_words = vocab_list
    if pos:
        pos_lower = pos.lower().strip()
        source_words = [item for item in source_words if item["POS"].lower() == pos_lower]
        
    if not source_words:
        return []
        
    # Fetch user progress dictionary
    progress_dict = {}
    if db.is_available() and user_id:
        coll = db.vocabulary_progress_collection()
        if coll is not None:
            records = coll.find({"user_id": user_id})
            for r in records:
                progress_dict[r["vocab"].lower()] = r

    # STRICT FILTER: Exclude mastered words from all practice
    eligible_words = [
        item for item in source_words
        if progress_dict.get(item["vocab"].lower(), {}).get("status") != "mastered"
    ]
    
    if mode == "studied":
        # Filter words currently marked learning strictly
        studied_candidates = [
            item for item in eligible_words
            if progress_dict.get(item["vocab"].lower(), {}).get("status") == "learning"
        ]
        random.shuffle(studied_candidates)
        selected_words = studied_candidates[:limit]
    else:
        # Select random words
        if len(eligible_words) >= limit:
            selected_words = random.sample(eligible_words, limit)
        else:
            selected_words = list(eligible_words)
            random.shuffle(selected_words)

    # Build final response deck
    practice_list = []
    for item in selected_words:
        word_lower = item["vocab"].lower()
        prog = progress_dict.get(word_lower, {})
        
        practice_list.append({
            **item,
            "status": prog.get("status", "unlearned"),
            "correct_count": prog.get("correct_count", 0),
            "wrong_count": prog.get("wrong_count", 0)
        })
        
    random.shuffle(practice_list)
    return practice_list

def update_progress(
    user_id: str,
    vocab: str,
    status: str | None = None,
    is_correct: bool | None = None
):
    ensure_vocab_loaded()
    vocab_lower = vocab.lower().strip()
    
    if vocab_lower not in vocab_by_word:
        raise HTTPException(status_code=404, detail=f"Word '{vocab}' not found in vocabulary directory")
        
    if not db.is_available():
        raise HTTPException(status_code=503, detail="Database not available")
        
    coll = db.vocabulary_progress_collection()
    if coll is None:
        raise HTTPException(status_code=503, detail="Vocabulary collection not available")
        
    set_fields = {
        "updated_at": datetime.utcnow().isoformat()
    }
    
    if status is not None:
        status_val = status.strip().lower()
        if status_val not in ["learning", "mastered", "unlearned"]:
            raise HTTPException(status_code=400, detail="Invalid status value. Must be 'learning', 'mastered' or 'unlearned'")
        set_fields["status"] = status_val
        
    inc_fields = {}
    if is_correct is not None:
        # If answering quiz, force status to 'learning' if it was 'unlearned'
        existing = coll.find_one({"user_id": user_id, "vocab": vocab_lower})
        current_status = existing.get("status", "unlearned") if existing else "unlearned"
        if current_status == "unlearned":
            set_fields["status"] = "learning"
            
        if is_correct:
            inc_fields["correct_count"] = 1
        else:
            inc_fields["wrong_count"] = 1

    update_doc = {"$set": set_fields}
    if inc_fields:
        update_doc["$inc"] = inc_fields
        
    coll.update_one(
        {"user_id": user_id, "vocab": vocab_lower},
        update_doc,
        upsert=True
    )
    
    updated_prog = coll.find_one({"user_id": user_id, "vocab": vocab_lower}, {"_id": 0})
    word_info = vocab_by_word[vocab_lower]
    
    return {
        **word_info,
        "status": updated_prog.get("status", "unlearned"),
        "correct_count": updated_prog.get("correct_count", 0),
        "wrong_count": updated_prog.get("wrong_count", 0)
    }

def bulk_update_progress(user_id: str, vocabs: list[str], status: str):
    if not db.is_available():
        raise HTTPException(status_code=503, detail="Database not available")
        
    coll = db.vocabulary_progress_collection()
    if coll is None:
        raise HTTPException(status_code=503, detail="Vocabulary collection not available")
        
    status_val = status.strip().lower()
    if status_val not in ["learning", "mastered", "unlearned"]:
        raise HTTPException(status_code=400, detail="Invalid status value")
        
    vocabs_lower = [v.lower().strip() for v in vocabs if v]
    if not vocabs_lower:
        return {"updated": 0}
        
    res = coll.update_many(
        {"user_id": user_id, "vocab": {"$in": vocabs_lower}},
        {"$set": {
            "status": status_val,
            "updated_at": datetime.utcnow().isoformat()
        }}
    )
    
    return {"updated": res.modified_count}
