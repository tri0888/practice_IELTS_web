from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from . import services

router = APIRouter(prefix="/api/tests", tags=["Tests"])

@router.get("")
def list_tests():
    return services.list_tests()

# Specific ETS routes (Must be defined before generic {book}/{test} parameters)
@router.get("/ets/{year}/pdf/{pdf_type}/{test_number}")
@router.get("/ets/pdf/{pdf_type}/{test_number}")
def get_ets_pdf(pdf_type: str, test_number: int, year: str = "2026"):
    path = services.get_ets_pdf_path(pdf_type, test_number, year)
    headers = {"Content-Disposition": f"inline; filename=\"{path.name}\""}
    return FileResponse(path=path, media_type="application/pdf", headers=headers)

@router.get("/ets/{year}/audio/{test_number}")
@router.get("/ets/audio/{test_number}")
def get_ets_audio_list(test_number: int, year: str = "2026"):
    return services.get_ets_audio_list(test_number, year)

@router.get("/ets/{year}/audio-file/{test_number}/{file_name}")
@router.get("/ets/audio-file/{test_number}/{file_name}")
def get_ets_audio_file(test_number: int, file_name: str, year: str = "2026"):
    path = services.get_ets_audio_file_path(test_number, file_name, year)
    return FileResponse(path=path, media_type="audio/mpeg", filename=file_name)

@router.get("/ets/{year}/answers/{pdf_type}/{test_number}")
@router.get("/ets/answers/{pdf_type}/{test_number}")
def get_ets_answers(pdf_type: str, test_number: int, year: str = "2026"):
    return services.get_ets_answers(pdf_type, test_number, year)

# Generic book/test routes
@router.get("/{book}/page-count")
def get_pdf_page_count(book: int, pdf_type: str = "academic"):
    return services.get_pdf_page_count(book, pdf_type)

@router.get("/{book}/pdf")
def get_book_pdf(book: int, pdf_type: str = "academic"):
    path = services.find_book_pdf_path(book, pdf_type)
    headers = {"Content-Disposition": f"inline; filename=\"{path.name}\""}
    return FileResponse(path=path, media_type="application/pdf", headers=headers)

@router.get("/{book}/{test}")
def get_test(book: int, test: int):
    return services.get_test(book, test)

@router.get("/{book}/{test}/audio")
def get_test_audio(book: int, test: int):
    return services.get_test_audio(book, test)

@router.get("/{book}/{test}/{skill}")
def get_skill(book: int, test: int, skill: str):
    return services.get_skill(book, test, skill)


