from fastapi import APIRouter, Response, HTTPException
from . import services

router = APIRouter(tags=["Practice"])

@router.get("/api/tests/{book}/{test}/practice")
def get_practice_layout(book: int, test: int):
    layout = services.get_practice_layout_dict(book, test)
    if not layout:
        raise HTTPException(status_code=404, detail=f"Practice layout not mapped for Book {book} Test {test}")
    return layout

@router.get("/api/tests/{book}/{test}/answers")
def get_test_answers(book: int, test: int, skill: str = None):
    answers = services.get_test_answers_dict(book, test, skill)
    if not answers:
         raise HTTPException(status_code=404, detail="Answers not found")
    return {"book": book, "test": test, "answers": answers}

@router.get("/api/pdf-pages/{book}/{pdf_type}/{page_number}.png")
def get_pdf_page_image_typed(book: int, pdf_type: str, page_number: int):
    try:
        png_bytes = services.get_pdf_page_bytes(book, page_number, pdf_type)
        return Response(content=png_bytes, media_type="image/png")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/pdf-parts/{book}/{pdf_type}/{test}/{part_key}.png")
def get_pdf_part_image(book: int, pdf_type: str, test: int, part_key: str):
    try:
         png_bytes = services.get_pdf_part_bytes(book, pdf_type, test, part_key)
         return Response(content=png_bytes, media_type="image/png")
    except HTTPException as he:
         raise he
    except Exception as e:
         raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/tests/{book}/pdf-parts/{pdf_type}/{test}/{part_key}")
def get_pdf_part_file(book: int, pdf_type: str, test: int, part_key: str):
    try:
        pdf_bytes = services.get_pdf_part_file(book, pdf_type, test, part_key)
        headers = {"Content-Disposition": f"inline; filename=\"{part_key}.pdf\""}
        return Response(content=pdf_bytes, media_type="application/pdf", headers=headers)
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/api/tests/{book}/pdf-pages/{pdf_type}/{page_number}")
def get_pdf_page_file(book: int, pdf_type: str, page_number: int, test: int = 1):
    try:
        pdf_bytes = services.get_pdf_page_file(book, page_number, pdf_type, test)
        headers = {"Content-Disposition": f"inline; filename=\"page_{page_number}.pdf\""}
        return Response(content=pdf_bytes, media_type="application/pdf", headers=headers)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

