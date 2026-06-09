import json
import re
import sys
from pathlib import Path
import fitz

sys.stdout.reconfigure(encoding='utf-8')

repo_root = Path("d:/Git/practice_IELTS_web")
books_dir = repo_root / "TRỌN BỘ CAMBRIDGE IELTS 1 - 20 ACADEMIC"

def detect_layout(pdf_path: Path) -> dict:
    doc = fitz.open(str(pdf_path))
    
    # We will record page indexes (1-based) where sections start
    # Structure: test_num -> skill/section -> page_num
    events = []
    
    current_test = None
    
    for page_idx in range(len(doc)):
        page_num = page_idx + 1
        text = doc[page_idx].get_text("text")
        text_upper = text.upper()
        
        # 1. Detect Test boundaries
        test_match = re.search(r"\bTEST\s+([1-4])\b", text_upper)
        if test_match:
            # Check context to verify it's a test start header page (contains listening/reading)
            if "LISTENING" in text_upper or "READING" in text_upper or "WRITING" in text_upper:
                # If we see "TEST 1" on page 10, it's the start
                test_num = int(test_match.group(1))
                # Avoid switching test context incorrectly if it's just a reference
                if not current_test or test_num == current_test + 1 or (current_test == 4 and test_num == 1):
                    current_test = test_num
                    events.append(("TEST_START", current_test, page_num))
        
        if not current_test:
            continue
            
        # 2. Detect Listening sections
        # In newer books (15+), "SECTION" became "PART"
        if "LISTENING" in text_upper:
            if "SECTION 1" in text_upper or "PART 1" in text_upper:
                events.append(("L_SEC_1", current_test, page_num))
            elif "SECTION 2" in text_upper or "PART 2" in text_upper:
                events.append(("L_SEC_2", current_test, page_num))
            elif "SECTION 3" in text_upper or "PART 3" in text_upper:
                events.append(("L_SEC_3", current_test, page_num))
            elif "SECTION 4" in text_upper or "PART 4" in text_upper:
                events.append(("L_SEC_4", current_test, page_num))
                
        # 3. Detect Reading passages
        if "READING PASSAGE 1" in text_upper:
            events.append(("R_PAS_1", current_test, page_num))
        elif "READING PASSAGE 2" in text_upper:
            events.append(("R_PAS_2", current_test, page_num))
        elif "READING PASSAGE 3" in text_upper:
            events.append(("R_PAS_3", current_test, page_num))
            
        # 4. Detect Writing tasks
        if "WRITING TASK 1" in text_upper:
            events.append(("W_TASK_1", current_test, page_num))
        elif "WRITING TASK 2" in text_upper:
            events.append(("W_TASK_2", current_test, page_num))
            
        # 5. Detect Speaking parts
        if "SPEAKING" in text_upper and "PART 1" in text_upper:
            # Speaking page
            events.append(("S_PART_1", current_test, page_num))
            
    doc.close()
    
    # Process events to build structured ranges
    layout = {}
    for t in range(1, 5):
        layout[t] = {
            "listening": [],
            "reading": [],
            "writing": [],
            "speaking": []
        }
        
    # Standardize events to build ranges
    # Listening sections
    for t in range(1, 5):
        # Find start pages for Listening sections
        l1 = next((p for ev, test, p in events if test == t and ev == "L_SEC_1"), None)
        l2 = next((p for ev, test, p in events if test == t and ev == "L_SEC_2"), None)
        l3 = next((p for ev, test, p in events if test == t and ev == "L_SEC_3"), None)
        l4 = next((p for ev, test, p in events if test == t and ev == "L_SEC_4"), None)
        
        # Passage starts
        r1 = next((p for ev, test, p in events if test == t and ev == "R_PAS_1"), None)
        r2 = next((p for ev, test, p in events if test == t and ev == "R_PAS_2"), None)
        r3 = next((p for ev, test, p in events if test == t and ev == "R_PAS_3"), None)
        
        # Writing tasks
        w1 = next((p for ev, test, p in events if test == t and ev == "W_TASK_1"), None)
        w2 = next((p for ev, test, p in events if test == t and ev == "W_TASK_2"), None)
        
        # Speaking
        s1 = next((p for ev, test, p in events if test == t and ev == "S_PART_1"), None)
        
        # Resolve page ranges based on next section start
        # 1. Listening Sections
        if l1 and l2:
            layout[t]["listening"].append({"section": 1, "pages": list(range(l1, l2))})
        if l2 and l3:
            layout[t]["listening"].append({"section": 2, "pages": list(range(l2, l3))})
        if l3 and l4:
            layout[t]["listening"].append({"section": 3, "pages": list(range(l3, l4))})
        if l4 and r1:
            layout[t]["listening"].append({"section": 4, "pages": list(range(l4, r1))})
            
        # 2. Reading Passages
        if r1 and r2:
            layout[t]["reading"].append({"passage": 1, "pages": list(range(r1, r2))})
        if r2 and r3:
            layout[t]["reading"].append({"passage": 2, "pages": list(range(r2, r3))})
        if r3 and w1:
            layout[t]["reading"].append({"passage": 3, "pages": list(range(r3, w1))})
            
        # 3. Writing
        if w1 and w2:
            layout[t]["writing"].append({"task": 1, "pages": [w1]})
        if w2 and s1:
            layout[t]["writing"].append({"task": 2, "pages": [w2]})
            
        # 4. Speaking
        if s1:
            # Speaking is usually 1 page
            layout[t]["speaking"].append({"part": 1, "pages": [s1]})
            
    return layout

def main():
    # Let's test on Book 11 first
    pdf11 = books_dir / "Cambridge IELTS 11" / "Cambridge IELTS 11" / "Cambridge IELTS 11" / "Cambridge IELTS 11" / "Cambridge-IELTS-11-Academic.pdf"
    if pdf11.exists():
        print("Detecting Book 11 Layout...")
        layout11 = detect_layout(pdf11)
        print("Test 1 Reading:")
        print(layout11[1]["reading"])
        print("Test 1 Listening:")
        print(layout11[1]["listening"])
        
    # Loop over all standardized books to generate layouts
    all_layouts = {}
    for book in range(11, 21):
        book_folder = books_dir / f"Cambridge IELTS {book}"
        pdf_path = book_folder / f"Cambridge_IELTS_{book}_Academic.pdf"
        if pdf_path.exists():
            print(f"\nProcessing layouts for Book {book}...")
            all_layouts[book] = detect_layout(pdf_path)
            
    # Write to a JSON file in phase0 outputs
    out_path = Path(__file__).parent / "output" / "cambridge_all_layouts.json"
    out_path.write_text(json.dumps(all_layouts, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nWrote all layouts to {out_path.name}")

if __name__ == "__main__":
    main()
