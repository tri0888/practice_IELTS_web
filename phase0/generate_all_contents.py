import json
import re
import sys
from pathlib import Path

# Add phase0 to path to import functions
phase0_dir = Path(__file__).resolve().parent
sys.path.append(str(phase0_dir))

import fitz
from extract_questions import (
    clean_ocr_errors,
    get_sorted_page_text,
    extract_pages_text,
    extract_reading_passage,
    extract_reading_questions,
    extract_listening_section,
)

LAYOUTS = {
    1: {
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
        "writing": {
            "task_1": {"pages": [31]},
            "task_2": {"pages": [32]},
        },
        "speaking": {
            "pages": [33],
        },
    },
    2: {
        "listening": {
            "section_1": {"pages": [34, 35], "questions": "1-10", "instruction": "Complete the notes below.\nWrite ONE WORD AND/OR A NUMBER for each answer."},
            "section_2": {"pages": [36, 37], "questions": "11-20", "instruction": "Choose the correct letter, A, B or C."},
            "section_3": {"pages": [38, 39], "questions": "21-30", "instruction": ""},
            "section_4": {"pages": [40, 41], "questions": "31-40", "instruction": "Complete the notes below.\nWrite ONE WORD ONLY for each answer."},
        },
        "reading": {
            "passage_1": {
                "passage_pages": [42, 43],
                "question_pages": [44, 45],
                "title": "Raising the Mary Rose",
                "questions": "1-13",
            },
            "passage_2": {
                "passage_pages": [47, 48],
                "question_pages": [46, 49],
                "title": "What destroyed the civilisation of Easter Island?",
                "questions": "14-26",
            },
            "passage_3": {
                "passage_pages": [50, 51],
                "question_pages": [52, 53, 54, 55],
                "title": "Neuroaesthetics",
                "questions": "27-40",
            },
        },
        "writing": {
            "task_1": {"pages": [55]},
            "task_2": {"pages": [56]},
        },
        "speaking": {
            "pages": [57],
        },
    },
    3: {
        "listening": {
            "section_1": {"pages": [58, 59], "questions": "1-10", "instruction": "Complete the notes below.\nWrite ONE WORD AND/OR A NUMBER for each answer."},
            "section_2": {"pages": [60, 61], "questions": "11-20", "instruction": "Choose the correct letter, A, B or C."},
            "section_3": {"pages": [62, 63], "questions": "21-30", "instruction": ""},
            "section_4": {"pages": [64, 65], "questions": "31-40", "instruction": "Complete the notes below.\nWrite ONE WORD ONLY for each answer."},
        },
        "reading": {
            "passage_1": {
                "passage_pages": [66, 67],
                "question_pages": [68, 69],
                "title": "THE STORY OF SILK",
                "questions": "1-13",
            },
            "passage_2": {
                "passage_pages": [70, 71],
                "question_pages": [72, 73],
                "title": "Great Migrations",
                "questions": "14-26",
            },
            "passage_3": {
                "passage_pages": [74, 75],
                "question_pages": [76, 77],
                "title": "Preface to 'How the other half thinks: Adventures in mathematical reasoning'",
                "questions": "27-40",
            },
        },
        "writing": {
            "task_1": {"pages": [78]},
            "task_2": {"pages": [79]},
        },
        "speaking": {
            "pages": [80],
        },
    },
    4: {
        "listening": {
            "section_1": {"pages": [81, 82], "questions": "1-10", "instruction": "Complete the table below.\nWrite ONE WORD AND/OR A NUMBER for each answer."},
            "section_2": {"pages": [83, 84], "questions": "11-20", "instruction": ""},
            "section_3": {"pages": [85, 86], "questions": "21-30", "instruction": ""},
            "section_4": {"pages": [87], "questions": "31-40", "instruction": "Complete the notes below.\nWrite ONE WORD ONLY for each answer."},
        },
        "reading": {
            "passage_1": {
                "passage_pages": [88, 89],
                "question_pages": [90, 91],
                "title": "Research using twins",
                "questions": "1-13",
            },
            "passage_2": {
                "passage_pages": [92, 93],
                "question_pages": [94, 95, 96],
                "title": "An Introduction to Film Sound",
                "questions": "14-26",
            },
            "passage_3": {
                "passage_pages": [98, 99],
                "question_pages": [97, 100],
                "title": "'This Marvellous Invention'",
                "questions": "27-40",
            },
        },
        "writing": {
            "task_1": {"pages": [101]},
            "task_2": {"pages": [102]},
        },
        "speaking": {
            "pages": [103],
        },
    },
}

def build_test_content(doc: fitz.Document, test_num: int) -> dict:
    layout = LAYOUTS[test_num]
    result = {
        "book": 11,
        "test": test_num,
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
        info = layout["listening"][section_key]
        section_num = int(section_key.split("_")[1])
        question_text = extract_listening_section(doc, info)

        result["listening"]["sections"].append(
            {
                "section_number": section_num,
                "question_range": info["questions"],
                "instruction": info.get("instruction", ""),
                "content_text": question_text,
                "audio_file": f"IELTS11_Test{test_num}_Section{section_num}.mp3",
            }
        )

    # Extract Reading passages + questions
    for passage_key in ["passage_1", "passage_2", "passage_3"]:
        info = layout["reading"][passage_key]
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

    # Extract Writing tasks
    writing_layout = layout.get("writing", {})
    if writing_layout:
        result["writing"] = {
            "total_questions": 2,
            "duration_minutes": 60,
            "tasks": []
        }
        for task_key in ["task_1", "task_2"]:
            task_info = writing_layout[task_key]
            task_num = int(task_key.split("_")[1])
            task_text = extract_pages_text(doc, task_info["pages"])
            result["writing"]["tasks"].append({
                "task_number": task_num,
                "pages": task_info["pages"],
                "content_text": task_text,
            })

    # Extract Speaking parts
    speaking_layout = layout.get("speaking", {})
    if speaking_layout:
        result["speaking"] = {
            "parts": []
        }
        speaking_text = extract_pages_text(doc, speaking_layout["pages"])
        result["speaking"]["parts"].append({
            "part_number": 1,
            "pages": speaking_layout["pages"],
            "content_text": speaking_text,
        })

    return result

def main():
    workspace_root = Path("d:/Git/practice_IELTS_web")
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

    doc = fitz.open(str(pdf_path))
    output_dir = phase0_dir / "output"
    output_dir.mkdir(parents=True, exist_ok=True)

    for test_num in [1, 2, 3, 4]:
        content = build_test_content(doc, test_num)
        output_path = output_dir / f"cambridge_11_test{test_num}_content.json"
        output_path.write_text(
            json.dumps(content, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(f"Wrote {output_path.name}")
        print(f"  Listening: {len(content['listening']['sections'])} sections")
        print(f"  Reading: {len(content['reading']['passages'])} passages")
        if "writing" in content:
            print(f"  Writing: {len(content['writing']['tasks'])} tasks")
        if "speaking" in content:
            print(f"  Speaking: {len(content['speaking']['parts'])} parts")

    doc.close()

if __name__ == "__main__":
    main()
