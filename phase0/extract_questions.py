"""
Phase 0 Enhanced: Extract structured questions + passages from Cambridge IELTS 11 PDF.
Outputs a JSON file with reading passages, listening questions, and reading questions
as native text (not images). Handles columns and OCR fixes.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import fitz  # PyMuPDF

# ---------------------------------------------------------------------------
# Page ranges for Cambridge IELTS 11 Test 1
# ---------------------------------------------------------------------------
TEST1_LAYOUT = {
    "listening": {
        "section_1": {"pages": [11, 12], "questions": "1-10", "instruction": "Complete the notes below.\nWrite ONE WORD AND/OR A NUMBER for each answer."},
        "section_2": {"pages": [13, 14], "questions": "11-20", "instruction": ""},
        "section_3": {"pages": [15, 16], "questions": "21-30", "instruction": "Choose the correct letter, A, B or C."},
        "section_4": {"pages": [17, 18], "questions": "31-40", "instruction": "Complete the notes below.\nWrite ONE WORD ONLY for each answer."},
    },
    "reading": {
        "passage_1": {
            "passage_pages": [19, 20],
            "question_pages": [21],
            "title": "Crop-growing skyscrapers",
            "questions": "1-13",
        },
        "passage_2": {
            "passage_pages": [22, 23],
            "question_pages": [24, 25],
            "title": "The Falkirk Wheel",
            "questions": "14-26",
        },
        "passage_3": {
            "passage_pages": [26, 27],
            "question_pages": [28, 29, 30],
            "title": "Reducing the Effects of Climate Change",
            "questions": "27-40",
        },
    },
}

def clean_ocr_errors(text: str) -> str:
    # Common OCR/Ligature replacement map
    replacements = {
        r'\bco"ect\b': 'correct',
        r'\bco"ect\w*': 'correct',
        r'\bfann\b': 'farm',
        r'\bfanns\b': 'farms',
        r'\benoµgh\b': 'enough',
        r'\benoµgh\w*': 'enough',
        r'\baeople\b': 'people',
        r'\bgre9tly\b': 'greatly',
        r'\bgred9tly\b': 'greatly',
        r'\bbšen\b': 'been',
        r'\bchinking\b': 'thinking',
        r'\bics\b': 'its',
        r'\bictle\b': 'little',
        r'\bcroµgh\b': 'through',
        r'\bdifficulry\b': 'difficulty',
        r'\bowning to\b': 'owing to',
        r'\bcues\b': 'cuts',
        r'\bcwt\b': 'cut',
        r'\bcwency\b': 'twenty',
        r"\bThar's\b": "That's",
        r'\bscrarospheric\b': 'stratospheric',
        r'\bace to\b': 'act to',
        r'\bac half\b': 'at half',
        r'\bworid\'s\b': "world's",
        r'\bdespoiled\b': 'despoiled',
        r'\becozones\b': 'ecozones',
        r'\bgeo-engi\.neering\b': 'geo-engineering',
    }
    
    cleaned = text
    for pattern, repl in replacements.items():
        cleaned = re.sub(pattern, repl, cleaned, flags=re.IGNORECASE)
        
    # Clean up standard watermarks / artifacts
    cleaned = re.sub(r'u\s*l\s*>\s*!\s*I.*', '', cleaned)
    cleaned = re.sub(r'www\.irLanguage\.com', '', cleaned)
    cleaned = re.sub(r'irLanguag[ce][\s\-]*', '', cleaned)
    cleaned = re.sub(r'1rlangungc', '', cleaned)
    cleaned = re.sub(r'e:_?\?>4', '', cleaned)
    cleaned = re.sub(r'\.:\.,\s*l\s*>\s*\.\s*!\s*I\s+\.:\.,\s*\'\s*1\s*j\s+>\s*"', '', cleaned)
    cleaned = re.sub(r'\.:\.,\s*l\s*>\s*!\s*I\s+\.:\.,\s*\'\s*1\s*j\s+>\s*"', '', cleaned)
    
    # Fix spacing issues
    cleaned = re.sub(r'[ \t]+', ' ', cleaned)
    cleaned = re.sub(r'\n{3,}', '\n\n', cleaned)
    
    return cleaned.strip()

def is_two_column_page(blocks) -> bool:
    left_count = 0
    right_count = 0
    for b in blocks:
        x0, y0, x1, y1, text, block_no, block_type = b
        text_clean = text.strip()
        if not text_clean or len(text_clean) < 3:
            continue
        if y0 < 50 or y1 > 550:  # skip headers/footers
            continue
        if x1 <= 215:
            left_count += 1
        elif x0 >= 210:
            right_count += 1
            
    return left_count >= 2 and right_count >= 2

def get_sorted_page_text(page) -> str:
    blocks = page.get_text("blocks")
    clean_blocks = []
    
    for b in blocks:
        x0, y0, x1, y1, text, block_no, block_type = b
        text_clean = text.strip()
        if not text_clean:
            continue
        
        # Remove watermarks
        if "irLanguage" in text_clean or "1rlangungc" in text_clean:
            continue
            
        # Remove running headers/footers
        if y0 < 45 and ("Test 1" in text_clean or "Reading" in text_clean or "Listening" in text_clean):
            continue
        if y0 > 550 and re.match(r"^\d+$", text_clean):
            continue
            
        clean_blocks.append(b)

    if not is_two_column_page(clean_blocks):
        # 1-column page: sort purely by y0
        clean_blocks.sort(key=lambda x: x[1])
        parts = [b[4].strip() for b in clean_blocks]
        combined = "\n\n".join(parts)
        return clean_ocr_errors(combined)

    # 2-column page layout
    top_blocks = []
    left_blocks = []
    right_blocks = []
    bottom_blocks = []
    
    for b in clean_blocks:
        x0, y0, x1, y1, text, block_no, block_type = b
        text_clean = text.strip()
        
        # Determine if it's a spanning block (spans center 212)
        is_spanning = (x0 < 180 and x1 > 240)
        
        if is_spanning:
            if y0 < 250:
                top_blocks.append((y0, text_clean))
            else:
                bottom_blocks.append((y0, text_clean))
        else:
            center_x = (x0 + x1) / 2
            if center_x < 212:
                left_blocks.append((y0, text_clean))
            else:
                right_blocks.append((y0, text_clean))
                
    top_blocks.sort()
    left_blocks.sort()
    right_blocks.sort()
    bottom_blocks.sort()
    
    parts = []
    for _, t in top_blocks:
        parts.append(t)
    for _, t in left_blocks:
        parts.append(t)
    for _, t in right_blocks:
        parts.append(t)
    for _, t in bottom_blocks:
        parts.append(t)
        
    combined = "\n\n".join(parts)
    return clean_ocr_errors(combined)

def extract_pages_text(doc: fitz.Document, page_numbers: list[int]) -> str:
    texts = []
    for pn in page_numbers:
        page = doc[pn - 1]
        texts.append(get_sorted_page_text(page))
    return "\n\n".join(texts)

def extract_reading_passage(doc: fitz.Document, passage_info: dict) -> dict:
    cleaned = extract_pages_text(doc, passage_info["passage_pages"])
    
    # Remove redundant headers
    cleaned = re.sub(r"^Test \d+\s*\n", "", cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r"^Reading\s*\n", "", cleaned, flags=re.MULTILINE)
    cleaned = re.sub(r"^READING PASSAGE \d+\s*\n", "", cleaned, flags=re.MULTILINE)
    cleaned = re.sub(
        r"You should spend about \d+ minutes on Questions .*?\n", "", cleaned
    )
    cleaned = re.sub(r"Passage \d+ below\.\s*\n?", "", cleaned)

    return {
        "title": passage_info["title"],
        "text": cleaned.strip(),
        "question_range": passage_info["questions"],
    }

def extract_reading_questions(doc: fitz.Document, passage_info: dict) -> str:
    cleaned = extract_pages_text(doc, passage_info["question_pages"])
    return cleaned.strip()

def extract_listening_section(doc: fitz.Document, section_info: dict) -> str:
    cleaned = extract_pages_text(doc, section_info["pages"])
    return cleaned.strip()

def build_test_content(pdf_path: str | Path) -> dict:
    doc = fitz.open(str(pdf_path))

    result = {
        "book": 11,
        "test": 1,
        "listening": {
            "total_questions": 40,
            "duration_minutes": 30,
            "sections": [],
        },
        "reading": {
            "total_questions": 40,
            "duration_minutes": 60,
            "passages": [],
        },
    }

    # Extract Listening sections
    for section_key in ["section_1", "section_2", "section_3", "section_4"]:
        info = TEST1_LAYOUT["listening"][section_key]
        section_num = int(section_key.split("_")[1])
        question_text = extract_listening_section(doc, info)

        result["listening"]["sections"].append(
            {
                "section_number": section_num,
                "question_range": info["questions"],
                "instruction": info.get("instruction", ""),
                "content_text": question_text,
                "audio_file": f"IELTS11_Test1_Section{section_num}.mp3",
            }
        )

    # Extract Reading passages + questions
    for passage_key in ["passage_1", "passage_2", "passage_3"]:
        info = TEST1_LAYOUT["reading"][passage_key]
        passage_num = int(passage_key.split("_")[1])

        passage_data = extract_reading_passage(doc, info)
        question_text = extract_reading_questions(doc, info)

        result["reading"]["passages"].append(
            {
                "passage_number": passage_num,
                "title": passage_data["title"],
                "passage_text": passage_data["text"],
                "question_range": passage_data["question_range"],
                "questions_text": question_text,
            }
        )

    doc.close()
    return result

def main():
    workspace_root = Path(__file__).resolve().parents[1]
    pdf_path = (
        workspace_root
        / "TRỌN BỘ CAMBRIDGE IELTS 1 - 20 ACADEMIC"
        / "Cambridge IELTS 11"
        / "Cambridge IELTS 11"
        / "Cambridge IELTS 11"
        / "Cambridge-IELTS-11-Academic.pdf"
    )

    if not pdf_path.exists():
        print(f"PDF not found at: {pdf_path}")
        return

    content = build_test_content(pdf_path)

    output_path = Path(__file__).resolve().parent / "output" / "cambridge_11_test1_content.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(content, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"Wrote {output_path}")
    print(f"  Listening: {len(content['listening']['sections'])} sections")
    print(f"  Reading: {len(content['reading']['passages'])} passages")

if __name__ == "__main__":
    main()
