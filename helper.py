import re
from pathlib import Path

import fitz
import numpy as np
from rapidocr_onnxruntime import RapidOCR

# ==================================================
# CONFIG
# ==================================================

PDF_FILE = "./Books/ETS 24-26/ETS 2025/ETS-2025-LC.pdf"

OUTPUT_DIR = Path("./Books/ETS 24-26/ETS 2025/ETS-2025-LC")

TOTAL_TESTS = 10

MAX_RADIUS = 5

OCR_SCALE = 2

OUTPUT_DIR.mkdir(exist_ok=True)

# ==================================================
# OCR
# ==================================================

ocr = RapidOCR()

doc = fitz.open(PDF_FILE)

total_pages = len(doc)

print(f"Total pages: {total_pages}")


# ==================================================
# OCR PAGE
# ==================================================

def ocr_page(page_idx: int) -> str:
    page = doc[page_idx]

    # vùng giữa trang
    roi = fitz.Rect(
        page.rect.width * 0.15,
        page.rect.height * 0.10,
        page.rect.width * 0.95,
        page.rect.height * 0.80,
    )

    pix = page.get_pixmap(
        matrix=fitz.Matrix(OCR_SCALE, OCR_SCALE),
        clip=roi,
        alpha=False,
    )

    img = np.frombuffer(
        pix.samples,
        dtype=np.uint8
    ).reshape(
        pix.height,
        pix.width,
        pix.n
    )

    result, _ = ocr(img)

    if not result:
        return ""

    text = " ".join(
        str(item[1])
        for item in result
    )

    return text


# ==================================================
# CHECK TEST PAGE
# ==================================================

def is_test_page(text: str, test_no: int) -> bool:

    text = text.upper()

    patterns = [
        rf"\bTEST\s*0?{test_no}\b",      # TEST 01
        rf"\b0?{test_no}\s*TEST\b",      # 01 TEST
        rf"\bLC\s*TEST\s*0?{test_no}\b", # LC TEST 01
    ]

    for p in patterns:
        if re.search(p, text):
            return True

    return False


# ==================================================
# FIND TEST PAGE
# ==================================================

def find_test_page(
    test_no: int,
    expected_page: int
):
    expected_page = max(
        0,
        min(
            total_pages - 1,
            expected_page
        )
    )

    # thử đúng trang dự đoán trước
    text = ocr_page(expected_page)

    print(
        f"TEST {test_no:02d} "
        f"expected page {expected_page + 1}"
    )

    if is_test_page(text, test_no):
        print(
            f"  FOUND at "
            f"{expected_page + 1}"
        )
        return expected_page

    # mở rộng dần
    for radius in range(1, MAX_RADIUS + 1):

        left = expected_page - radius
        right = expected_page + radius

        if left >= 0:

            text = ocr_page(left)

            if is_test_page(
                text,
                test_no
            ):
                print(
                    f"  FOUND at "
                    f"{left + 1}"
                )
                return left

        if right < total_pages:

            text = ocr_page(right)

            if is_test_page(
                text,
                test_no
            ):
                print(
                    f"  FOUND at "
                    f"{right + 1}"
                )
                return right

    print(
        f"  NOT FOUND "
        f"(TEST {test_no})"
    )

    return None


# ==================================================
# FIND ALL TESTS
# ==================================================

test_pages = {}

# TEST 01 giả định bắt đầu từ đầu PDF
test_pages[1] = 0

# khoảng cách ban đầu
estimated_gap = total_pages / TOTAL_TESTS

print(
    f"Initial gap = "
    f"{estimated_gap:.2f}"
)

for test_no in range(2, TOTAL_TESTS + 1):

    previous_page = test_pages[test_no - 1]

    expected_page = round(
        previous_page + estimated_gap
    )

    found_page = find_test_page(
        test_no,
        expected_page
    )

    if found_page is None:
        continue

    test_pages[test_no] = found_page

    # cập nhật khoảng cách thực tế
    real_gap = (
        found_page -
        previous_page
    )

    estimated_gap = (
        estimated_gap * 0.7
        + real_gap * 0.3
    )

    print(
        f"  gap={real_gap}, "
        f"new estimate="
        f"{estimated_gap:.2f}"
    )

print("\nDetected tests:")
for k, v in test_pages.items():
    print(
        f"TEST {k:02d} "
        f"-> page {v + 1}"
    )

# ==================================================
# SPLIT PDF
# ==================================================

tests = sorted(
    test_pages.items(),
    key=lambda x: x[0]
)

for idx, (test_no, start_page) in enumerate(tests):

    if idx < len(tests) - 1:
        end_page = (
            tests[idx + 1][1] - 1
        )
    else:
        end_page = (
            total_pages - 1
        )

    out_pdf = fitz.open()

    out_pdf.insert_pdf(
        doc,
        from_page=start_page,
        to_page=end_page
    )

    output_file = (
        OUTPUT_DIR /
        f"TEST_{test_no:02d}.pdf"
    )

    out_pdf.save(output_file)
    out_pdf.close()

    print(
        f"Saved {output_file.name}"
        f" | pages "
        f"{start_page + 1}"
        f"-{end_page + 1}"
    )

doc.close()

print("\nDone.")