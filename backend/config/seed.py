import os
import sys
import json
import argparse
from pathlib import Path
from datetime import datetime
from uuid import uuid4

# The script is in backend/config/seed.py
config_dir = Path(__file__).resolve().parent
backend_dir = config_dir.parent
sys.path.append(str(backend_dir))

from dotenv import load_dotenv
# Load environment variables from .env (located in backend/.env)
load_dotenv(dotenv_path=backend_dir / ".env")

from app.models import database as db

def delete_data():
    print("\n--- Deleting Database Collections ---")
    if not db.is_available():
        print("Error: MongoDB database is not available.")
        sys.exit(1)
        
    collections = {
        "ielts_audio_assets": db.audio_collection(),
        "ielts_layouts": db.layouts_collection(),
        "ielts_answers": db.answers_collection(),
        "toeic_audio_assets": db.toeic_audio_collection(),
        "toeic_layouts": db.toeic_layouts_collection(),
        "toeic_answers": db.toeic_answers_collection(),
        "histories": db.histories_collection(),
        "vocabulary": db.vocabulary_collection(),
        "users": db.users_collection(),
        "r2_keys": db.r2_keys_collection()
    }
    
    for name, coll in collections.items():
        if coll is not None:
            res = coll.delete_many({})
            print(f"Deleted {res.deleted_count} documents from '{name}' collection.")
        else:
            print(f"Collection '{name}' is not available.")

def make_range(start, end):
    return list(range(start, end + 1))

def import_data():
    print("\n--- Importing Seed Data ---")
    if not db.is_available():
        print("Error: MongoDB database is not available.")
        sys.exit(1)

    # 1. Seeding Cambridge Layouts
    print("Seeding Cambridge Layouts...")
    layouts_json_path = config_dir / "ielts_layouts.json"
    if layouts_json_path.exists():
        try:
            with open(layouts_json_path, "r", encoding="utf-8") as f:
                layouts_data = json.load(f)
            
            layouts_coll = db.layouts_collection()
            inserted_layouts = 0
            for book_str, tests in layouts_data.items():
                book_id = int(book_str)
                if book_id == 20:
                    continue
                for test_str, layout in tests.items():
                    test_id = int(test_str)
                    layouts_coll.update_one(
                        {"book": book_id, "test": test_id},
                        {"$set": {"layout": layout}},
                        upsert=True
                    )
                    inserted_layouts += 1
            print(f"  Successfully imported {inserted_layouts} layouts from layouts mapping.")
        except Exception as e:
            print(f"  Error importing layouts: {e}")
    else:
        print(f"  Warning: '{layouts_json_path}' layout file not found.")

    # 2. Seeding ETS Layouts
    print("Seeding ETS Layouts...")
    ets_layouts_path = config_dir / "toeic_layouts.json"
    if ets_layouts_path.exists():
        try:
            with open(ets_layouts_path, "r", encoding="utf-8") as f:
                ets_layouts_data = json.load(f)
            
            toeic_layouts_coll = db.toeic_layouts_collection()
            inserted_ets_layouts = 0
            for year_key in ["ETS 2024", "ETS 2026"]:
                if year_key in ets_layouts_data:
                    year = int(year_key.split()[-1])
                    lc_list = ets_layouts_data[year_key].get("lc", [])
                    rc_list = ets_layouts_data[year_key].get("rc", [])
                    for test_num in range(1, 11):
                        lc_item = next((item for item in lc_list if item.get("test") == test_num), None)
                        rc_item = next((item for item in rc_list if item.get("test") == test_num), None)
                        if lc_item and rc_item:
                            layout_doc = {
                                "listening": [
                                    { "section": 1, "pages": make_range(lc_item["part1"][0], lc_item["part1"][1]) },
                                    { "section": 2, "pages": make_range(lc_item["part2"][0], lc_item["part2"][1]) },
                                    { "section": 3, "pages": make_range(lc_item["part3"][0], lc_item["part3"][1]) },
                                    { "section": 4, "pages": make_range(lc_item["part4"][0], lc_item["part4"][1]) }
                                ],
                                "reading": [
                                    { "passage": 5, "passage_pages": make_range(rc_item["part5"][0], rc_item["part5"][1]) },
                                    { "passage": 6, "passage_pages": make_range(rc_item["part6"][0], rc_item["part6"][1]) },
                                    { "passage": 7, "passage_pages": make_range(rc_item["part7"][0], rc_item["part7"][1]) }
                                ]
                            }
                            toeic_layouts_coll.update_one(
                                {"book": year, "test": test_num},
                                {"$set": {"layout": layout_doc}},
                                upsert=True
                            )
                            inserted_ets_layouts += 1
            print(f"  Successfully imported {inserted_ets_layouts} ETS layouts.")
        except Exception as e:
            print(f"  Error importing ETS layouts: {e}")
    else:
        print(f"  Warning: '{ets_layouts_path}' not found.")

    # 3. Seeding Cambridge solutions/answers
    print("Seeding Cambridge Solutions...")
    solutions_json_path = config_dir / "ielts_answers.json"
    if solutions_json_path.exists():
        try:
            with open(solutions_json_path, "r", encoding="utf-8") as f:
                solutions_data = json.load(f)
            
            ans_coll = db.answers_collection()
            inserted_solutions = 0
            for book_str, book_data in solutions_data.items():
                book_num = int(book_str)
                if book_num == 20:
                    continue
                tests = {k: v for k, v in book_data.items() if k.startswith("test_")}
                for test_key, test_data in tests.items():
                    test_num = int(test_key.replace("test_", ""))
                    
                    listening_dict = {}
                    reading_dict = {}
                    
                    # Parse Listening
                    listening = test_data.get("listening", {})
                    for section_key, section_data in listening.items():
                        for q_key, ans_text in section_data.items():
                            q_num = q_key.replace("Q", "").strip()
                            listening_dict[q_num] = {
                                "answer": str(ans_text).strip(),
                                "explanation": ""
                            }
                            
                    # Parse Reading
                    reading = test_data.get("reading", {})
                    for passage_key, passage_data in reading.items():
                        for q_key, ans_text in passage_data.items():
                            q_num = q_key.replace("Q", "").strip()
                            reading_dict[q_num] = {
                                "answer": str(ans_text).strip(),
                                "explanation": ""
                            }
                            
                    if listening_dict or reading_dict:
                        ans_coll.update_one(
                            {"book": book_num, "test": test_num},
                            {"$set": {
                                "listening": listening_dict,
                                "reading": reading_dict
                            }},
                            upsert=True
                        )
                        inserted_solutions += 1
            print(f"  Successfully imported answers for {inserted_solutions} Cambridge tests.")
        except Exception as e:
            print(f"  Error seeding Cambridge solutions: {e}")
    else:
        print(f"  Warning: '{solutions_json_path}' solutions file not found.")

    # 4. Seeding ETS Answers
    print("Seeding ETS Answers...")
    ets_answers_path = config_dir / "toeic_answers.json"
    if ets_answers_path.exists():
        try:
            with open(ets_answers_path, "r", encoding="utf-8") as f:
                ans_data = json.load(f)
            
            toeic_answers_coll = db.toeic_answers_collection()
            inserted_toeic_answers = 0
            for year_str, tests in ans_data.items():
                year = int(year_str)
                for test_str, test_data in tests.items():
                    test_num = int(test_str)
                    lc_answers = test_data.get("lc", {})
                    rc_answers = test_data.get("rc", {})
                    
                    listening_dict = {str(k): {"answer": str(v).strip().upper(), "explanation": ""} for k, v in lc_answers.items()}
                    reading_dict = {str(k): {"answer": str(v).strip().upper(), "explanation": ""} for k, v in rc_answers.items()}
                    
                    toeic_answers_coll.update_one(
                        {"book": year, "test": test_num},
                        {"$set": {
                            "listening": listening_dict,
                            "reading": reading_dict
                        }},
                        upsert=True
                    )
                    inserted_toeic_answers += 1
            print(f"  Successfully imported answers for {inserted_toeic_answers} ETS tests.")
        except Exception as e:
            print(f"  Error seeding ETS answers: {e}")
    else:
        print(f"  Warning: '{ets_answers_path}' answers file not found.")

    # 5. Seeding IELTS Audio Assets
    print("Seeding IELTS Audio Assets...")
    ielts_audio_path = config_dir / "ielts_audio_assets.json"
    if ielts_audio_path.exists():
        try:
            with open(ielts_audio_path, "r", encoding="utf-8") as f:
                audio_data = json.load(f)
            
            audio_coll = db.audio_collection()
            inserted_ielts_audio = 0
            for a in audio_data:
                audio_coll.update_one(
                    {"book": a["book"], "test_number": a["test_number"], "file_name": a["file_name"]},
                    {"$set": a},
                    upsert=True
                )
                inserted_ielts_audio += 1
            print(f"  Successfully seeded {inserted_ielts_audio} IELTS audio assets.")
        except Exception as e:
            print(f"  Error seeding IELTS audio: {e}")
    else:
        print(f"  Warning: '{ielts_audio_path}' not found.")

    # 6. Seeding TOEIC Audio Assets
    print("Seeding TOEIC Audio Assets...")
    toeic_audio_path = config_dir / "toeic_audio_assets.json"
    if toeic_audio_path.exists():
        try:
            with open(toeic_audio_path, "r", encoding="utf-8") as f:
                audio_data = json.load(f)
            
            toeic_audio_coll = db.toeic_audio_collection()
            inserted_toeic_audio = 0
            for a in audio_data:
                toeic_audio_coll.update_one(
                    {"book": a["book"], "test_number": a["test_number"], "file_name": a["file_name"]},
                    {"$set": a},
                    upsert=True
                )
                inserted_toeic_audio += 1
            print(f"  Successfully seeded {inserted_toeic_audio} TOEIC audio assets.")
        except Exception as e:
            print(f"  Error seeding TOEIC audio: {e}")
    else:
        print(f"  Warning: '{toeic_audio_path}' not found.")

    # 7. Seeding R2 Keys mapping
    print("Seeding R2 Keys mapping...")
    r2_keys_path = config_dir / "r2_keys.json"
    if r2_keys_path.exists():
        try:
            with open(r2_keys_path, "r", encoding="utf-8") as f:
                r2_keys_data = json.load(f)
            
            r2_coll = db.r2_keys_collection()
            inserted_r2_keys = 0
            for target_key, matched_key in r2_keys_data.items():
                r2_coll.update_one(
                    {"target_key": target_key},
                    {"$set": {"matched_key": matched_key}},
                    upsert=True
                )
                inserted_r2_keys += 1
            print(f"  Successfully seeded {inserted_r2_keys} R2 key mappings.")
        except Exception as e:
            print(f"  Error seeding R2 keys: {e}")
    else:
        print(f"  Warning: '{r2_keys_path}' not found.")

    # 8. Seeding Users
    print("Seeding Users...")
    users_path = config_dir / "users.json"
    if users_path.exists():
        try:
            import bcrypt
            with open(users_path, "r", encoding="utf-8") as f:
                users_data = json.load(f)
            
            users_coll = db.users_collection()
            seeded_users = 0
            for user_item in users_data:
                email = user_item.get("email", "").strip().lower()
                if not email:
                    continue
                password = user_item.get("password", "")
                name = user_item.get("name", "").strip()
                role = user_item.get("role", "pending")
                
                # Hash password with bcrypt
                password_hash = bcrypt.hashpw(
                    password.encode("utf-8"), bcrypt.gensalt()
                ).decode("utf-8")
                
                now = datetime.utcnow().isoformat()
                existing = users_coll.find_one({"email": email})
                if existing:
                    users_coll.update_one(
                        {"email": email},
                        {"$set": {
                            "name": name or existing.get("name", ""),
                            "password_hash": password_hash,
                            "role": role,
                            "updated_at": now,
                        }}
                    )
                else:
                    users_coll.insert_one({
                        "id": str(uuid4()),
                        "email": email,
                        "name": name,
                        "password_hash": password_hash,
                        "role": role,
                        "created_at": now,
                        "updated_at": now,
                    })
                seeded_users += 1
            print(f"  Successfully seeded/updated {seeded_users} users.")
        except ImportError:
            print("  Error: bcrypt package not installed. Run: pip install bcrypt")
        except Exception as e:
            print(f"  Error seeding Users: {e}")
    else:
        print(f"  Warning: '{users_path}' not found.")

    # 9. Seeding Vocabulary
    print("Seeding Vocabulary...")
    vocab_path = config_dir / "vocabulary.json"
    if vocab_path.exists():
        try:
            with open(vocab_path, "r", encoding="utf-8") as f:
                vocab_data = json.load(f)
            
            vocab_coll = db.vocabulary_collection()
            if vocab_coll is not None:
                # Deduplicate by lowercase word
                seen = set()
                deduped = []
                for item in vocab_data:
                    word = item.get("vocab", "").strip()
                    if not word:
                        continue
                    word_lower = word.lower()
                    if word_lower not in seen:
                        seen.add(word_lower)
                        deduped.append({
                            "vocab": word,
                            "pronunciation": item.get("pronunciation", "").strip(),
                            "POS": item.get("POS", "").strip(),
                            "definition": item.get("definition", "").strip()
                        })
                
                if deduped:
                    from pymongo import UpdateOne
                    operations = []
                    for item in deduped:
                        operations.append(UpdateOne(
                            {"vocab": item["vocab"]},
                            {"$set": item},
                            upsert=True
                        ))
                    res = vocab_coll.bulk_write(operations)
                    print(f"  Successfully processed/seeded {len(operations)} vocabulary items.")
            else:
                print("  Warning: Vocabulary collection not available in DB.")
        except Exception as e:
            print(f"  Error seeding Vocabulary: {e}")
    else:
        print(f"  Warning: '{vocab_path}' not found.")

    print("\nDatabase sync complete!")

def main():
    parser = argparse.ArgumentParser(description="Unified Database Seeder for IELTS Platform")
    parser.add_argument("--delete", action="store_true", help="Delete all documents from collections")
    parser.add_argument("--import", dest="import_data", action="store_true", help="Import seed data into collections")
    
    args = parser.parse_args()
    
    # If neither option is set, do both (delete then import)
    if not args.delete and not args.import_data:
        args.delete = True
        args.import_data = True
        
    if args.delete:
        delete_data()
        
    if args.import_data:
        import_data()

if __name__ == "__main__":
    main()
