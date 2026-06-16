import os
import sys
import json
from pathlib import Path

# Add backend app to path
backend_path = Path("d:/Git/practice_IELTS_web/backend")
sys.path.append(str(backend_path))

from app.models import database as db

def main():
    print("Starting database answers synchronization from Solution.json files...")
    if not db.is_available():
        print("Error: MongoDB database is not available.")
        sys.exit(1)
        
    ans_coll = db.answers_collection()
    if ans_coll is None:
        print("Error: Answers collection is not available.")
        sys.exit(1)
        
    # Clear existing answers
    print("Clearing answers collection...")
    ans_coll.delete_many({})
    
    # Path to books
    books_dir = Path("d:/Git/practice_IELTS_web/Books/Cambridge IELTS 11-20")
    if not books_dir.exists():
        print(f"Error: {books_dir} does not exist!")
        sys.exit(1)
        
    inserted = 0
    # Loop over book directories (e.g. Cam 11, Cam 12, etc.)
    for book_folder in sorted(books_dir.glob("Cam *"), key=lambda p: int(p.name.split()[-1])):
        solution_path = book_folder / "Solution.json"
        if not solution_path.exists():
            continue
            
        try:
            with open(solution_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                
            book_num = int(data.get("book"))
            
            # Support both nested 'tests' key and root-level tests
            tests = data.get("tests")
            if tests is None:
                tests = {k: v for k, v in data.items() if k.startswith("test_")}
                
            for test_key, test_data in tests.items():
                # Extract test number from test_1, test_2 etc.
                test_num = int(test_key.replace("test_", ""))
                
                listening_dict = {}
                reading_dict = {}
                
                # Listening
                listening = test_data.get("listening", {})
                for section_key, section_data in listening.items():
                    for q_key, ans_text in section_data.items():
                        q_num = q_key.replace("Q", "").strip()
                        listening_dict[q_num] = {
                            "answer": str(ans_text).strip(),
                            "explanation": ""
                        }
                        
                # Reading
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
                    inserted += 1
                    print(f"  Seeded Book {book_num} Test {test_num} with {len(listening_dict)} listening & {len(reading_dict)} reading answers.")
                    
        except Exception as e:
            print(f"Error parsing {solution_path}: {e}")
            
    print(f"Finished answers synchronization. Seeded {inserted} tests successfully.")

if __name__ == "__main__":
    main()
