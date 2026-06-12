from pathlib import Path
import json


def load_seed() -> dict:
    repo_root = Path(__file__).resolve().parents[2]
    output_dir = repo_root / "phase0" / "output"
    
    combined = {
        "tests": [],
        "audio_assets": []
    }
    
    # Load all seeds from 11 to 19
    for book in range(11, 20):
        p = output_dir / f"cambridge_{book}_seed.json"
        if p.exists():
            try:
                with p.open("r", encoding="utf-8") as f:
                    data = json.load(f)
                    for t in data.get("tests", []):
                        t["book"] = book
                        combined["tests"].append(t)
                    for a in data.get("audio_assets", []):
                        # Ensure book field is present
                        a["book"] = book
                        combined["audio_assets"].append(a)
            except Exception as e:
                print(f"Error loading seed for book {book}: {e}")
                
    return combined


def get_tests_list(seed: dict) -> list:
    return [
        {
            "book": t.get("book", 11),
            "test_number": t["test_number"],
            "section_count": len(t.get("sections", []))
        }
        for t in seed.get("tests", [])
    ]


def find_test(seed: dict, book: int, test_number: int) -> dict | None:
    for t in seed.get("tests", []):
        if t.get("book") == book and t.get("test_number") == test_number:
            return t
    return None


def collect_reading_answers(seed: dict, book: int, test_number: int) -> dict:
    """Return a mapping question_number -> answer_text for the given test (Reading passages)."""
    t = find_test(seed, book, test_number)
    if not t:
        return {}
    mapping = {}
    for section in t.get("sections", []):
        if section.get("name", "").lower().startswith("passage"):
            for row in section.get("rows", []):
                q = int(row.get("question_number"))
                a = row.get("answer_text")
                mapping[q] = a
    return mapping


def collect_listening_answers(seed: dict, book: int, test_number: int) -> dict:
    """Return a mapping question_number -> answer_text for the given test (Listening sections)."""
    t = find_test(seed, book, test_number)
    if not t:
        return {}
    mapping = {}
    for section in t.get("sections", []):
        name = section.get("name", "").lower()
        if name.startswith("section") or name.startswith("listening"):
            for row in section.get("rows", []):
                q = int(row.get("question_number"))
                a = row.get("answer_text")
                mapping[q] = a
    return mapping


def collect_audio_assets(seed: dict, book: int, test_number: int) -> list[dict]:
    assets = []
    for item in seed.get("audio_assets", []):
        if int(item.get("book", -1)) == book and int(item.get("test_number", -1)) == test_number:
            assets.append(item)
    return assets

