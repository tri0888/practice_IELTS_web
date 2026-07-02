"""Pure answer-grading primitives for IELTS/TOEIC.

Extracted from ``attempts/services.py`` (SRP): this module knows how to compare
a user's answer against an official answer string. It has no DB / attempt-state
dependencies. Behavior is locked by ``tests/test_grading_characterization.py``.
"""
import re
import itertools


def clean_spaces(s: str) -> str:
    return re.sub(r'\s+', ' ', s).strip()


def clean_punctuation(s: str) -> str:
    return s.strip(".,;:!?\"' ")


def expand_parentheses(s: str) -> list[str]:
    match = re.search(r'\(([^)]*)\)', s)
    if not match:
        return [clean_spaces(s)]

    start, end = match.span()
    prefix = s[:start]
    inner = match.group(1)
    suffix = s[end:]

    opt1 = prefix + suffix
    opt2 = prefix + inner + suffix

    res1 = expand_parentheses(opt1)
    res2 = expand_parentheses(opt2)

    return list(set(res1 + res2))


def expand_slashes(s: str) -> list[str]:
    tokens = s.split()
    if not tokens:
        return [""]

    token_variations = []
    for token in tokens:
        if '/' in token:
            parts = token.split('/')
            parts = [p for p in parts if p]
            if parts:
                token_variations.append(parts)
            else:
                token_variations.append([token])
        else:
            token_variations.append([token])

    combinations = itertools.product(*token_variations)
    return [" ".join(combo) for combo in combinations]


def get_correct_answers_list(correct_ans_str: str) -> list[str]:
    if not correct_ans_str:
        return []

    main_options = re.split(r'\s+/\s+', correct_ans_str)
    all_correct = []

    for option in main_options:
        parenthetical_expanded = expand_parentheses(option)
        for p_expanded in parenthetical_expanded:
            slash_expanded = expand_slashes(p_expanded)
            for s_expanded in slash_expanded:
                all_correct.append(clean_punctuation(s_expanded.lower()))

    all_correct.append(clean_punctuation(correct_ans_str.lower()))
    return list(set(all_correct))


def check_user_answer(user_ans: str, correct_ans_str: str) -> bool:
    cleaned_user = clean_punctuation(clean_spaces(user_ans).lower())
    if not cleaned_user:
        return False

    correct_list = get_correct_answers_list(correct_ans_str)
    if cleaned_user in correct_list:
        return True

    parts = re.split(r'\s*[-–—]\s*', correct_ans_str)
    if len(parts) > 1:
        first_word_cleaned = clean_punctuation(clean_spaces(parts[0]).lower())
        if cleaned_user == first_word_cleaned:
            return True

    return False


def get_correct_answer_for_question(q: int, correct: dict) -> str:
    if str(q) in correct:
        val = correct[str(q)]
        return val.get("answer", "") if isinstance(val, dict) else str(val)
    if q in correct:
        val = correct[q]
        return val.get("answer", "") if isinstance(val, dict) else str(val)

    for key, val in correct.items():
        cleaned_key = str(key).replace('–', '-').replace('—', '-')
        if '-' in cleaned_key:
            parts = cleaned_key.split('-')
            if len(parts) == 2:
                try:
                    start = int(parts[0])
                    end = int(parts[1])
                    if start <= q <= end:
                        return val.get("answer", "") if isinstance(val, dict) else str(val)
                except ValueError:
                    pass
    return ""
