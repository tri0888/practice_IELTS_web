from pathlib import Path
import json


def find_seed_path() -> Path:
    repo_root = Path(__file__).resolve().parents[2]
    candidate = repo_root / "phase0" / "output" / "cambridge_11_seed.json"
    if candidate.exists():
        return candidate
    # fallback: search
    for p in repo_root.rglob("cambridge_11_seed.json"):
        return p
    raise FileNotFoundError("Seed JSON not found. Run phase0 importer first.")


def load_seed() -> dict:
    path = find_seed_path()
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def get_tests_list(seed: dict) -> list:
    return [
        {"test_number": t["test_number"], "section_count": len(t.get("sections", []))}
        for t in seed.get("tests", [])
    ]


def find_test(seed: dict, book: int, test_number: int) -> dict | None:
    for t in seed.get("tests", []):
        if t.get("test_number") == test_number:
            return t
    return None


def collect_reading_answers(seed: dict, test_number: int) -> dict:
    """Return a mapping question_number -> answer_text for the given test."""
    t = find_test(seed, 11, test_number)
    if not t:
        return {}
    mapping = {}
    for section in t.get("sections", []):
        for row in section.get("rows", []):
            q = int(row.get("question_number"))
            a = row.get("answer_text")
            mapping[q] = a
    return mapping


def collect_audio_assets(seed: dict, test_number: int) -> list[dict]:
    assets = []
    for item in seed.get("audio_assets", []):
        if int(item.get("test_number", -1)) == test_number:
            assets.append(item)
    return assets
