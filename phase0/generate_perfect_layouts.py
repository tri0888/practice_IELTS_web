import json
from pathlib import Path

# Explicit audited page maps for all books and tests.
# These maps specify the exact page numbers for each skill section in the standardized PDFs.
# This prevents the 1-page alignment offset bugs.
BOOK_LAYOUTS = {}

# ==================== BOOK 11 (Original Layout) ====================
BOOK_LAYOUTS[11] = {}
for t in range(1, 5):
    if t == 1:
        starts = {
            "l1": [11, 12], "l2": [13, 14], "l3": [15, 16], "l4": [17, 18],
            "r1": [19, 20], "r1_q": [21], "r2": [22, 23], "r2_q": [24, 25], "r3": [26, 27], "r3_q": [28, 29, 30],
            "w1": [31], "w2": [32], "s1": [33], "m1": [133], "m2": [134]
        }
    elif t == 2:
        starts = {
            "l1": [34, 35], "l2": [36, 37], "l3": [38, 39], "l4": [40, 41],
            "r1": [42, 43], "r1_q": [44, 45], "r2": [46, 47], "r2_q": [48, 49], "r3": [50, 51], "r3_q": [52, 53, 54],
            "w1": [55], "w2": [56], "s1": [57], "m1": [135], "m2": [136]
        }
    elif t == 3:
        starts = {
            "l1": [58, 59], "l2": [60, 61], "l3": [62, 63], "l4": [64, 65],
            "r1": [66, 67], "r1_q": [68, 69], "r2": [70, 71], "r2_q": [72, 73], "r3": [74, 75], "r3_q": [76, 77],
            "w1": [78], "w2": [79], "s1": [80], "m1": [137], "m2": [138]
        }
    elif t == 4:
        starts = {
            "l1": [81, 82], "l2": [83, 84], "l3": [85, 86], "l4": [87],
            "r1": [88, 89], "r1_q": [90, 91], "r2": [92, 93], "r2_q": [94, 95, 96], "r3": [97, 98], "r3_q": [99, 100, 101],
            "w1": [101], "w2": [102], "s1": [103], "m1": [139], "m2": [140]
        }
    
    # Reading question group mappings
    r1_g1, r1_g2 = starts["r1_q"][0], starts["r1_q"][-1]
    r2_g1, r2_g2 = starts["r2_q"][0], starts["r2_q"][-1]
    r3_g1, r3_g2 = starts["r3_q"][0], starts["r3_q"][1] if len(starts["r3_q"]) > 1 else starts["r3_q"][0]
    r3_g3 = starts["r3_q"][-1]

    BOOK_LAYOUTS[11][t] = {
        "listening": [
            {"section": 1, "pages": starts["l1"]},
            {"section": 2, "pages": starts["l2"]},
            {"section": 3, "pages": starts["l3"]},
            {"section": 4, "pages": starts["l4"]}
        ],
        "reading": [
            {
                "passage": 1, "passage_pages": starts["r1"],
                "groups": [
                    {"range": "1-7", "title": "Questions 1-7", "page": r1_g1},
                    {"range": "8-13", "title": "Questions 8-13", "page": r1_g2}
                ]
            },
            {
                "passage": 2, "passage_pages": starts["r2"],
                "groups": [
                    {"range": "14-19", "title": "Questions 14-19", "page": r2_g1},
                    {"range": "20-26", "title": "Questions 20-26", "page": r2_g2}
                ]
            },
            {
                "passage": 3, "passage_pages": starts["r3"],
                "groups": [
                    {"range": "27-30", "title": "Questions 27-30", "page": r3_g1},
                    {"range": "31-35", "title": "Questions 31-35", "page": r3_g2},
                    {"range": "36-40", "title": "Questions 36-40", "page": r3_g3}
                ]
            }
        ],
        "writing": [
            {"task": 1, "pages": starts["w1"], "model_answer_pages": starts["m1"]},
            {"task": 2, "pages": starts["w2"], "model_answer_pages": starts["m2"]}
        ],
        "speaking": [
            {"part": 1, "pages": starts["s1"]}
        ]
    }

# ==================== BOOK 12 (Original Scanned, 131 pages) ====================
# Uses same offsets as Book 11 but starting at book 12 specific offsets
BOOK_LAYOUTS[12] = {}
for t in range(1, 5):
    # Test 1 starts at 10, Test 2 at 33, Test 3 at 57, Test 4 at 80
    base = [10, 33, 57, 80][t - 1]
    
    if t != 4:
        starts = {
            "l1": [base, base + 1], "l2": [base + 2, base + 3], "l3": [base + 4, base + 5], "l4": [base + 6, base + 7],
            "r1": [base + 8, base + 9], "r1_q": [base + 10, base + 11],
            "r2": [base + 12, base + 13], "r2_q": [base + 14, base + 15],
            "r3": [base + 16, base + 17], "r3_q": [base + 18, base + 19],
            "w1": [base + 20], "w2": [base + 21], "s1": [base + 22],
            "m1": [123 + (t-1)*2], "m2": [124 + (t-1)*2]
        }
    else:
        starts = {
            "l1": [base, base + 1], "l2": [base + 2, base + 3], "l3": [base + 4, base + 5], "l4": [base + 6],
            "r1": [base + 7, base + 8], "r1_q": [base + 9, base + 10],
            "r2": [base + 11, base + 12], "r2_q": [base + 13, base + 14, base + 15],
            "r3": [base + 16, base + 17], "r3_q": [base + 18, base + 19, base + 20],
            "w1": [base + 20], "w2": [base + 21], "s1": [base + 22],
            "m1": [129], "m2": [130]
        }
        
    r1_g1, r1_g2 = starts["r1_q"][0], starts["r1_q"][-1]
    r2_g1, r2_g2 = starts["r2_q"][0], starts["r2_q"][-1]
    r3_g1, r3_g2 = starts["r3_q"][0], starts["r3_q"][1] if len(starts["r3_q"]) > 1 else starts["r3_q"][0]
    r3_g3 = starts["r3_q"][-1]

    BOOK_LAYOUTS[12][t] = {
        "listening": [
            {"section": 1, "pages": starts["l1"]},
            {"section": 2, "pages": starts["l2"]},
            {"section": 3, "pages": starts["l3"]},
            {"section": 4, "pages": starts["l4"]}
        ],
        "reading": [
            {
                "passage": 1, "passage_pages": starts["r1"],
                "groups": [
                    {"range": "1-7", "title": "Questions 1-7", "page": r1_g1},
                    {"range": "8-13", "title": "Questions 8-13", "page": r1_g2}
                ]
            },
            {
                "passage": 2, "passage_pages": starts["r2"],
                "groups": [
                    {"range": "14-19", "title": "Questions 14-19", "page": r2_g1},
                    {"range": "20-26", "title": "Questions 20-26", "page": r2_g2}
                ]
            },
            {
                "passage": 3, "passage_pages": starts["r3"],
                "groups": [
                    {"range": "27-30", "title": "Questions 27-30", "page": r3_g1},
                    {"range": "31-35", "title": "Questions 31-35", "page": r3_g2},
                    {"range": "36-40", "title": "Questions 36-40", "page": r3_g3}
                ]
            }
        ],
        "writing": [
            {"task": 1, "pages": starts["w1"], "model_answer_pages": starts["m1"]},
            {"task": 2, "pages": starts["w2"], "model_answer_pages": starts["m2"]}
        ],
        "speaking": [
            {"part": 1, "pages": starts["s1"]}
        ]
    }

# ==================== CROPPED BOOKS (13, 14, 15, 16, 17) ====================
# These books have Listening pages condensed to 1 page per section
# Total book length is around 100-105 pages
def add_cropped_book(book_id: int, test_starts: list[int], reading_offsets: list[list[int]], writing_offsets: list[list[int]], speaking_offsets: list[int]):
    BOOK_LAYOUTS[book_id] = {}
    for t_idx, base in enumerate(test_starts):
        t = t_idx + 1
        
        l1 = [base]
        l2 = [base + 1, base + 2]
        l3 = [base + 3, base + 4]
        l4 = [base + 5]
        
        # Read the explicit Reading, Writing, and Speaking starts for this test
        r1_start = reading_offsets[t_idx][0]
        r2_start = reading_offsets[t_idx][1]
        r3_start = reading_offsets[t_idx][2]
        
        w1_start = writing_offsets[t_idx][0]
        w2_start = writing_offsets[t_idx][1]
        
        speaking_start = speaking_offsets[t_idx]
        
        # Reading passages and questions are mapped relative to the starts
        r1_pages = [r1_start, r1_start + 1]
        r1_questions = [r1_start + 2] if r2_start - r1_start == 3 else [r1_start + 2, r1_start + 3]
        
        r2_pages = [r2_start, r2_start + 1]
        r2_questions = [r2_start + 2] if r3_start - r2_start == 3 else [r2_start + 2, r2_start + 3]
        
        r3_pages = [r3_start, r3_start + 1]
        r3_questions = [r3_start + 2] if w1_start - r3_start == 3 else [r3_start + 2, r3_start + 3]
        
        r1_g1, r1_g2 = r1_questions[0], r1_questions[-1]
        r2_g1, r2_g2 = r2_questions[0], r2_questions[-1]
        r3_g1, r3_g2 = r3_questions[0], r3_questions[-1]
        r3_g3 = r3_questions[-1]
        
        BOOK_LAYOUTS[book_id][t] = {
            "listening": [
                {"section": 1, "pages": l1},
                {"section": 2, "pages": l2},
                {"section": 3, "pages": l3},
                {"section": 4, "pages": l4}
            ],
            "reading": [
                {
                    "passage": 1, "passage_pages": r1_pages,
                    "groups": [
                        {"range": "1-7", "title": "Questions 1-7", "page": r1_g1},
                        {"range": "8-13", "title": "Questions 8-13", "page": r1_g2}
                    ]
                },
                {
                    "passage": 2, "passage_pages": r2_pages,
                    "groups": [
                        {"range": "14-19", "title": "Questions 14-19", "page": r2_g1},
                        {"range": "20-26", "title": "Questions 20-26", "page": r2_g2}
                    ]
                },
                {
                    "passage": 3, "passage_pages": r3_pages,
                    "groups": [
                        {"range": "27-30", "title": "Questions 27-30", "page": r3_g1},
                        {"range": "31-35", "title": "Questions 31-35", "page": r3_g2},
                        {"range": "36-40", "title": "Questions 36-40", "page": r3_g3}
                    ]
                }
            ],
            "writing": [
                {"task": 1, "pages": [w1_start], "model_answer_pages": []},
                {"task": 2, "pages": [w2_start], "model_answer_pages": []}
            ],
            "speaking": [
                {"part": 1, "pages": [speaking_start]}
            ]
        }

# Book 13
add_cropped_book(
    book_id=13,
    test_starts=[1, 21, 40, 58],
    reading_offsets=[[7, 10, 14], [26, 29, 33], [45, 48, 51], [63, 66, 70]],
    writing_offsets=[[18, 19], [37, 38], [55, 56], [74, 75]],
    speaking_offsets=[20, 39, 57, 76]
)

# Book 14
add_cropped_book(
    book_id=14,
    test_starts=[2, 21, 41, 59],
    reading_offsets=[[7, 10, 14], [27, 31, 34], [45, 49, 52], [64, 67, 70]],
    writing_offsets=[[18, 19], [38, 39], [56, 57], [74, 75]],
    speaking_offsets=[20, 40, 58, 76]
)

# Book 15
add_cropped_book(
    book_id=15,
    test_starts=[1, 20, 38, 57],
    reading_offsets=[[7, 10, 13], [25, 28, 31], [43, 47, 50], [62, 66, 69]],
    writing_offsets=[[17, 18], [35, 36], [54, 55], [73, 74]],
    speaking_offsets=[19, 37, 56, 75]
)

# Book 16
add_cropped_book(
    book_id=16,
    test_starts=[1, 20, 41, 59],
    reading_offsets=[[7, 10, 13], [26, 30, 34], [46, 49, 53], [65, 69, 73]],
    writing_offsets=[[17, 18], [38, 39], [56, 57], [77, 78]],
    speaking_offsets=[19, 40, 58, 79]
)

# Book 17
add_cropped_book(
    book_id=17,
    test_starts=[2, 21, 38, 55],
    reading_offsets=[[7, 10, 14], [25, 28, 31], [42, 45, 48], [59, 62, 66]],
    writing_offsets=[[18, 19], [35, 36], [52, 53], [69, 70]],
    speaking_offsets=[20, 37, 54, 71]
)

# ==================== BOOK 18 & 19 (Original Scanned, 147 / 138 pages) ====================
# Both follow the standard 140+ page structures starting at page 10, 31, 52, 73
for b in [18, 19]:
    BOOK_LAYOUTS[b] = {}
    for t in range(1, 5):
        base = [10, 31, 52, 73][t - 1]
        
        if t != 4:
            starts = {
                "l1": [base, base + 1], "l2": [base + 2, base + 3], "l3": [base + 4, base + 5], "l4": [base + 6, base + 7],
                "r1": [base + 8, base + 9], "r1_q": [base + 10],
                "r2": [base + 11, base + 12], "r2_q": [base + 13, base + 14],
                "r3": [base + 15, base + 16], "r3_q": [base + 17, base + 18],
                "w1": [base + 19], "w2": [base + 19], "s1": [base + 19],
                "m1": [114 + (t-1)*3] if b == 18 else [128 + (t-1)*2],
                "m2": [115 + (t-1)*3] if b == 18 else [129 + (t-1)*2]
            }
        else:
            starts = {
                "l1": [base, base + 1], "l2": [base + 2, base + 3], "l3": [base + 4, base + 5], "l4": [base + 6],
                "r1": [base + 7, base + 8], "r1_q": [base + 9, base + 10],
                "r2": [base + 11, base + 12], "r2_q": [base + 13, base + 14, base + 15],
                "r3": [base + 16, base + 17], "r3_q": [base + 18, base + 19, base + 20],
                "w1": [base + 20], "w2": [base + 21], "s1": [base + 22],
                "m1": [123] if b == 18 else [135], "m2": [124] if b == 18 else [136]
            }
            
        r1_g1, r1_g2 = starts["r1_q"][0], starts["r1_q"][-1]
        r2_g1, r2_g2 = starts["r2_q"][0], starts["r2_q"][-1]
        r3_g1, r3_g2 = starts["r3_q"][0], starts["r3_q"][1] if len(starts["r3_q"]) > 1 else starts["r3_q"][0]
        r3_g3 = starts["r3_q"][-1]

        BOOK_LAYOUTS[b][t] = {
            "listening": [
                {"section": 1, "pages": starts["l1"]},
                {"section": 2, "pages": starts["l2"]},
                {"section": 3, "pages": starts["l3"]},
                {"section": 4, "pages": starts["l4"]}
            ],
            "reading": [
                {
                    "passage": 1, "passage_pages": starts["r1"],
                    "groups": [
                        {"range": "1-7", "title": "Questions 1-7", "page": r1_g1},
                        {"range": "8-13", "title": "Questions 8-13", "page": r1_g2}
                    ]
                },
                {
                    "passage": 2, "passage_pages": starts["r2"],
                    "groups": [
                        {"range": "14-19", "title": "Questions 14-19", "page": r2_g1},
                        {"range": "20-26", "title": "Questions 20-26", "page": r2_g2}
                    ]
                },
                {
                    "passage": 3, "passage_pages": starts["r3"],
                    "groups": [
                        {"range": "27-30", "title": "Questions 27-30", "page": r3_g1},
                        {"range": "31-35", "title": "Questions 31-35", "page": r3_g2},
                        {"range": "36-40", "title": "Questions 36-40", "page": r3_g3}
                    ]
                }
            ],
            "writing": [
                {"task": 1, "pages": starts["w1"], "model_answer_pages": starts["m1"]},
                {"task": 2, "pages": starts["w2"], "model_answer_pages": starts["m2"]}
            ],
            "speaking": [
                {"part": 1, "pages": starts["s1"]}
            ]
        }

# ==================== BOOK 20 (Original Layout by The Sol, 137 pages) ====================
# Test 1 starts at 2, Test 2 at 20, Test 3 at 40, Test 4 at 60
BOOK_LAYOUTS[20] = {}
for t in range(1, 5):
    base = [2, 20, 40, 60][t - 1]
    
    if t == 1:
        starts = {
            "l1": [base], "l2": [base + 1], "l3": [base + 2], "l4": [base + 3],
            "r1": [base + 4, base + 5], "r1_q": [base + 6, base + 7],
            "r2": [base + 8, base + 9], "r2_q": [base + 10, base + 11],
            "r3": [base + 12, base + 13], "r3_q": [base + 14],
            "w1": [base + 15], "w2": [base + 16], "s1": [base + 17]
        }
    elif t == 2:
        starts = {
            "l1": [base], "l2": [base + 1], "l3": [base + 2], "l4": [base + 3, base + 4, base + 5, base + 6],
            "r1": [base + 7, base + 8], "r1_q": [base + 9],
            "r2": [base + 10, base + 11], "r2_q": [base + 12, base + 13],
            "r3": [base + 14, base + 15], "r3_q": [base + 16, base + 17],
            "w1": [base + 18], "w2": [base + 18], "s1": [base + 19]
        }
    elif t == 3:
        starts = {
            "l1": [base], "l2": [base + 1], "l3": [base + 2], "l4": [base + 3, base + 4, base + 5],
            "r1": [base + 6, base + 7], "r1_q": [base + 8],
            "r2": [base + 9, base + 10], "r2_q": [base + 11, base + 12],
            "r3": [base + 13, base + 14], "r3_q": [base + 15, base + 16, base + 17],
            "w1": [base + 18], "w2": [base + 18], "s1": [base + 19]
        }
    else:
        starts = {
            "l1": [base], "l2": [base + 1], "l3": [base + 2], "l4": [base + 3, base + 4, base + 5],
            "r1": [base + 6, base + 7], "r1_q": [base + 8, base + 9],
            "r2": [base + 10, base + 11], "r2_q": [base + 12, base + 13],
            "r3": [base + 14, base + 15], "r3_q": [base + 16, base + 17],
            "w1": [base + 18], "w2": [base + 18], "s1": [base + 19]
        }
        
    r1_g1, r1_g2 = starts["r1_q"][0], starts["r1_q"][-1]
    r2_g1, r2_g2 = starts["r2_q"][0], starts["r2_q"][-1]
    r3_g1, r3_g2 = starts["r3_q"][0], starts["r3_q"][1] if len(starts["r3_q"]) > 1 else starts["r3_q"][0]
    r3_g3 = starts["r3_q"][-1]

    m1 = [114 + (t-1)*2]
    m2 = [115 + (t-1)*2]

    BOOK_LAYOUTS[20][t] = {
        "listening": [
            {"section": 1, "pages": starts["l1"]},
            {"section": 2, "pages": starts["l2"]},
            {"section": 3, "pages": starts["l3"]},
            {"section": 4, "pages": starts["l4"]}
        ],
        "reading": [
            {
                "passage": 1, "passage_pages": starts["r1"],
                "groups": [
                    {"range": "1-7", "title": "Questions 1-7", "page": r1_g1},
                    {"range": "8-13", "title": "Questions 8-13", "page": r1_g2}
                ]
            },
            {
                "passage": 2, "passage_pages": starts["r2"],
                "groups": [
                    {"range": "14-19", "title": "Questions 14-19", "page": r2_g1},
                    {"range": "20-26", "title": "Questions 20-26", "page": r2_g2}
                ]
            },
            {
                "passage": 3, "passage_pages": starts["r3"],
                "groups": [
                    {"range": "27-30", "title": "Questions 27-30", "page": r3_g1},
                    {"range": "31-35", "title": "Questions 31-35", "page": r3_g2},
                    {"range": "36-40", "title": "Questions 36-40", "page": r3_g3}
                ]
            }
        ],
        "writing": [
            {"task": 1, "pages": starts["w1"], "model_answer_pages": m1},
            {"task": 2, "pages": starts["w2"], "model_answer_pages": m2}
        ],
        "speaking": [
            {"part": 1, "pages": starts["s1"]}
        ]
    }

def main():
    string_layouts = {}
    for book, test_data in BOOK_LAYOUTS.items():
        string_layouts[str(book)] = {}
        for test_num, layout in test_data.items():
            string_layouts[str(book)][str(test_num)] = layout
            
    out_dir = Path(__file__).parent / "output"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "cambridge_all_layouts.json"
    out_path.write_text(json.dumps(string_layouts, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Generated perfect layouts JSON at {out_path.name}")

if __name__ == "__main__":
    main()
