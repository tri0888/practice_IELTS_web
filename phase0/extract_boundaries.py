import json
import re
import sys
from pathlib import Path
import fitz

sys.stdout.reconfigure(encoding='utf-8')

repo_root = Path("d:/Git/practice_IELTS_web")
books_dir = repo_root / "TRỌN BỘ CAMBRIDGE IELTS 1 - 20 ACADEMIC"
output_dir = repo_root / "phase0" / "output"
output_dir.mkdir(parents=True, exist_ok=True)

# Regex patterns
test_pat = re.compile(r"\bTEST\s+([1-4])\b", re.IGNORECASE)
listening_pat = re.compile(r"\b(?:SECTION|PART)\s+([1-4])\b", re.IGNORECASE)
reading_pat = re.compile(r"\b(?:READING\s+)?PASSAGE\s+([1-3])\b", re.IGNORECASE)
reading_q_pat = re.compile(r"\bQUESTIONS\s+(\d+)\s*[-–—]\s*(\d+)\b", re.IGNORECASE)
writing_pat = re.compile(r"\bWRITING\s+TASK\s+([1-2])\b", re.IGNORECASE)
speaking_pat = re.compile(r"^\s*SPEAKING\b", re.IGNORECASE)

def scan_selectable_book(book_id: int) -> dict:
    pdf_path = books_dir / f"Cambridge IELTS {book_id}" / f"Cambridge_IELTS_{book_id}_Academic.pdf"
    if not pdf_path.exists():
        print(f"Book {book_id} Academic PDF not found!")
        return {}
        
    doc = fitz.open(str(pdf_path))
    
    # Load layouts
    layouts_file = output_dir / "cambridge_all_layouts.json"
    if not layouts_file.exists():
         print("Error: cambridge_all_layouts.json not found. Run generate_perfect_layouts.py first.")
         return {}
         
    layouts = json.loads(layouts_file.read_text(encoding="utf-8"))
    book_layout = layouts.get(str(book_id), {})
    
    book_map = {}
    
    # Word numbers mapping
    word_to_num = {
        "one": 1, "two": 2, "three": 3, "four": 4,
        "1": 1, "2": 2, "3": 3, "4": 4
    }
    
    # Precompile regexes
    listening_pat = re.compile(
        r"\b(?:SECTION|PART)\s*(1|2|3|4|ONE|TWO|THREE|FOUR|One|Two|Three|Four)\b",
        re.IGNORECASE
    )
    reading_pat = re.compile(
        r"\b(?:READING\s+)?PASSAGE\s*(1|2|3|ONE|TWO|THREE|One|Two|Three)\b",
        re.IGNORECASE
    )
    reading_q_pat = re.compile(
        r"\bQUESTIONS\s*(\d+)\s*[-–—]\s*(\d+)\b",
        re.IGNORECASE
    )
    writing_pat = re.compile(
        r"\b(?:WRITING\s+)?TASK\s*(1|2|ONE|TWO|One|Two)\b",
        re.IGNORECASE
    )
    speaking_pat = re.compile(
        r"^\s*SPEAKING\b",
        re.IGNORECASE
    )
    
    for t in range(1, 5):
        book_map[t] = {}
        test_str = str(t)
        if test_str not in book_layout:
            continue
            
        test_layout = book_layout[test_str]
        
        # Flatten test pages
        test_pages = set()
        for item in test_layout.get("listening", []):
            test_pages.update(item["pages"])
        for item in test_layout.get("reading", []):
            test_pages.update(item["passage_pages"])
            for g in item.get("groups", []):
                test_pages.add(g["page"])
        for item in test_layout.get("writing", []):
            test_pages.update(item["pages"])
        for item in test_layout.get("speaking", []):
            test_pages.update(item["pages"])
            
        if not test_pages:
            continue
            
        min_page = min(test_pages)
        max_page = max(test_pages)
        
        # Scan pages
        events = []
        for p in range(min_page - 1, max_page):
            if p < 0 or p >= len(doc):
                continue
            page_num = p + 1
            page = doc[p]
            blocks = page.get_text("blocks")
            blocks.sort(key=lambda b: (b[1], b[0]))
            
            for b in blocks:
                x0, y0, x1, y1, text, block_no, block_type = b
                text_clean = " ".join(text.split()).strip()
                if not text_clean:
                    continue
                if y0 < 30: # Ignore headers
                    continue
                    
                # Match Listening sections
                lm = listening_pat.search(text_clean)
                if lm:
                    val = lm.group(1).lower()
                    sec_num = word_to_num.get(val)
                    if sec_num:
                        events.append((f"listening_{sec_num}", page_num, y0))
                        
                # Match Reading passages
                rm = reading_pat.search(text_clean)
                if rm:
                    val = rm.group(1).lower()
                    pas_num = word_to_num.get(val)
                    if pas_num:
                        events.append((f"reading_{pas_num}", page_num, y0))
                        
                # Match Reading questions
                rqm = reading_q_pat.search(text_clean)
                if rqm:
                    q_start = int(rqm.group(1))
                    pas_num = 1 if q_start <= 13 else 2 if q_start <= 26 else 3
                    events.append((f"reading_q_{pas_num}", page_num, y0))
                    
                # Match Writing Tasks
                wm = writing_pat.search(text_clean)
                if wm:
                    val = wm.group(1).lower()
                    task_num = word_to_num.get(val)
                    if task_num:
                        events.append((f"writing_{task_num}", page_num, y0))
                        
                # Match Speaking
                sm = speaking_pat.match(text_clean)
                if sm:
                    events.append(("speaking", page_num, y0))
                    
        # Deduplicate and sort events
        seen_keys = set()
        dedup_events = []
        for key, p, y in events:
            if key not in seen_keys:
                seen_keys.add(key)
                dedup_events.append((key, p, y))
                
        dedup_events.sort(key=lambda ev: (ev[1], ev[2]))
        
        expected_keys = [
            "listening_1", "listening_2", "listening_3", "listening_4",
            "reading_1", "reading_q_1", "reading_2", "reading_q_2", "reading_3", "reading_q_3",
            "writing_1", "writing_2", "speaking"
        ]
        
        # Filter expected
        dedup_events = [ev for ev in dedup_events if ev[0] in expected_keys]
        
        # Inject layout fallbacks for missing events
        for expected in expected_keys:
            if not any(ev[0] == expected for ev in dedup_events):
                start_p = None
                if expected.startswith("listening_"):
                    sec_num = int(expected.split("_")[1])
                    item = next((x for x in test_layout.get("listening", []) if x["section"] == sec_num), None)
                    if item: start_p = item["pages"][0]
                elif expected.startswith("reading_q_"):
                    pas_num = int(expected.split("_")[2])
                    item = next((x for x in test_layout.get("reading", []) if x["passage"] == pas_num), None)
                    if item and item.get("groups"): start_p = item["groups"][0]["page"]
                elif expected.startswith("reading_"):
                    pas_num = int(expected.split("_")[1])
                    item = next((x for x in test_layout.get("reading", []) if x["passage"] == pas_num), None)
                    if item: start_p = item["passage_pages"][0]
                elif expected.startswith("writing_"):
                    task_num = int(expected.split("_")[1])
                    item = next((x for x in test_layout.get("writing", []) if x["task"] == task_num), None)
                    if item: start_p = item["pages"][0]
                elif expected == "speaking":
                    item = test_layout.get("speaking", [None])[0]
                    if item: start_p = item["pages"][0]
                    
                if start_p:
                    dedup_events.append((expected, start_p, 0.0))
                    
        dedup_events.sort(key=lambda ev: (ev[1], ev[2]))
        
        # Segment partition
        for i in range(len(dedup_events)):
            curr_key, p_curr, y_curr = dedup_events[i]
            
            if i + 1 < len(dedup_events):
                next_key, p_next, y_next = dedup_events[i+1]
            else:
                # Until the end page of Speaking or PDF end
                speaking_item = test_layout.get("speaking", [None])[0]
                speaking_max_p = speaking_item["pages"][-1] if speaking_item else max_page
                next_key, p_next, y_next = "end", speaking_max_p, doc[speaking_max_p - 1].rect.height
                
            segments = []
            if p_curr == p_next:
                if y_next > y_curr:
                    segments.append({"page": p_curr, "y_start": y_curr, "y_end": y_next})
                else:
                    segments.append({"page": p_curr, "y_start": y_curr, "y_end": doc[p_curr - 1].rect.height})
            else:
                segments.append({"page": p_curr, "y_start": y_curr, "y_end": doc[p_curr - 1].rect.height})
                for p_mid in range(p_curr + 1, p_next):
                    segments.append({"page": p_mid, "y_start": 0.0, "y_end": doc[p_mid - 1].rect.height})
                segments.append({"page": p_next, "y_start": 0.0, "y_end": y_next})
                
            book_map[t][curr_key] = segments
            
        # Adjust y_start to 0.0 if not shared with a preceding section's end page
        for key, segments in book_map[t].items():
            if not segments:
                continue
            p_first = segments[0]["page"]
            shared = False
            for other_key, other_segs in book_map[t].items():
                if other_key == key or not other_segs:
                    continue
                if other_segs[-1]["page"] == p_first:
                    shared = True
                    break
            if not shared:
                segments[0]["y_start"] = 0.0
                
    doc.close()
    return book_map

def generate_scanned_fallback(book_id: int, doc_len: int, page_height: float) -> dict:
    book_map = {}
    
    test_starts = [10, 33, 57, 80] if book_id == 12 else [10, 31, 52, 73]
    
    for t_idx, base in enumerate(test_starts):
        t = t_idx + 1
        book_map[t] = {}
        
        l1 = [base, base + 1]
        l2 = [base + 2, base + 3]
        l3 = [base + 4, base + 5]
        
        if t == 4 and book_id == 12:
            l4 = [base + 6]
            r1_start = base + 7
        else:
            l4 = [base + 6, base + 7]
            r1_start = base + 8
            
        r2_start = r1_start + 4
        r3_start = r2_start + 4
        w1_start = r3_start + 4
        w2_start = w1_start + 1
        speaking_start = w2_start + 1
        
        sections = {
            "listening_1": l1,
            "listening_2": l2,
            "listening_3": l3,
            "listening_4": l4,
            "reading_1": [r1_start, r1_start + 1],
            "reading_q_1": [r1_start + 2, r1_start + 3],
            "reading_2": [r2_start, r2_start + 1],
            "reading_q_2": [r2_start + 2, r2_start + 3],
            "reading_3": [r3_start, r3_start + 1],
            "reading_q_3": [r3_start + 2, r3_start + 3],
            "writing_1": [w1_start],
            "writing_2": [w2_start],
            "speaking": [speaking_start]
        }
        
        for key, pages in sections.items():
            segments = []
            for p in pages:
                if p <= doc_len:
                    segments.append({"page": p, "y_start": 0.0, "y_end": page_height})
            book_map[t][key] = segments
            
    return book_map

def main():
    all_boundaries = {}
    
    # 1. Scan selectable books (Book 18 is moved to scanned_books)
    selectable_books = [11, 13, 14, 15, 16, 17, 20]
    for book in selectable_books:
        print(f"Scanning selectable Book {book}...")
        all_boundaries[str(book)] = scan_selectable_book(book)
        print(f"  Mapped {len(all_boundaries[str(book)])} tests.")
        
    # 2. Scanned books fallback (including Book 18)
    scanned_books = [(12, 131, 842.0), (18, 147, 842.0), (19, 138, 842.0)]
    for book, doc_len, page_h in scanned_books:
        print(f"Generating fallback map for scanned Book {book}...")
        all_boundaries[str(book)] = generate_scanned_fallback(book, doc_len, page_h)
        print(f"  Generated {len(all_boundaries[str(book)])} fallback tests.")
        
    # 3. Write output JSON
    out_path = output_dir / "cambridge_boundaries.json"
    out_path.write_text(json.dumps(all_boundaries, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nSuccessfully wrote boundaries to {out_path.name}")

if __name__ == "__main__":
    main()
