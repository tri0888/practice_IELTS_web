import os
import sys
import json
import argparse
import re
from pathlib import Path

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
        "ielts_tests": db.tests_collection(),
        "ielts_audio_assets": db.audio_collection(),
        "ielts_layouts": db.layouts_collection(),
        "ielts_answers": db.answers_collection(),
        "toeic_tests": db.toeic_tests_collection(),
        "toeic_audio_assets": db.toeic_audio_collection(),
        "toeic_layouts": db.toeic_layouts_collection(),
        "toeic_answers": db.toeic_answers_collection(),
        "histories": db.histories_collection(),
        "r2_key_cache": db._db["r2_key_cache"] if db.is_available() else None
    }
    
    for name, coll in collections.items():
        if coll is not None:
            res = coll.delete_many({})
            print(f"Deleted {res.deleted_count} documents from '{name}' collection.")
        else:
            print(f"Collection '{name}' is not available.")

def import_data():
    print("\n--- Importing Seed Data ---")
    if not db.is_available():
        print("Error: MongoDB database is not available.")
        sys.exit(1)

    repo_root = backend_dir.parent
    
    # 1. Import Tests & Audio Assets
    print("Seeding tests and audio assets...")
    search_dirs = [
        repo_root / "output",
        repo_root / "phase0" / "output",
        config_dir
    ]
    
    seed_files = []
    for d in search_dirs:
        if d.exists():
            seed_files.extend(list(d.glob("cambridge_*_seed.json")))
            
    # Remove duplicates if any
    seed_files = list({f.resolve(): f for f in seed_files}.values())
    
    tests_coll = db.tests_collection()
    audio_coll = db.audio_collection()
    
    inserted_tests = 0
    inserted_audio = 0
    
    if seed_files:
        for seed_file in sorted(seed_files, key=lambda f: f.name):
            try:
                # Extract book number from filename, e.g., cambridge_11_seed.json -> 11
                parts = seed_file.stem.split("_")
                book_num = int(parts[1])
            except Exception:
                continue
                
            print(f"  Reading seed file: {seed_file.name} (Book {book_num})")
            try:
                with open(seed_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    
                for t in data.get("tests", []):
                    t["book"] = book_num
                    tests_coll.update_one(
                        {"book": book_num, "test_number": t["test_number"]},
                        {"$set": t},
                        upsert=True
                    )
                    inserted_tests += 1
                    
                    # Also seed default answers from the test seed data
                    ans_coll = db.answers_collection()
                    answers = {}
                    for section in t.get("sections", []):
                        for row in section.get("rows", []):
                            answers[str(row["question_number"])] = {
                                "answer": row.get("answer_text", ""),
                                "explanation": row.get("explanation_text", "")
                            }
                    if answers:
                        ans_coll.update_one(
                            {"book": book_num, "test": t["test_number"]},
                            {"$set": {"answers": answers}},
                            upsert=True
                        )
                    
                for a in data.get("audio_assets", []):
                    a["book"] = book_num
                    audio_coll.update_one(
                        {"book": book_num, "test_number": a["test_number"], "file_name": a["file_name"]},
                        {"$set": a},
                        upsert=True
                    )
                    inserted_audio += 1
            except Exception as e:
                print(f"  Error seeding from {seed_file.name}: {e}")
    else:
        print("  Warning: No 'cambridge_*_seed.json' files found. Generating default Cambridge IELTS tests and audio assets mapping from layout structure...")
        
        # Fallback 1: Generate tests dynamically based on layouts mapping
        layouts_json_path = config_dir / "cambridge_all_layouts.json"
        layouts_data = {}
        if layouts_json_path.exists():
            try:
                with open(layouts_json_path, "r", encoding="utf-8") as f:
                    layouts_data = json.load(f)
            except Exception as e:
                print(f"  Error reading {layouts_json_path} for tests seeding: {e}")

        if layouts_data:
            print("  Generating tests from layouts mapping...")
            for book_str, tests in layouts_data.items():
                book_num = int(book_str)
                # Skip Book 20 if present
                if book_num == 20:
                    continue
                for test_str, layout_content in tests.items():
                    test_num = int(test_str)
                    
                    # Build sections dynamically based on what is in the layout
                    sections = []
                    for skill in ["listening", "reading", "writing", "speaking"]:
                        if skill in layout_content:
                            sections.append({"name": skill})
                    
                    test_doc = {
                        "book": book_num,
                        "test_number": test_num,
                        "sections": sections if sections else [
                            { "name": "listening" },
                            { "name": "reading" },
                            { "name": "writing" },
                            { "name": "speaking" }
                        ]
                    }
                    tests_coll.update_one(
                        {"book": book_num, "test_number": test_num},
                        {"$set": test_doc},
                        upsert=True
                    )
                    inserted_tests += 1
        else:
            print("  Fallback: Generating default 36 tests (Books 11-19, Tests 1-4)...")
            for book_num in range(11, 20):
                for test_num in range(1, 5):
                    test_doc = {
                        "book": book_num,
                        "test_number": test_num,
                        "sections": [
                            { "name": "listening" },
                            { "name": "reading" },
                            { "name": "writing" },
                            { "name": "speaking" }
                        ]
                    }
                    tests_coll.update_one(
                        {"book": book_num, "test_number": test_num},
                        {"$set": test_doc},
                        upsert=True
                    )
                    inserted_tests += 1
                
        # Fallback 2: Scan Books folder and populate audio assets
        books_dir = repo_root / "Books" / "Cambridge IELTS 11-20"
        if books_dir.exists():
            for book_folder in books_dir.glob("Cam *"):
                try:
                    book_num = int(book_folder.name.split()[-1])
                except Exception:
                    continue
                for p in book_folder.glob("Audio/*.mp3"):
                    filename = p.name
                    # Parse test number from filename (e.g. Test1 Section1.mp3 -> test_number=1)
                    m = re.search(r"Test\s*(\d+)", filename, re.IGNORECASE)
                    test_number = int(m.group(1)) if m else 1
                    rel_path = p.relative_to(repo_root).as_posix()
                    
                    audio_doc = {
                        "book": book_num,
                        "test_number": test_number,
                        "file_name": filename,
                        "relative_path": rel_path
                    }
                    audio_coll.update_one(
                        {"book": book_num, "test_number": test_number, "file_name": filename},
                        {"$set": audio_doc},
                        upsert=True
                    )
                    inserted_audio += 1
        else:
            # Seed from ielts_audio_assets_seed.json mapped from R2
            audio_seed_path = config_dir / "ielts_audio_assets_seed.json"
            if audio_seed_path.exists():
                print("  Seeding audio assets from 'ielts_audio_assets_seed.json'...")
                try:
                    with open(audio_seed_path, "r", encoding="utf-8") as f:
                        seeded_assets = json.load(f)
                    for a in seeded_assets:
                        audio_coll.update_one(
                            {"book": a["book"], "test_number": a["test_number"], "file_name": a["file_name"]},
                            {"$set": a},
                            upsert=True
                        )
                        inserted_audio += 1
                except Exception as e:
                    print(f"  Error reading ielts_audio_assets_seed.json: {e}")
                    
        print(f"  Generated default setup: seeded {inserted_tests} tests and discovered {inserted_audio} audio assets.")

    # 2. Import Layouts
    print("Seeding layouts...")
    layouts_json_path = config_dir / "cambridge_all_layouts.json"
    if layouts_json_path.exists():
        try:
            with open(layouts_json_path, "r", encoding="utf-8") as f:
                layouts_data = json.load(f)
            
            layouts_coll = db.layouts_collection()
            inserted_layouts = 0
            for book_str, tests in layouts_data.items():
                book_id = int(book_str)
                # Skip Book 20 if present
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

    # 3. Import Answers from Solution files
    print("Seeding answers from Solution files...")
    solution_files = list(config_dir.glob("cambridge_*_solution.json"))
    if not solution_files:
        print("  Warning: No 'cambridge_*_solution.json' files found. Skipping answers sync.")
    else:
        inserted_answers = 0
        for sol_file in sorted(solution_files, key=lambda f: f.name):
            try:
                # Extract book number from filename, e.g., cambridge_11_solution.json -> 11
                parts = sol_file.stem.split("_")
                book_num = int(parts[1])
            except Exception:
                continue
                
            try:
                with open(sol_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    
                tests = data.get("tests")
                if tests is None:
                    tests = {k: v for k, v in data.items() if k.startswith("test_")}
                    
                ans_coll = db.answers_collection()
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
                        inserted_answers += 1
            except Exception as e:
                print(f"  Error importing answers from {sol_file.name}: {e}")
        print(f"  Successfully imported/updated answers for {inserted_answers} tests.")

    # Cleanup Book 20
    print("Excluding Book 20 from database collections...")
    r_tests = db.tests_collection().delete_many({'book': 20})
    r_layouts = db.layouts_collection().delete_many({'book': 20})
    r_answers = db.answers_collection().delete_many({'book': 20})
    r_audio = db.audio_collection().delete_many({'book': 20})
    r_histories = db.histories_collection().delete_many({'book': 20})
    print(f"  Cleanup Book 20 documents deleted: {r_tests.deleted_count} tests, {r_layouts.deleted_count} layouts, {r_answers.deleted_count} answers, {r_audio.deleted_count} audio, {r_histories.deleted_count} histories.")
    
    # 3b. Seed TOEIC dynamic data
    print("\nSeeding dynamic TOEIC data...")
    toeic_tests_coll = db.toeic_tests_collection()
    toeic_layouts_coll = db.toeic_layouts_collection()
    toeic_answers_coll = db.toeic_answers_collection()
    toeic_audio_coll = db.toeic_audio_collection()

    toeic_tests_inserted = 0
    toeic_layouts_inserted = 0
    toeic_answers_inserted = 0
    toeic_audio_inserted = 0

    # Load ETS layouts dynamically from config file
    ets_layouts_path = config_dir / "ETS_all_layouts.json"
    ets_layouts_data = {}
    if ets_layouts_path.exists():
        try:
            with open(ets_layouts_path, "r", encoding="utf-8") as f:
                ets_layouts_data = json.load(f)
            print(f"  Loaded dynamic ETS layouts from '{ets_layouts_path.name}'.")
        except Exception as e:
            print(f"  Error reading ETS layouts JSON: {e}")

    # Default TOEIC layouts (fallback)
    default_toeic_layout = {
        "listening": [
            { "section": 1, "pages": [2] },
            { "section": 2, "pages": [3] },
            { "section": 3, "pages": [4, 5, 6, 7, 8] },
            { "section": 4, "pages": [9, 10, 11, 12, 13] }
        ],
        "reading": [
            { "passage": 5, "passage_pages": [2, 3, 4, 5] },
            { "passage": 6, "passage_pages": [6, 7, 8, 9] },
            { "passage": 7, "passage_pages": [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20] }
        ]
    }

    def make_range(start, end):
        return list(range(start, end + 1))

    # 1. Tests & Layouts
    for year in [2024, 2026]:
        for test_num in range(1, 11):
            test_doc = {
                "book": year,
                "test_number": test_num,
                "sections": [
                    { "name": "listening" },
                    { "name": "reading" }
                ]
            }
            toeic_tests_coll.update_one(
                {"book": year, "test_number": test_num},
                {"$set": test_doc},
                upsert=True
            )
            toeic_tests_inserted += 1

            # Resolve layout dynamically from ETS_all_layouts.json
            year_key = f"ETS {year}"
            layout_doc = None
            if year_key in ets_layouts_data:
                lc_list = ets_layouts_data[year_key].get("lc", [])
                rc_list = ets_layouts_data[year_key].get("rc", [])
                
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

            if not layout_doc:
                layout_doc = default_toeic_layout

            toeic_layouts_coll.update_one(
                {"book": year, "test": test_num},
                {"$set": {"layout": layout_doc}},
                upsert=True
            )
            toeic_layouts_inserted += 1

    # 2. Answers
    for year in [2024, 2026]:
        ans_file = config_dir / f"ets_{year}_answers.json"
        if ans_file.exists():
            try:
                with open(ans_file, "r", encoding="utf-8") as f:
                    ans_data = json.load(f)
                for test_str, test_data in ans_data.items():
                    test_num = int(test_str)
                    lc_answers = test_data.get("lc", {})
                    rc_answers = test_data.get("rc", {})
                    
                    # Convert to DB schema
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
                    toeic_answers_inserted += 1
            except Exception as e:
                print(f"  Error seeding TOEIC answers for {year}: {e}")

    # 3. Audio Assets
    toeic_audio_seed_path = config_dir / "toeic_audio_assets_seed.json"
    if toeic_audio_seed_path.exists():
        print("  Seeding TOEIC audio assets from 'toeic_audio_assets_seed.json'...")
        try:
            with open(toeic_audio_seed_path, "r", encoding="utf-8") as f:
                seeded_assets = json.load(f)
            for a in seeded_assets:
                toeic_audio_coll.update_one(
                    {"book": a["book"], "test_number": a["test_number"], "file_name": a["file_name"]},
                    {"$set": a},
                    upsert=True
                )
                toeic_audio_inserted += 1
        except Exception as e:
            print(f"  Error reading toeic_audio_assets_seed.json: {e}")
    else:
        # Fallback to key cache seed mappings
        r2_cache_path = config_dir / "r2_key_cache_seed.json"
        if r2_cache_path.exists():
            try:
                with open(r2_cache_path, "r", encoding="utf-8") as f:
                    mappings = json.load(f)
                
                for target_key, matched_key in mappings.items():
                    match = re.search(r"ETS[\s_-]?(\d{4})/AUDIO/Test[\s_-]?(\d+)/(.+\.mp3)", matched_key, re.IGNORECASE)
                    if match:
                        year = int(match.group(1))
                        test_num = int(match.group(2))
                        file_name = match.group(3)
                        
                        audio_doc = {
                            "book": year,
                            "test_number": test_num,
                            "file_name": file_name,
                            "relative_path": matched_key
                        }
                        toeic_audio_coll.update_one(
                            {"book": year, "test_number": test_num, "file_name": file_name},
                            {"$set": audio_doc},
                            upsert=True
                        )
                        toeic_audio_inserted += 1
            except Exception as e:
                print(f"  Error seeding TOEIC audio assets: {e}")

    print(f"  Successfully seeded TOEIC dynamic data: {toeic_tests_inserted} tests, {toeic_layouts_inserted} layouts, {toeic_answers_inserted} answers, {toeic_audio_inserted} audio assets.\n")

    # 4. Seed R2 Key Cache mappings
    r2_cache_path = config_dir / "r2_key_cache_seed.json"
    if r2_cache_path.exists():
        print("\nSeeding R2 Key Cache mappings...")
        try:
            with open(r2_cache_path, "r", encoding="utf-8") as f:
                mappings = json.load(f)
            
            cache_coll = db._db["r2_key_cache"] if db._db is not None else None
            if cache_coll is not None:
                inserted_cache = 0
                for target_key, matched_key in mappings.items():
                    cache_coll.update_one(
                        {"target_key": target_key},
                        {"$set": {"matched_key": matched_key}},
                        upsert=True
                    )
                    inserted_cache += 1
                print(f"  Successfully seeded/updated {inserted_cache} R2 key mappings in cache.")
        except Exception as e:
            print(f"  Error seeding R2 key cache: {e}")
            
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
