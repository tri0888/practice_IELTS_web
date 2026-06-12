import sys
import json
from pathlib import Path

# Setup paths to import from backend app
app_dir = Path(__file__).resolve().parent
backend_dir = app_dir.parent
sys.path.append(str(backend_dir))

from app import db

def main():
    print("Starting database layouts synchronization...")
    if not db.is_available():
        print("Error: MongoDB database is not available.")
        sys.exit(1)
        
    # Load JSON standard layout
    layouts_json_path = backend_dir / "config" / "cambridge_all_layouts.json"
    if not layouts_json_path.exists():
        print(f"Error: {layouts_json_path} does not exist!")
        sys.exit(1)
        
    with open(layouts_json_path, "r", encoding="utf-8") as f:
        layouts_data = json.load(f)
        
    print(f"Loaded layouts for {len(layouts_data)} books from JSON.")
    
    # Sync layouts collection
    layouts_coll = db.layouts_collection()
    if layouts_coll is None:
        print("Error: Layouts collection is not available.")
        sys.exit(1)
        
    # Clear existing layouts and reload
    print("Clearing layouts collection...")
    layouts_coll.delete_many({})
    
    inserted = 0
    for book_str, tests in layouts_data.items():
        book_id = int(book_str)
        for test_str, layout in tests.items():
            test_id = int(test_str)
            layouts_coll.update_one(
                {"book": book_id, "test": test_id},
                {"$set": {"layout": layout}},
                upsert=True
            )
            inserted += 1
            
    print(f"Successfully inserted/updated {inserted} layouts in MongoDB.")
    
    # Cleanup Book 20 documents from other collections if any exist
    print("Excluding Book 20 documents from all collections...")
    r_tests = db.tests_collection().delete_many({'book': 20})
    r_layouts = db.layouts_collection().delete_many({'book': 20})
    r_answers = db.answers_collection().delete_many({'book': 20})
    r_audio = db.audio_collection().delete_many({'book': 20})
    r_attempts = db.attempts_collection().delete_many({'book': 20})
    
    print(f"Cleanup results:")
    print(f"  tests: {r_tests.deleted_count}")
    print(f"  layouts: {r_layouts.deleted_count}")
    print(f"  answers: {r_answers.deleted_count}")
    print(f"  audio_assets: {r_audio.deleted_count}")
    print(f"  attempts: {r_attempts.deleted_count}")
    
    print("Database sync complete!")

if __name__ == "__main__":
    main()
