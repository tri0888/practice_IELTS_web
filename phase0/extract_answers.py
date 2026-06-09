import fitz
from pathlib import Path
import json
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

repo_root = Path("d:/Git/practice_IELTS_web")
books_dir = repo_root / "TRỌN BỘ CAMBRIDGE IELTS 1 - 20 ACADEMIC"
output_dir = repo_root / "phase0" / "output"

# Configuration of key pages for selectable books
configs = {
    11: [
        (1, [125], [126]),
        (2, [127], [128]),
        (3, [129], [130]),
        (4, [131], [132])
    ],
    13: [
        (1, [97], [97]),
        (2, [98], [98]),
        (3, [99], [99]),
        (4, [100], [100])
    ],
    14: [
        (1, [100], [100]),
        (2, [101], [101]),
        (3, [102], [102]),
        (4, [103], [103])
    ],
    15: [
        (1, [100], [100]),
        (2, [101], [101]),
        (3, [102], [102]),
        (4, [103], [103])
    ],
    16: [
        (1, [102], [102]),
        (2, [103], [103]),
        (3, [104], [104]),
        (4, [105], [105])
    ],
    17: [
        (1, [95], [96]),
        (2, [97], [98]),
        (3, [99], [100]),
        (4, [101], [102])
    ],
    20: [
        (1, [111], [111]),
        (2, [112], [112]),
        (3, [113], [113]),
        (4, [114], [114])
    ]
}

# Manual overrides for selectable book parsing issues
MANUAL_FIXES = {
    11: {
        1: {
            "listening": {
                40: "consumption"
            }
        },
        2: {
            "listening": {
                11: "A", 12: "B", 13: "B", 14: "D", 15: "C", 16: "E",
                27: "A", 28: "D", 29: "C", 30: "E", 40: "international"
            },
            "reading": {
                17: "B", 40: "A"
            }
        },
        3: {
            "listening": {
                40: "analysis"
            },
            "reading": {
                3: "NOT GIVEN", 5: "YES", 40: "theorems"
            }
        },
        4: {
            "listening": {
                22: "A", 40: "payments"
            },
            "reading": {
                40: "YES"
            }
        }
    },
    13: {
        1: {
            "listening": {
                37: "new", 38: "stress"
            }
        }
    },
    14: {
        3: {
            "listening": {
                13: "C"
            }
        }
    },
    17: {
        2: {
            "listening": {
                31: "stress"
            }
        },
        3: {
            "listening": {
                4: "dogs"
            }
        }
    },
    20: {
        3: {
            "reading": {
                20: "oak", 21: "flooring"
            }
        },
        4: {
            "listening": {
                23: "A", 24: "C"
            }
        }
    }
}

# Double hyphen cleanup pattern
# Matches prefix like "17&18", "19 & 20", "21-22", "1", "21 , 22"
def extract_q_numbers_and_rest(line: str):
    m = re.match(r"^([\d\s&,\-–—and/]+?)[\.\s]+(.*)$", line, re.IGNORECASE)
    if not m:
        m_pure = re.match(r"^([\d\s&,\-–—and/]+?)$", line, re.IGNORECASE)
        if m_pure:
            prefix = m_pure.group(1).strip()
            rest = ""
        else:
            return None, ""
    else:
        prefix = m.group(1).strip()
        rest = m.group(2).strip()
        
    if not any(c.isdigit() for c in prefix):
        return None, ""
        
    # Standardize hyphens (replace double -- with single -)
    prefix = re.sub(r'-+', '-', prefix)
    
    # Parse numbers
    if any(char in prefix for char in ['-', '–', '—']):
        parts = re.split(r'[-–—]', prefix)
        try:
            start = int(re.search(r'\d+', parts[0]).group())
            end = int(re.search(r'\d+', parts[1]).group())
            nums = list(range(start, end + 1))
        except:
            nums = [int(x) for x in re.findall(r'\d+', prefix)]
    else:
        nums = [int(x) for x in re.findall(r'\d+', prefix)]
        
    # Filter valid question range (1 to 40)
    nums = [n for n in nums if 1 <= n <= 40]
    
    # Filter out score conversion tables (e.g. range of 10+ questions)
    if len(nums) > 3:
        return None, ""
        
    return nums, rest

def clean_answer(ans: str) -> str:
    return ans.strip()

def parse_section_text(text: str) -> dict:
    answers = {}
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    
    i = 0
    while i < len(lines):
        line = lines[i]
        nums, rest = extract_q_numbers_and_rest(line)
        if nums:
            if rest:
                if not any(h in rest.upper() for h in ["SECTION", "PASSAGE", "QUESTIONS"]):
                    for q in nums:
                        answers[q] = clean_answer(rest)
            else:
                if i + 1 < len(lines):
                    next_line = lines[i+1]
                    next_nums, next_rest = extract_q_numbers_and_rest(next_line)
                    is_pure_num = next_nums is not None and not next_rest
                    is_header = any(h in next_line.upper() for h in ["SECTION", "PASSAGE", "QUESTIONS", "TEST", "KEY"])
                    if not is_pure_num and not is_header:
                        for q in nums:
                            answers[q] = clean_answer(next_line)
                        i += 2
                        continue
        i += 1
    return answers

def main():
    for book in range(11, 21):
        seed_path = output_dir / f"cambridge_{book}_seed.json"
        if not seed_path.exists():
            print(f"Seed manifest for book {book} not found!")
            continue
            
        with seed_path.open("r", encoding="utf-8") as f:
            seed_data = json.load(f)
            
        if book in configs:
            # Selectable Academic PDF parsing
            pdf_path = books_dir / f"Cambridge IELTS {book}" / f"Cambridge_IELTS_{book}_Academic.pdf"
            doc = fitz.open(str(pdf_path))
            
            for test_num, l_pages, r_pages in configs[book]:
                # Split Listening and Reading
                if l_pages == r_pages:
                    page_text = doc[l_pages[0] - 1].get_text("text")
                    parts = re.split(r"\n\s*(?:READING|Reading Passage)\s*\n", page_text, flags=re.IGNORECASE)
                    if len(parts) == 1:
                        parts = re.split(r"\bREADING\b", page_text, flags=re.IGNORECASE)
                    l_part = parts[0]
                    r_part = parts[1] if len(parts) > 1 else ""
                else:
                    l_part = doc[l_pages[0] - 1].get_text("text")
                    r_part = doc[r_pages[0] - 1].get_text("text")
                    
                l_answers = parse_section_text(l_part)
                r_answers = parse_section_text(r_part)
                
                # Apply overrides/fixes
                fixes = MANUAL_FIXES.get(book, {}).get(test_num, {})
                l_answers.update(fixes.get("listening", {}))
                r_answers.update(fixes.get("reading", {}))
                
                # Find the test in seed data
                for test_item in seed_data["tests"]:
                    if test_item["test_number"] == test_num:
                        for sec in test_item["sections"]:
                            name = sec["name"].lower()
                            if name.startswith("section"):
                                sec_num = int(name.split(" ")[1])
                                # Section 1: Q1-10, Section 2: Q11-20, Section 3: Q21-30, Section 4: Q31-40
                                start = (sec_num - 1) * 10 + 1
                                sec["rows"] = [
                                    {"question_number": q, "answer_text": l_answers.get(q, "")}
                                    for q in range(start, start + 10)
                                ]
                            elif name.startswith("passage"):
                                pas_num = int(name.split(" ")[1])
                                # Passage 1: Q1-13, Passage 2: Q14-26, Passage 3: Q27-40
                                if pas_num == 1:
                                    q_range = range(1, 14)
                                elif pas_num == 2:
                                    q_range = range(14, 27)
                                else:
                                    q_range = range(27, 41)
                                sec["rows"] = [
                                    {"question_number": q, "answer_text": r_answers.get(q, "")}
                                    for q in q_range
                                ]
            doc.close()
        else:
            # For Book 12, 18, 19: seed empty rows or defaults
            # (We will add custom hardcoded seeding for these in a later step if needed,
            # but for now we write the seeding structure so they are clean empty files
            # which will score 0/40 rather than 40/40 on blank submissions due to our submit grading fix).
            # Let's populate empty rows with question_number keys
            for test_item in seed_data["tests"]:
                for sec in test_item["sections"]:
                    name = sec["name"].lower()
                    if name.startswith("section"):
                        sec_num = int(name.split(" ")[1])
                        start = (sec_num - 1) * 10 + 1
                        sec["rows"] = [
                            {"question_number": q, "answer_text": ""}
                            for q in range(start, start + 10)
                        ]
                    elif name.startswith("passage"):
                        pas_num = int(name.split(" ")[1])
                        if pas_num == 1:
                            q_range = range(1, 14)
                        elif pas_num == 2:
                            q_range = range(14, 27)
                        else:
                            q_range = range(27, 41)
                        sec["rows"] = [
                            {"question_number": q, "answer_text": ""}
                            for q in q_range
                        ]
                        
        # Save back the seed file
        seed_path.write_text(json.dumps(seed_data, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"Successfully processed seed file: {seed_path.name}")

if __name__ == "__main__":
    main()
