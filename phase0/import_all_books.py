import json
import re
import sys
from pathlib import Path
import fitz

sys.stdout.reconfigure(encoding='utf-8')

repo_root = Path("d:/Git/practice_IELTS_web")
books_dir = repo_root / "TRỌN BỘ CAMBRIDGE IELTS 1 - 20 ACADEMIC"
output_dir = Path(__file__).parent / "output"
output_dir.mkdir(parents=True, exist_ok=True)

# Load layout configurations
layout_path = output_dir / "cambridge_all_layouts.json"
if not layout_path.exists():
    print("Error: cambridge_all_layouts.json not found. Run generate_perfect_layouts.py first.")
    sys.exit(1)
    
all_layouts = json.loads(layout_path.read_text(encoding="utf-8"))

def find_audio_file(book_folder: Path, test: int, section: int) -> Path | None:
    # Recursively find mp3/m4a
    candidates = list(book_folder.rglob("*.mp3")) + list(book_folder.rglob("*.m4a"))
    candidates = [p for p in candidates if "__MACOSX" not in p.parts]
    
    # regex patterns to test
    patterns = [
        f"t{test}s{section}",
        f"test\s*{test}\s*(section|part)\s*{section}",
        f"t{test}_(audio|part|sec){section}",
        f"test_?{test}_?{section}",
        f"t{test}_s{section}",
        f"t{test}.*s{section}"
    ]
    
    for p in candidates:
        name_lower = p.name.lower()
        for pattern in patterns:
            if re.search(pattern, name_lower):
                return p
                
    # Soft fallbacks
    for p in candidates:
        name_lower = p.name.lower()
        if f"test{test}" in name_lower.replace(" ", "") or f"t{test}" in name_lower:
            if f"section{section}" in name_lower.replace(" ", "") or f"part{section}" in name_lower or f"s{section}" in name_lower or f"audio{section}" in name_lower:
                return p
                
    return None

def extract_pdf_page_text(doc: fitz.Document, pages: list[int]) -> str:
    texts = []
    for p in pages:
        if 0 < p <= len(doc):
            t = doc[p - 1].get_text("text").strip()
            if t:
                texts.append(t)
    return "\n\n".join(texts)

def build_book_content_and_seed(book: int):
    book_folder = books_dir / f"Cambridge IELTS {book}"
    pdf_path = book_folder / f"Cambridge_IELTS_{book}_Academic.pdf"
    
    if not pdf_path.exists():
        print(f"Skipping Book {book}: main PDF not found.")
        return
        
    doc = fitz.open(str(pdf_path))
    book_layout = all_layouts[str(book)]
    
    seed = {
        "tests": [],
        "audio_assets": []
    }
    
    for test_num in range(1, 5):
        test_layout = book_layout[str(test_num)]
        
        # 1. Content JSON structure
        content = {
            "book": book,
            "test": test_num,
            "listening": {
                "total_questions": 40,
                "duration_minutes": 30,
                "sections": []
            },
            "reading": {
                "total_questions": 40,
                "duration_minutes": 60,
                "passages": []
            },
            "writing": {
                "total_questions": 2,
                "duration_minutes": 60,
                "tasks": []
            },
            "speaking": {
                "parts": []
            }
        }
        
        # Listening
        for item in test_layout["listening"]:
            sec_num = item["section"]
            audio_p = find_audio_file(book_folder, test_num, sec_num)
            audio_name = audio_p.name if audio_p else f"IELTS{book}_Test{test_num}_Section{sec_num}.mp3"
            
            # Record audio asset in seed
            if audio_p:
                rel_path = audio_p.relative_to(repo_root).as_posix()
                seed["audio_assets"].append({
                    "book": book,
                    "test_number": test_num,
                    "file_name": audio_name,
                    "relative_path": rel_path
                })
                
            text = extract_pdf_page_text(doc, item["pages"])
            content["listening"]["sections"].append({
                "section_number": sec_num,
                "question_range": "1-10" if sec_num == 1 else "11-20" if sec_num == 2 else "21-30" if sec_num == 3 else "31-40",
                "instruction": "Complete the notes below.\nWrite ONE WORD ONLY for each answer." if sec_num == 4 else "Complete the notes below.",
                "content_text": text or f"Listening Section {sec_num} text from PDF.",
                "audio_file": audio_name
            })
            
        # Reading
        for idx, item in enumerate(test_layout["reading"]):
            pas_num = item["passage"]
            text = extract_pdf_page_text(doc, item["passage_pages"])
            
            # questions pages
            q_pages = list(set([g["page"] for g in item["groups"]]))
            q_text = extract_pdf_page_text(doc, q_pages)
            
            content["reading"]["passages"].append({
                "passage_number": pas_num,
                "title": f"Reading Passage {pas_num}",
                "passage_text": text or f"Reading Passage {pas_num} passage text from PDF.",
                "question_range": "1-13" if pas_num == 1 else "14-26" if pas_num == 2 else "27-40",
                "questions_text": q_text or f"Reading Passage {pas_num} questions text from PDF."
            })
            
        # Writing
        for item in test_layout["writing"]:
            task_num = item["task"]
            text = extract_pdf_page_text(doc, item["pages"])
            content["writing"]["tasks"].append({
                "task_number": task_num,
                "pages": item["pages"],
                "content_text": text or f"Writing Task {task_num} prompt text from PDF."
            })
            
        # Speaking
        for item in test_layout["speaking"]:
            text = extract_pdf_page_text(doc, item["pages"])
            content["speaking"]["parts"].append({
                "part_number": 1,
                "pages": item["pages"],
                "content_text": text or "Speaking parts prompts from PDF."
            })
            
        # Save content JSON
        out_content_path = output_dir / f"cambridge_{book}_test{test_num}_content.json"
        out_content_path.write_text(json.dumps(content, ensure_ascii=False, indent=2), encoding="utf-8")
        
        # Add to seed tests list
        seed["tests"].append({
            "test_number": test_num,
            "sections": [
                {"name": "Section 1", "rows": []},
                {"name": "Section 2", "rows": []},
                {"name": "Section 3", "rows": []},
                {"name": "Section 4", "rows": []},
                {"name": "Passage 1", "rows": []},
                {"name": "Passage 2", "rows": []},
                {"name": "Passage 3", "rows": []}
            ]
        })
        
    # Save seed manifest JSON
    out_seed_path = output_dir / f"cambridge_{book}_seed.json"
    out_seed_path.write_text(json.dumps(seed, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote Book {book} contents and seed manifests.")
    doc.close()

def main():
    for book in range(11, 21):
        build_book_content_and_seed(book)

if __name__ == "__main__":
    main()
