from __future__ import annotations

import argparse
import json
import re
from dataclasses import asdict, dataclass, field
from pathlib import Path

from pypdf import PdfReader


TEST_HEADER_RE = re.compile(r"TEST\s+(?P<test>\d+)\s+-\s+CAMBRIDGE\s+11", re.IGNORECASE)
SECTION_HEADER_RE = re.compile(r"(?P<label>I\.\s+PASSAGE\s+1|II\.\s+PASSAGE\s+2|III\.\s+PASSAGE\s+3)", re.IGNORECASE)
ROW_START_RE = re.compile(r"^(?P<number>\d{1,2})\s+(?P<body>.+)$")
PAGE_HEADER_RE = re.compile(r"^THE SOL IELTS\s*\|\s*THE SOL EDUCATION.*$", re.IGNORECASE)
EXPLANATION_MARKERS = (
    " Câu đầu",
    " Câu cuối",
    " Câu ",
    " Dòng",
    " Văn bản",
    " Đoạn",
    " Trang",
    " Lưu ý",
    " paragraph",
    " page",
)
MARKER_RE = re.compile(
    r"TEST\s+(?P<test>\d+)\s+-\s+CAMBRIDGE\s+11|I\.\s+PASSAGE\s+1|II\.\s+PASSAGE\s+2|III\.\s+PASSAGE\s+3",
    re.IGNORECASE,
)
SECTION_RANGES = {
    "Passage 1": (1, 13),
    "Passage 2": (14, 26),
    "Passage 3": (27, 40),
}


@dataclass
class AnswerRow:
    question_number: int
    answer_text: str
    explanation_text: str
    raw_text: str


@dataclass
class PassageSection:
    name: str
    rows: list[AnswerRow] = field(default_factory=list)


@dataclass
class CambridgeTest:
    test_number: int
    sections: list[PassageSection] = field(default_factory=list)


def find_workspace_root(start: Path) -> Path:
    for candidate in [start, *start.parents]:
        if (candidate / "IELTS_Platform_PRD.md").exists():
            return candidate
    return start.parent


def find_book_root(workspace_root: Path) -> Path:
    candidates: list[Path] = []
    for candidate in workspace_root.rglob("Cambridge IELTS 11"):
        if not candidate.is_dir():
            continue
        has_pdf = any(candidate.rglob("*.pdf"))
        has_audio = any(candidate.rglob("*.mp3"))
        if has_pdf and has_audio:
            candidates.append(candidate)
    if not candidates:
        raise FileNotFoundError("Could not locate the Cambridge IELTS 11 sample folder")
    return min(candidates, key=lambda path: len(path.parts))


def find_source_pdf(book_root: Path) -> Path:
    pdf_candidates = [path for path in book_root.rglob("*.pdf") if "__MACOSX" not in path.parts]
    if not pdf_candidates:
        raise FileNotFoundError("Could not locate the Cambridge IELTS 11 PDF")

    def pdf_rank(path: Path) -> tuple[int, int, int]:
        reader = PdfReader(str(path))
        page_count = len(reader.pages)
        sample_text = " ".join(
            (reader.pages[index].extract_text() or "")
            for index in range(min(3, page_count))
        ).upper()
        has_test_header = "TEST 1 - CAMBRIDGE 11" in sample_text
        return (0 if has_test_header else 1, page_count, -path.stat().st_size)

    return min(pdf_candidates, key=pdf_rank)


def find_audio_files(book_root: Path) -> list[Path]:
    audio_files = [
        path
        for path in book_root.rglob("*.mp3")
        if "__MACOSX" not in path.parts and re.search(r"IELTS11_Test\d+_Section\d+\.mp3$", path.name)
    ]
    return sorted(audio_files)


def normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def split_answer_and_explanation(body: str) -> tuple[str, str]:
    normalized = normalize_text(body)
    earliest_match = None
    for marker in EXPLANATION_MARKERS:
        match = re.search(re.escape(marker), normalized, flags=re.IGNORECASE)
        if match and (earliest_match is None or match.start() < earliest_match.start()):
            earliest_match = match
    if earliest_match is None:
        return normalized, ""
    answer_text = normalized[: earliest_match.start()].strip()
    explanation_text = normalized[earliest_match.start() :].strip()
    return answer_text, explanation_text


def extract_page_texts(pdf_path: Path) -> list[str]:
    reader = PdfReader(str(pdf_path))
    pages: list[str] = []
    for page in reader.pages:
        text = page.extract_text() or ""
        pages.append(normalize_text(text.replace("\n", " ")))
    return pages


def parse_section_rows(section_text: str, start_question: int, end_question: int) -> list[AnswerRow]:
    accepted_markers: list[tuple[int, int]] = []
    expected_question = start_question
    for match in re.finditer(r"(?<!\d)(\d{1,2})\s+", section_text):
        question_number = int(match.group(1))
        if question_number != expected_question:
            continue
        accepted_markers.append((question_number, match.start()))
        expected_question += 1
        if expected_question > end_question:
            break

    rows: list[AnswerRow] = []
    for index, (question_number, start_index) in enumerate(accepted_markers):
        end_index = accepted_markers[index + 1][1] if index + 1 < len(accepted_markers) else len(section_text)
        body = normalize_text(section_text[start_index + len(str(question_number)) : end_index])
        answer_text, explanation_text = split_answer_and_explanation(body)
        rows.append(
            AnswerRow(
                question_number=question_number,
                answer_text=answer_text,
                explanation_text=explanation_text,
                raw_text=body,
            )
        )
    return rows


def parse_tests(pdf_path: Path) -> list[CambridgeTest]:
    pages = extract_page_texts(pdf_path)
    start_index = 0
    for index, page_text in enumerate(pages):
        normalized_page = page_text.upper()
        if "TEST 1 - CAMBRIDGE 11" in normalized_page and ("CAU" in normalized_page or "CÂU" in normalized_page):
            start_index = index
            break

    section_buffers: dict[tuple[int, str], list[str]] = {}
    current_test: int | None = None
    current_section: str | None = None

    joined_text = " ".join(pages[start_index:])
    last_match_end = 0
    for match in MARKER_RE.finditer(joined_text):
        gap = normalize_text(joined_text[last_match_end:match.start()])
        if current_test is not None and current_section is not None and gap:
            section_buffers.setdefault((current_test, current_section), []).append(gap)

        marker_text = match.group(0)
        test_match = TEST_HEADER_RE.fullmatch(marker_text)
        if test_match:
            current_test = int(test_match.group("test"))
            current_section = None
        else:
            section_match = SECTION_HEADER_RE.fullmatch(marker_text)
            if section_match:
                current_section = {
                    "I. PASSAGE 1": "Passage 1",
                    "II. PASSAGE 2": "Passage 2",
                    "III. PASSAGE 3": "Passage 3",
                }[section_match.group(0).upper()]

        last_match_end = match.end()

    tail = normalize_text(joined_text[last_match_end:])
    if current_test is not None and current_section is not None and tail:
        section_buffers.setdefault((current_test, current_section), []).append(tail)

    tests: list[CambridgeTest] = []
    for test_number in sorted({key[0] for key in section_buffers}):
        sections: list[PassageSection] = []
        for section_name in ["Passage 1", "Passage 2", "Passage 3"]:
            section_text = normalize_text(" ".join(section_buffers.get((test_number, section_name), [])))
            if not section_text:
                continue
            start_question, end_question = SECTION_RANGES[section_name]
            rows = parse_section_rows(section_text, start_question, end_question)
            sections.append(PassageSection(name=section_name, rows=rows))
        tests.append(CambridgeTest(test_number=test_number, sections=sections))
    return tests


def build_manifest(workspace_root: Path) -> dict:
    book_root = find_book_root(workspace_root)
    pdf_path = find_source_pdf(book_root)
    audio_files = find_audio_files(book_root)
    tests = parse_tests(pdf_path)

    audio_manifest = []
    for audio_file in audio_files:
        match = re.search(r"IELTS11_Test(?P<test>\d+)_Section(?P<section>\d+)\.mp3$", audio_file.name)
        if not match:
            continue
        audio_manifest.append(
            {
                "test_number": int(match.group("test")),
                "section_number": int(match.group("section")),
                "file_name": audio_file.name,
                "relative_path": audio_file.relative_to(workspace_root).as_posix(),
            }
        )

    return {
        "book_number": 11,
        "book_title": "Cambridge IELTS 11",
        "source_pdf": {
            "file_name": pdf_path.name,
            "relative_path": pdf_path.relative_to(workspace_root).as_posix(),
            "page_count": len(PdfReader(str(pdf_path)).pages),
        },
        "audio_assets": audio_manifest,
        "tests": [
            {
                "test_number": test.test_number,
                "sections": [
                    {
                        "name": section.name,
                        "rows": [asdict(row) for row in section.rows],
                        "row_count": len(section.rows),
                    }
                    for section in test.sections
                ],
            }
            for test in tests
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Build the Cambridge IELTS 11 phase 0 seed manifest.")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).resolve().parent / "output" / "cambridge_11_seed.json",
        help="Path to the JSON manifest that will be written.",
    )
    args = parser.parse_args()

    workspace_root = find_workspace_root(Path(__file__).resolve())
    manifest = build_manifest(workspace_root)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {args.output}")


if __name__ == "__main__":
    main()