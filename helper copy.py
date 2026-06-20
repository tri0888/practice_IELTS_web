import fitz
import re
from collections import Counter

INPUT_PDF = "./Books/Cambridge IELTS 11-20/Cam 14/Cambridge 14.pdf"

HEADER_RATIO = 0.12
FOOTER_RATIO = 0.08
HEADER_FREQ_THRESHOLD = 0.5

# ==========================================================
# REGEX
# ==========================================================

TEST_RE = re.compile(
    r"^TEST\s+\d+\b",
    re.I
)

MAJOR_RE = re.compile(
    r"^(LISTENING|LISTENING TEST|READING|READING TEST|WRITING|WRITING TEST|SPEAKING|SPEAKING TEST)\b",
    re.I
)

PART_RE = re.compile(
    r"^PART\s+\d+\b",
    re.I
)

SECTION_RE = re.compile(
    r"^SECTION\s+\d+\b",
    re.I
)

QUESTION_GROUP_RE = re.compile(
    r"^Questions?\s+\d+",
    re.I
)

WRITING_TASK_RE = re.compile(
    r"^WRITING\s+TASK\s+\d+\b",
    re.I
)

READING_PASSAGE_RE = re.compile(
    r"^READING\s+PASSAGE\s+\d+\s*$",
    re.I
)

STOP_RE = re.compile(
    r"^AUDIO\s*SCRIPTS?$|^AUDIOSCRIPTS?$",
    re.I
)

CONTENTS_RE = re.compile(
    r"^(CONTENTS|TABLE OF CONTENTS)$",
    re.I
)

# ==========================================================
# HELPERS
# ==========================================================

def normalize_text(text):
    text = re.sub(r"\d+", "#", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()

def normalize_major(text):
    t = text.upper()

    if "LISTENING" in t:
        return "LISTENING"
    if "READING" in t:
        return "READING"
    if "WRITING" in t:
        return "WRITING"
    if "SPEAKING" in t:
        return "SPEAKING"

    return None

def is_heading_candidate(text):

    text = text.strip()

    lines = [
        line.strip()
        for line in text.splitlines()
        if line.strip()
    ]

    if len(lines) > 2:
        return False

    compact = " ".join(lines)

    if len(compact) > 60:
        return False

    if len(compact.split()) > 10:
        return False

    if compact.endswith("."):
        return False

    return True

def get_blocks(page):
    blocks = []

    for b in page.get_text("blocks"):
        x0, y0, x1, y1, text, *_ = b

        text = text.strip()

        if not text:
            continue

        blocks.append(
            {
                "text": text,
                "norm": normalize_text(text),
                "y0": y0,
                "y1": y1,
            }
        )

    blocks.sort(key=lambda x: x["y0"])
    return blocks


def classify(text):

    text = text.strip()

    if not is_heading_candidate(text):
        return None

    if STOP_RE.match(text):
        return "STOP"

    if TEST_RE.match(text):
        return "TEST"

    if MAJOR_RE.match(text):
        return "MAJOR"

    if WRITING_TASK_RE.match(text):
        return "WRITING_TASK"

    if READING_PASSAGE_RE.match(text):
        return "READING_PASSAGE"

    if PART_RE.match(text):
        return "PART"

    if SECTION_RE.match(text):
        return "SECTION"

    if QUESTION_GROUP_RE.match(text):
        return "QUESTION_GROUP"

    return None

# ==========================================================
# OPEN PDF
# ==========================================================

doc = fitz.open(INPUT_PDF)

# ==========================================================
# DETECT REPEATED HEADERS / FOOTERS
# ==========================================================

header_counter = Counter()
footer_counter = Counter()

all_pages = []

for page in doc:

    blocks = get_blocks(page)

    all_pages.append(blocks)

    page_height = page.rect.height

    for block in blocks:

        if block["y0"] < page_height * HEADER_RATIO:
            header_counter[block["norm"]] += 1

        if block["y1"] > page_height * (1 - FOOTER_RATIO):
            footer_counter[block["norm"]] += 1

page_count = len(doc)

headers = {
    txt
    for txt, freq in header_counter.items()
    if freq >= page_count * HEADER_FREQ_THRESHOLD
}

footers = {
    txt
    for txt, freq in footer_counter.items()
    if freq >= page_count * HEADER_FREQ_THRESHOLD
}


# ==========================================================
# FIND SPLITS
# ==========================================================

splits = []

stop_scan = False

current_mode = None
last_mode = None

for page_idx, page_blocks in enumerate(all_pages):

    if stop_scan:
        break

    body = [
        b for b in page_blocks
        if b["norm"] not in headers
        and b["norm"] not in footers
    ]

    body.sort(key=lambda x: x["y0"])

    # True once we've seen a real content block (not TEST/MAJOR label) on this page.
    # If a SECTION/PART heading appears before any real content on the page,
    # it means the heading sits at the top of the page -> the whole page already
    # belongs to it -> no mid-page split is needed.
    seen_real_content_on_page = False

    for block in body:

        heading_type = classify(block["text"])

        if heading_type is None:
            seen_real_content_on_page = True
            continue

        text = block["text"].strip()
        should_split = False

        if heading_type == "TEST":
            current_mode = None
            last_mode = None
            continue

        if heading_type == "MAJOR":
            current_mode = normalize_major(text)
            last_mode = current_mode
            continue

        if heading_type in ("SECTION", "PART", "WRITING_TASK", "READING_PASSAGE"):

            if current_mode is None:
                should_split = False

            elif current_mode in ("LISTENING", "READING", "WRITING", "SPEAKING"):
                should_split = seen_real_content_on_page

        # Question group sub-headers (e.g. "Questions 11-12", "Questions 13 and 14")
        # Only split for LISTENING and READING; Writing/Speaking use TASK/PART already.
        if heading_type == "QUESTION_GROUP":

            if current_mode in ("LISTENING", "READING"):
                should_split = seen_real_content_on_page

        if should_split:
            splits.append({
                "page": page_idx,
                "y": block["y0"],
                "heading": text
            })

# ==========================================================
# MERGE SPLITS QUÁ GẦN NHAU (CÙNG TRANG)
# Ví dụ: "SECTION 3\nQuestions 21-30" tại Y=421 kéo theo
# "Questions 21-25" tại Y=443 -> sliver 22pt chỉ chứa heading.
# Giữ split đầu tiên, bỏ split liền kề trong vòng MIN_GAP pt.
# ==========================================================

MIN_GAP = 60  # pt; nhỏ hơn khoảng này thì coi là cùng một split

splits_by_page_raw = {}
for s in splits:
    splits_by_page_raw.setdefault(s["page"], []).append(s)

splits = []
for page_idx, page_splits in splits_by_page_raw.items():
    page_splits.sort(key=lambda x: x["y"])
    kept = [page_splits[0]]
    for s in page_splits[1:]:
        if s["y"] - kept[-1]["y"] >= MIN_GAP:
            kept.append(s)
    splits.extend(kept)

# ==========================================================
# RESULT
# ==========================================================

print("=" * 100)

for s in splits:
    print(
        f"Page {s['page'] + 1:4d} | "
        f"Y={s['y']:8.2f} | "
        f"{s['heading']}"
    )

print("=" * 100)
print("Total splits:", len(splits))
print("=" * 100)

# ==========================================================
# CẮT (CROP) PAGE THEO CÁC SPLIT ĐÃ TÌM ĐƯỢC
# ==========================================================

def export_split_pdf(doc, splits, output_path="output_split.pdf"):
    """
    Xuất TOÀN BỘ sách thành 1 file PDF duy nhất:
    - Trang có trong `splits` sẽ được cắt thành nhiều trang nhỏ riêng biệt
      (mỗi đoạn Y là 1 trang mới, kích thước = đúng vùng đã cắt).
    - Trang không có split giữ nguyên như cũ (full page, không đổi gì).
    Thứ tự trang trong file output vẫn đúng theo thứ tự gốc của sách.
    """
    splits_by_page = {}
    for s in splits:
        splits_by_page.setdefault(s["page"], []).append(s["y"])

    new_doc = fitz.open()

    for page_idx in range(len(doc)):
        src_page = doc[page_idx]
        page_width = src_page.rect.width
        page_height = src_page.rect.height

        if page_idx not in splits_by_page:
            # không có split -> giữ nguyên cả trang
            new_doc.insert_pdf(doc, from_page=page_idx, to_page=page_idx)
            continue

        ys = splits_by_page[page_idx]
        boundaries = [0] + sorted(ys) + [page_height]

        for i in range(len(boundaries) - 1):
            top = boundaries[i]
            bottom = boundaries[i + 1]

            if bottom - top < 1:
                continue

            seg_height = bottom - top
            new_page = new_doc.new_page(width=page_width, height=seg_height)

            clip = fitz.Rect(0, top, page_width, bottom)
            new_page.show_pdf_page(
                new_page.rect,
                doc,
                page_idx,
                clip=clip
            )

    new_doc.save(output_path)
    new_doc.close()
    return output_path


pdf_out_path = export_split_pdf(doc, splits, output_path="output_split.pdf")
print(f"Đã xuất file PDF: {pdf_out_path}")