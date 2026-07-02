"""Characterization tests for the answer-grading logic.

These lock in the *current* behavior (quirks included) so the M1 refactor
(extracting `attempts/grading.py`) can be verified as behavior-preserving.

They import from `app.modules.attempts.services` on purpose: after M1 moves
these functions into `grading.py`, `services` must keep re-exporting them, so
these tests staying green proves the public surface was preserved.
"""
import pytest

from app.modules.attempts import services as s


# --- string helpers -------------------------------------------------------
def test_clean_spaces_collapses_whitespace():
    assert s.clean_spaces("  hello   world ") == "hello world"


def test_clean_punctuation_strips_edges_only():
    assert s.clean_punctuation('.,"hello world!?') == "hello world"


def test_expand_parentheses_keeps_prefix():
    # Known quirk: the prefix is preserved, so "main reason" alone is NOT produced.
    assert sorted(s.expand_parentheses("the (main) reason")) == [
        "the main reason",
        "the reason",
    ]


def test_expand_slashes_cartesian_product():
    assert sorted(s.expand_slashes("cat/dog runs")) == ["cat runs", "dog runs"]


def test_get_correct_answers_list_includes_variants():
    variants = s.get_correct_answers_list("color / colour")
    assert "color" in variants
    assert "colour" in variants


# --- check_user_answer: the behavior contract other code depends on -------
@pytest.mark.parametrize(
    "user, correct, expected",
    [
        ("colour", "color / colour", True),
        ("color", "color / colour", True),
        ("COLOR", "color / colour", True),      # case-insensitive
        ("the reason", "the (main) reason", True),
        ("main reason", "the (main) reason", False),  # quirk: prefix kept
        ("dog", "cat/dog", True),
        ("twenty", "twenty-five", True),        # first word before hyphen
        ("twenty-five", "twenty-five", True),
        ("north", "north-west", True),
        ("hello world", "  hello   world ", True),
        ("b", "B", True),
        ("anything", "", False),                # empty correct answer
    ],
)
def test_check_user_answer(user, correct, expected):
    assert s.check_user_answer(user, correct) is expected


# --- get_correct_answer_for_question: supports range keys -----------------
def test_get_correct_answer_for_question():
    correct = {"1": "apple", "14-26": {"answer": "B"}, "27": {"answer": "C"}}
    assert s.get_correct_answer_for_question(1, correct) == "apple"
    assert s.get_correct_answer_for_question(20, correct) == "B"   # inside 14-26 range
    assert s.get_correct_answer_for_question(27, correct) == "C"
    assert s.get_correct_answer_for_question(99, correct) == ""    # not found
