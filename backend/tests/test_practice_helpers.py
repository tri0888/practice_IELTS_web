"""Unit tests for the pure helpers extracted in M1:
``is_toeic`` (B4) and ``resolve_part_pages`` (B3)."""
import pytest

from app.modules.practice.services import is_toeic, resolve_part_pages


@pytest.mark.parametrize(
    "book, expected",
    [(2026, True), (2000, True), (1999, False), (20, False), (11, False)],
)
def test_is_toeic(book, expected):
    assert is_toeic(book) is expected


LAYOUT = {
    "listening": [
        {"section": 1, "pages": [1, 2]},
        {"section": 2, "pages": [3]},
    ],
    "reading": [
        {"passage": 1, "passage_pages": [10, 11],
         "groups": [{"page": 10}, {"page": 11}, {"page": 10}]},
        {"passage": 2, "passage_pages": [12]},
    ],
    "writing": [{"task": 1, "pages": [20]}],
    "speaking": [{"pages": [30, 31]}],
}


@pytest.mark.parametrize(
    "part_key, expected",
    [
        ("listening_2", [3]),
        ("listening_all", [1, 2, 3]),
        ("reading_1", [10, 11]),
        ("reading_all", [10, 11, 12]),
        ("reading_q_1", [10, 11]),   # unique + sorted group pages
        ("writing_1", [20]),
        ("speaking", [30, 31]),
        ("unknown_9", []),
    ],
)
def test_resolve_part_pages(part_key, expected):
    assert resolve_part_pages(LAYOUT, part_key) == expected


def test_resolve_part_pages_empty_layout():
    assert resolve_part_pages({}, "listening_1") == []
