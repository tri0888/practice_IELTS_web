import re
import sys
import os
import json
import shutil
from pathlib import Path

# Fix Windows console UTF-8 printing
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Set up backend paths
backend_dir = Path(__file__).resolve().parent
repo_root = backend_dir.parent.parent
sys.path.append(str(backend_dir.parent))

from app import db

def parse_trang(text):
    # Normalize dashes and spaces
    text = text.replace('–', '-').replace('—', '-')
    m = re.search(r'trang\s*(\d+)(?:\s*-\s*(\d+))?', text, re.IGNORECASE)
    if m:
        start = int(m.group(1))
        end = int(m.group(2)) if m.group(2) else start
        return start, end
    return None

def parse_range(range_str):
    if not range_str or range_str == 'all':
        return 1, 40
    m = re.match(r'(\d+)\s*-\s*(\d+)', range_str)
    if m:
        return int(m.group(1)), int(m.group(2))
    return 1, 40

def distribute_pages(num_groups, start_page, end_page):
    if num_groups <= 0:
        return []
    if num_groups == 1:
        return [start_page]
    
    pages = []
    for i in range(num_groups):
        fraction = i / (num_groups - 1)
        p = start_page + fraction * (end_page - start_page)
        pages.append(int(p + 0.5))
    return pages

def main():
    print("Starting direct Cambridge page mapping process...")
    
    # 1. Locate CAMBRIDGE CONTENT.md
    md_path = None
    cambridge_dir = repo_root / "Full Book Cambridge IELTS"
    if cambridge_dir.exists():
        for p in cambridge_dir.glob("*.md"):
            if "CAMBRIDGE CONTENT" in p.name:
                md_path = p
                break
    if not md_path:
        md_path = cambridge_dir / "📚 CAMBRIDGE CONTENT.md"
        
    if not md_path.exists():
        print(f"Error: {md_path} not found!")
        sys.exit(1)
        
    print(f"Found markdown content at: {md_path}")
    content = md_path.read_text(encoding="utf-8")
    
    book_pattern = re.compile(r'\*\*(\d+)\.\s+CAMBRIDGE\s+IELTS\s+(\d+)', re.IGNORECASE)
    test_pattern = re.compile(r'\*\*\*Test\s+(\d+)\s*\*\*\*')
    
    lines = content.split('\n')
    current_book = None
    current_test = None
    test_blocks = {}
    
    # Gather raw block lines for each book and test
    for line in lines:
        line = line.strip()
        if not line:
            continue
        bm = book_pattern.search(line)
        if bm:
            current_book = int(bm.group(2))
            continue
        tm = test_pattern.search(line)
        if tm:
            current_test = int(tm.group(1))
            test_blocks[(current_book, current_test)] = []
            continue
        if current_book and current_test:
            test_blocks[(current_book, current_test)].append(line)
            
    # Process each test block
    parsed_layouts = {}
    
    for (book, test), block_lines in sorted(test_blocks.items()):
        # Exclude Book 20
        if book == 20:
            continue
            
        items = []
        for line in block_lines:
            line_lower = line.lower()
            if 'section' in line_lower or 'part' in line_lower:
                m_sec = re.search(r'(section|part)\s*(\d+)', line_lower)
                if m_sec:
                    sec_num = int(m_sec.group(2))
                    pages = parse_trang(line)
                    if pages:
                        items.append({
                            'type': 'listening',
                            'num': sec_num,
                            'start': pages[0],
                            'end': pages[1]
                        })
            elif 'passage' in line_lower:
                m_pas = re.search(r'passage\s*(\d+)', line_lower)
                if m_pas:
                    pas_num = int(m_pas.group(1))
                    pages = parse_trang(line)
                    if pages:
                        items.append({
                            'type': 'reading_passage',
                            'num': pas_num,
                            'start': pages[0],
                            'end': pages[1]
                        })
            elif 'question' in line_lower:
                m_q = re.search(r'questions?\s*(\d+)-(\d+)', line_lower)
                if m_q:
                    q_range = f'{m_q.group(1)}-{m_q.group(2)}'
                    pages = parse_trang(line)
                    if pages:
                        items.append({
                            'type': 'reading_questions',
                            'num': q_range,
                            'start': pages[0],
                            'end': pages[1]
                        })
            elif 'writing' in line_lower:
                pages = parse_trang(line)
                if pages:
                    items.append({
                        'type': 'writing',
                        'num': 1,
                        'start': pages[0],
                        'end': pages[1]
                    })
            elif 'speaking' in line_lower:
                pages = parse_trang(line)
                if pages:
                    items.append({
                        'type': 'speaking',
                        'num': 1,
                        'start': pages[0],
                        'end': pages[1]
                    })
                    
        # Apply sequential progression page computation
        for i in range(len(items)):
            curr = items[i]
            if i + 1 < len(items):
                nxt = items[i + 1]
                if curr['end'] < nxt['start'] - 1:
                    curr['end'] = nxt['start'] - 1
                    
        # Map Book 12 tests: 5->1, 6->2, 7->3, 8->4
        db_test_id = test
        if book == 12:
            db_test_id = test - 4
            
        # Initialize updated layout structure
        listening_layout = []
        reading_layout = []
        writing_layout = []
        speaking_layout = []
        
        # Load existing layout from MongoDB if available to preserve sub-group mappings and extra fields
        existing_layout = None
        if db.is_available():
            doc = db.layouts_collection().find_one({'book': book, 'test': db_test_id})
            if doc and 'layout' in doc:
                existing_layout = doc['layout']
                
        # 1. Listening
        l_items = [it for it in items if it['type'] == 'listening']
        for l_item in l_items:
            listening_layout.append({
                'section': l_item['num'],
                'pages': list(range(l_item['start'], l_item['end'] + 1))
            })
            
        # 2. Reading
        r_pas_items = [it for it in items if it['type'] == 'reading_passage']
        for r_pas in r_pas_items:
            pas_num = r_pas['num']
            pas_pages = list(range(r_pas['start'], r_pas['end'] + 1))
            
            # Find matching question items for this passage
            q_items = []
            for it in items:
                if it['type'] == 'reading_questions':
                    q_s, q_e = parse_range(it['num'])
                    if pas_num == 1 and q_s <= 13:
                        q_items.append(it)
                    elif pas_num == 2 and 14 <= q_s <= 26:
                        q_items.append(it)
                    elif pas_num == 3 and q_s >= 27:
                        q_items.append(it)
                        
            # Get existing subgroups if available
            existing_pas = None
            if existing_layout and 'reading' in existing_layout:
                existing_pas = next((p for p in existing_layout['reading'] if p.get('passage') == pas_num), None)
                
            db_groups = []
            if existing_pas and 'groups' in existing_pas:
                db_groups = [g.copy() for g in existing_pas['groups']]
                # Distribute pages across subgroups using matching logic
                groups_by_q_idx = {}
                for g_idx, g in enumerate(db_groups):
                    g_s, g_e = parse_range(g.get('range', ''))
                    matched_idx = None
                    for q_idx, q_item in enumerate(q_items):
                        q_item_s, q_item_e = parse_range(q_item['num'])
                        if q_item_s <= g_s <= q_item_e:
                            matched_idx = q_idx
                            break
                    if matched_idx is None:
                        matched_idx = len(q_items) - 1 if q_items else 0
                        
                    if matched_idx not in groups_by_q_idx:
                        groups_by_q_idx[matched_idx] = []
                    groups_by_q_idx[matched_idx].append((g_idx, g_s))
                    
                for q_idx, q_item in enumerate(q_items):
                    matching = groups_by_q_idx.get(q_idx, [])
                    if not matching:
                        continue
                    matching.sort(key=lambda x: x[1])
                    distributed = distribute_pages(len(matching), q_item['start'], q_item['end'])
                    for idx_in_matching, (g_idx, _) in enumerate(matching):
                        db_groups[g_idx]['page'] = distributed[idx_in_matching]
            else:
                # Default groups if not in database
                for q_item in q_items:
                    db_groups.append({
                        'range': q_item['num'],
                        'title': f"Questions {q_item['num']}",
                        'page': q_item['start']
                    })
                    
            reading_layout.append({
                'passage': pas_num,
                'passage_pages': pas_pages,
                'pages': pas_pages,
                'groups': db_groups
            })
            
        # 3. Writing
        w_item = next((it for it in items if it['type'] == 'writing'), None)
        if w_item:
            s = w_item['start']
            e = w_item['end']
            task1_pages = [s]
            task2_pages = list(range(s + 1, e + 1)) if e > s else [s]
            
            existing_w1 = None
            existing_w2 = None
            if existing_layout and 'writing' in existing_layout:
                existing_w1 = next((t for t in existing_layout['writing'] if t.get('task') == 1), None)
                existing_w2 = next((t for t in existing_layout['writing'] if t.get('task') == 2), None)
                
            model1 = existing_w1.get('model_answer_pages', []) if existing_w1 else []
            model2 = existing_w2.get('model_answer_pages', []) if existing_w2 else []
            
            writing_layout.append({
                'task': 1,
                'pages': task1_pages,
                'model_answer_pages': model1
            })
            writing_layout.append({
                'task': 2,
                'pages': task2_pages,
                'model_answer_pages': model2
            })
            
        # 4. Speaking
        sp_item = next((it for it in items if it['type'] == 'speaking'), None)
        if sp_item:
            speaking_layout.append({
                'part': 1,
                'pages': list(range(sp_item['start'], sp_item['end'] + 1))
            })
            
        test_layout = {
            'listening': listening_layout,
            'reading': reading_layout,
            'writing': writing_layout,
            'speaking': speaking_layout
        }
        
        # Save to database
        if db.is_available():
            db.layouts_collection().update_one(
                {'book': book, 'test': db_test_id},
                {'$set': {'layout': test_layout}},
                upsert=True
            )
            print(f"Updated DB Layout for Book {book} Test {db_test_id}")
            
        # Save locally to JSON dict
        book_key = str(book)
        test_key = str(db_test_id)
        if book_key not in parsed_layouts:
            parsed_layouts[book_key] = {}
        parsed_layouts[book_key][test_key] = test_layout

    # 2. Save layouts locally to phase0/output/cambridge_all_layouts.json
    output_dir = repo_root / "phase0" / "output"
    output_dir.mkdir(parents=True, exist_ok=True)
    layouts_json_path = output_dir / "cambridge_all_layouts.json"
    layouts_json_path.write_text(json.dumps(parsed_layouts, indent=2), encoding="utf-8")
    print(f"Saved local layout mapping JSON to: {layouts_json_path}")
    
    # 3. Delete Book 20 documents from MongoDB collections
    if db.is_available():
        print("Excluding Book 20 from database collections...")
        r_tests = db.tests_collection().delete_many({'book': 20})
        r_layouts = db.layouts_collection().delete_many({'book': 20})
        r_answers = db.answers_collection().delete_many({'book': 20})
        r_audio = db.audio_collection().delete_many({'book': 20})
        r_attempts = db.attempts_collection().delete_many({'book': 20})
        
        print(f"Deleted Book 20 documents:")
        print(f"  tests: {r_tests.deleted_count}")
        print(f"  layouts: {r_layouts.deleted_count}")
        print(f"  answers: {r_answers.deleted_count}")
        print(f"  audio_assets: {r_audio.deleted_count}")
        print(f"  attempts: {r_attempts.deleted_count}")
        
    # 4. Clear cache directory for pdf parts and pdf pages
    cache_dir = repo_root / ".cache"
    parts_cache = cache_dir / "pdf-parts"
    pages_cache = cache_dir / "pdf-pages"
    
    deleted_parts = 0
    deleted_pages = 0
    
    if parts_cache.exists():
        for p in parts_cache.glob("cambridge*"):
            try:
                if p.is_file():
                    p.unlink()
                    deleted_parts += 1
            except Exception as e:
                print(f"Failed to delete cached part {p}: {e}")
                
    if pages_cache.exists():
        for p in pages_cache.glob("cambridge*"):
            try:
                if p.is_file():
                    p.unlink()
                    deleted_pages += 1
            except Exception as e:
                print(f"Failed to delete cached page {p}: {e}")
                
    print(f"Cleared image caches: deleted {deleted_parts} parts, {deleted_pages} pages.")
    print("Process completed successfully!")

if __name__ == '__main__':
    main()
