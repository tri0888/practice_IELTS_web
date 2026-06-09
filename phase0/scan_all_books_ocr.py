from __future__ import annotations

import io
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path

LOCAL_DEPS = Path(__file__).resolve().parent / ".python_deps"
if LOCAL_DEPS.exists():
    sys.path.insert(0, str(LOCAL_DEPS))

import fitz
import pytesseract
from PIL import Image


TESSERACT_EXE = Path(r"C:\Program Files\Tesseract-OCR\tesseract.exe")
if TESSERACT_EXE.exists():
    pytesseract.pytesseract.tesseract_cmd = str(TESSERACT_EXE)

REPO_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = REPO_ROOT / "phase0" / "output"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

BOOK_RANGE = range(11, 21)
PAGE_LIMIT = 180
FULL_PAGE_HEIGHT = 10000.0

ORDERED_KEYS = [
    "listening_1",
    "listening_2",
    "listening_3",
    "listening_4",
    "reading_1",
    "reading_2",
    "reading_3",
    "writing_1",
    "writing_2",
    "speaking",
]

READING_Q_MIRRORS = {
    "reading_1": "reading_q_1",
    "reading_2": "reading_q_2",
    "reading_3": "reading_q_3",
}

WORD_NUMS = {
    "1": 1,
    "2": 2,
    "3": 3,
    "4": 4,
    "ONE": 1,
    "TWO": 2,
    "THREE": 3,
    "FOUR": 4,
}

TEST_RE = re.compile(r"\bTEST\s+(\d{1,2})\b", re.IGNORECASE)
LISTENING_RE = re.compile(r"\bLISTENING\b", re.IGNORECASE)
READING_RE = re.compile(r"\bREADING\b", re.IGNORECASE)
WRITING_RE = re.compile(r"\bWRITING\b", re.IGNORECASE)
SPEAKING_RE = re.compile(r"\bSPEAKING\b", re.IGNORECASE)
SECTION_RE = re.compile(r"^\s*(?:SECTION|PART)\s*(1|2|3|4|ONE|TWO|THREE|FOUR)\b", re.IGNORECASE)
READING_PASSAGE_RE = re.compile(
    r"^\s*(?:READING\s+)?PASSAGE\s*(1|2|3|ONE|TWO|THREE)\b",
    re.IGNORECASE,
)
WRITING_TASK_RE = re.compile(
    r"^\s*(?:WRITING\s+)?TASK\s*(1|2|ONE|TWO)\b",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class Line:
    page: int
    y: float
    text: str
    source: str


@dataclass(frozen=True)
class Event:
    page: int
    y: float
    kind: str
    value: str | int | None
    text: str
    source: str


def norm_text(text: str) -> str:
    text = text.replace("\u2013", "-").replace("\u2014", "-")
    return " ".join(text.upper().split())


def resolve_books_dir() -> Path:
    candidates = [
        p
        for p in REPO_ROOT.iterdir()
        if p.is_dir()
        and "CAMBRIDGE IELTS" in norm_text(p.name)
        and "ACADEMIC" in norm_text(p.name)
    ]
    if not candidates:
        raise FileNotFoundError("Could not find Cambridge IELTS books directory")
    return candidates[0]


def find_pdf(book_id: int) -> Path:
    book_dir = resolve_books_dir() / f"Cambridge IELTS {book_id}"
    exact = book_dir / f"Cambridge_IELTS_{book_id}_Academic.pdf"
    if exact.exists():
        return exact

    candidates = [
        p
        for p in book_dir.rglob("*.pdf")
        if "__MACOSX" not in p.parts
        and "SOLUTION" not in norm_text(p.name)
        and "CHU" not in norm_text(p.name)
        and "ACADEMIC" in norm_text(p.name)
    ]
    if not candidates:
        candidates = [
            p
            for p in book_dir.rglob("*.pdf")
            if "__MACOSX" not in p.parts and "SOLUTION" not in norm_text(p.name)
        ]
    if not candidates:
        raise FileNotFoundError(f"Academic PDF not found for Cambridge IELTS {book_id}")
    return max(candidates, key=lambda p: p.stat().st_size)


def selectable_lines(page: fitz.Page, page_num: int) -> list[Line]:
    lines: list[Line] = []
    blocks = page.get_text("blocks")
    blocks.sort(key=lambda block: (block[1], block[0]))
    for block in blocks:
        x0, y0, _x1, _y1, text, *_rest = block
        for offset, raw_line in enumerate(text.splitlines()):
            cleaned = " ".join(raw_line.split()).strip()
            if cleaned:
                lines.append(Line(page_num, float(y0) + offset * 0.1, cleaned, "text"))
    return lines


def ocr_lines(page: fitz.Page, page_num: int) -> list[Line]:
    rect = page.rect
    clip = fitz.Rect(0, 0, rect.width, rect.height * 0.82)
    pix = page.get_pixmap(matrix=fitz.Matrix(0.45, 0.45), clip=clip, alpha=False)
    image = Image.open(io.BytesIO(pix.tobytes("png")))
    try:
        text = pytesseract.image_to_string(image, config="--psm 6", timeout=8)
    except RuntimeError:
        text = ""

    lines: list[Line] = []
    for idx, raw_line in enumerate(text.splitlines()):
        cleaned = " ".join(raw_line.split()).strip()
        if cleaned:
            lines.append(Line(page_num, float(idx), cleaned, "ocr"))
    return lines


def page_lines(page: fitz.Page, page_num: int) -> list[Line]:
    text_lines = selectable_lines(page, page_num)
    joined = "\n".join(line.text for line in text_lines)
    useful_text = any(
        pattern.search(joined)
        for pattern in (
            TEST_RE,
            LISTENING_RE,
            READING_PASSAGE_RE,
            WRITING_TASK_RE,
            SPEAKING_RE,
            SECTION_RE,
        )
    )
    if useful_text and len(joined.strip()) > 40:
        return text_lines
    return ocr_lines(page, page_num)


def load_layout_scan_range(book_id: int, doc_len: int) -> tuple[int, int]:
    layouts_path = OUTPUT_DIR / "cambridge_all_layouts.json"
    if not layouts_path.exists():
        return 1, min(doc_len, PAGE_LIMIT)

    layouts = json.loads(layouts_path.read_text(encoding="utf-8"))
    book_layout = layouts.get(str(book_id), {})
    pages: set[int] = set()
    for test_layout in book_layout.values():
        for item in test_layout.get("listening", []):
            pages.update(item.get("pages", []))
        for item in test_layout.get("reading", []):
            pages.update(item.get("passage_pages", []))
            for group in item.get("groups", []):
                if "page" in group:
                    pages.add(int(group["page"]))
        for item in test_layout.get("writing", []):
            pages.update(item.get("pages", []))
        for item in test_layout.get("speaking", []):
            pages.update(item.get("pages", []))

    if not pages:
        return 1, min(doc_len, PAGE_LIMIT)

    return max(1, min(pages) - 2), min(doc_len, max(pages) + 2)


def load_layout_starts(book_id: int) -> dict[str, dict[str, int]]:
    layouts_path = OUTPUT_DIR / "cambridge_all_layouts.json"
    if not layouts_path.exists():
        return {}

    layouts = json.loads(layouts_path.read_text(encoding="utf-8"))
    book_layout = layouts.get(str(book_id), {})
    starts: dict[str, dict[str, int]] = {}

    for test_num, test_layout in book_layout.items():
        starts[test_num] = {}
        for item in test_layout.get("listening", []):
            pages = item.get("pages", [])
            if pages:
                starts[test_num][f"listening_{item['section']}"] = int(pages[0])
        for item in test_layout.get("reading", []):
            pages = item.get("passage_pages", [])
            if pages:
                starts[test_num][f"reading_{item['passage']}"] = int(pages[0])
        for item in test_layout.get("writing", []):
            pages = item.get("pages", [])
            if pages:
                starts[test_num][f"writing_{item['task']}"] = int(pages[0])
        speaking = test_layout.get("speaking", [])
        if speaking and speaking[0].get("pages"):
            starts[test_num]["speaking"] = int(speaking[0]["pages"][0])

    return starts


def detect_page_key(doc: fitz.Document, page_num: int) -> set[str]:
    if page_num < 1 or page_num > len(doc):
        return set()
    lines = page_lines(doc[page_num - 1], page_num)
    keys = set()
    for event in classify_events(lines):
        if event.kind == "part" and isinstance(event.value, str):
            keys.add(event.value)
    return keys


def refine_layout_starts_with_ocr(
    doc: fitz.Document,
    layout_starts: dict[str, dict[str, int]],
) -> tuple[dict[str, dict[str, int]], dict[str, list[str]]]:
    refined: dict[str, dict[str, int]] = {}
    diagnostics: dict[str, list[str]] = {}
    page_key_cache: dict[int, set[str]] = {}

    def keys_for(page_num: int) -> set[str]:
        if page_num not in page_key_cache:
            page_key_cache[page_num] = detect_page_key(doc, page_num)
        return page_key_cache[page_num]

    for test_num in sorted(layout_starts, key=int):
        refined[test_num] = {}
        for expected_key in ORDERED_KEYS:
            candidate = layout_starts[test_num].get(expected_key)
            if not candidate:
                diagnostics.setdefault(test_num, []).append(f"{expected_key}: no layout candidate")
                continue

            if expected_key in keys_for(candidate):
                refined[test_num][expected_key] = candidate
                continue

            refined[test_num][expected_key] = candidate
            seen = sorted(keys_for(candidate))
            diagnostics.setdefault(test_num, []).append(
                f"{expected_key}: fallback page {candidate}, saw {seen}"
            )

    return refined, diagnostics


def classify_events(lines: list[Line]) -> list[Event]:
    events: list[Event] = []
    current_module: str | None = None

    for line in lines:
        text = norm_text(line.text)
        if not text:
            continue

        if test_match := TEST_RE.search(text):
            events.append(Event(line.page, line.y, "test", int(test_match.group(1)), line.text, line.source))

        if LISTENING_RE.search(text):
            current_module = "listening"
            events.append(Event(line.page, line.y, "module", "listening", line.text, line.source))
        elif READING_RE.search(text):
            current_module = "reading"
            events.append(Event(line.page, line.y, "module", "reading", line.text, line.source))
        elif WRITING_RE.search(text):
            current_module = "writing"
            events.append(Event(line.page, line.y, "module", "writing", line.text, line.source))
        elif SPEAKING_RE.search(text):
            current_module = "speaking"
            events.append(Event(line.page, line.y, "part", "speaking", line.text, line.source))
            continue

        if match := READING_PASSAGE_RE.search(text):
            value = WORD_NUMS.get(match.group(1).upper())
            if value in (1, 2, 3):
                current_module = "reading"
                events.append(Event(line.page, line.y, "part", f"reading_{value}", line.text, line.source))
            continue

        if match := WRITING_TASK_RE.search(text):
            value = WORD_NUMS.get(match.group(1).upper())
            if value in (1, 2) and current_module in ("writing", None):
                current_module = "writing"
                events.append(Event(line.page, line.y, "part", f"writing_{value}", line.text, line.source))
            continue

        if match := SECTION_RE.search(text):
            value = WORD_NUMS.get(match.group(1).upper())
            if value and current_module not in ("reading", "writing", "speaking"):
                current_module = "listening"
                events.append(Event(line.page, line.y, "part", f"listening_{value}", line.text, line.source))

    return events


def parse_tests(events: list[Event]) -> dict[str, dict[str, int]]:
    tests: dict[str, dict[str, int]] = {}
    current_test = 0
    next_idx = len(ORDERED_KEYS)

    ordered_index = {key: idx for idx, key in enumerate(ORDERED_KEYS)}

    for event in sorted(events, key=lambda ev: (ev.page, ev.y)):
        if event.kind != "part" or not isinstance(event.value, str):
            continue

        key = event.value
        if key not in ordered_index:
            continue

        key_idx = ordered_index[key]
        if key == "listening_1" and (current_test == 0 or next_idx >= len(ORDERED_KEYS)):
            current_test += 1
            if current_test > 4:
                break
            tests[str(current_test)] = {}
            next_idx = 0

        if current_test == 0:
            continue

        current = tests[str(current_test)]
        if key in current:
            continue
        if key_idx < next_idx:
            continue

        current[key] = event.page
        next_idx = key_idx + 1

    return tests


def build_boundaries(test_starts: dict[str, dict[str, int]]) -> dict[str, dict[str, list[dict[str, float | int]]]]:
    output: dict[str, dict[str, list[dict[str, float | int]]]] = {}

    for test_num in sorted(test_starts, key=int):
        starts = test_starts[test_num]
        output[test_num] = {}

        for idx, key in enumerate(ORDERED_KEYS):
            if key not in starts:
                continue

            start_page = starts[key]
            next_page = start_page

            for next_key in ORDERED_KEYS[idx + 1 :]:
                if next_key in starts:
                    next_page = starts[next_key]
                    break
            else:
                next_test = str(int(test_num) + 1)
                if key == "speaking" and next_test in test_starts and "listening_1" in test_starts[next_test]:
                    next_page = max(start_page, test_starts[next_test]["listening_1"] - 1)

            if next_page < start_page:
                next_page = start_page

            segments = [
                {"page": page, "y_start": 0.0, "y_end": FULL_PAGE_HEIGHT}
                for page in range(start_page, next_page + 1)
            ]
            output[test_num][key] = segments

            if key in READING_Q_MIRRORS:
                output[test_num][READING_Q_MIRRORS[key]] = list(segments)

    return output


def scan_book(book_id: int) -> tuple[dict[str, dict[str, list[dict[str, float | int]]]], dict[str, list[str]]]:
    pdf_path = find_pdf(book_id)
    doc = fitz.open(str(pdf_path))
    layout_starts = load_layout_starts(book_id)
    if layout_starts:
        starts, diagnostics = refine_layout_starts_with_ocr(doc, layout_starts)
        doc.close()
        return build_boundaries(starts), diagnostics

    all_events: list[Event] = []
    start_page, end_page = load_layout_scan_range(book_id, len(doc))
    for page_idx in range(start_page - 1, end_page):
        page_num = page_idx + 1
        lines = page_lines(doc[page_idx], page_num)
        all_events.extend(classify_events(lines))

    doc.close()

    starts = parse_tests(all_events)
    boundaries = build_boundaries(starts)
    diagnostics: dict[str, list[str]] = {}

    for test_num in ("1", "2", "3", "4"):
        missing = [key for key in ORDERED_KEYS if key not in starts.get(test_num, {})]
        if missing:
            diagnostics[test_num] = missing

    return boundaries, diagnostics


def main() -> None:
    all_boundaries = {}
    all_diagnostics = {}

    for book_id in BOOK_RANGE:
        print(f"Scanning Cambridge IELTS {book_id}...")
        boundaries, diagnostics = scan_book(book_id)
        all_boundaries[str(book_id)] = boundaries
        if diagnostics:
            all_diagnostics[str(book_id)] = diagnostics
            print(f"  Missing headers: {diagnostics}")
        else:
            print("  OK")

    boundaries_path = Path("phase0") / "output" / "cambridge_boundaries.json"
    with boundaries_path.open("w", encoding="utf-8") as file:
        json.dump(all_boundaries, file, ensure_ascii=False, indent=2)

    diagnostics_path = Path("phase0") / "output" / "cambridge_boundaries_diagnostics.json"
    with diagnostics_path.open("w", encoding="utf-8") as file:
        json.dump(all_diagnostics, file, ensure_ascii=False, indent=2)

    print(f"Saved boundaries to {boundaries_path}")
    print(f"Saved diagnostics to {diagnostics_path}")


if __name__ == "__main__":
    main()
