from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from pathlib import Path
from app.modules.auth.middleware import require_approved
from app.modules.r2_client import is_local_file, get_local_file_path, get_r2_file_stream, is_r2_enabled
from . import services

router = APIRouter(prefix="/api/tests", tags=["Tests"], dependencies=[Depends(require_approved)])

@router.get("")
def list_tests():
    return services.list_tests()

@router.get("/toeic")
def list_toeic_tests():
    return services.list_toeic_tests()


# Specific ETS routes (Must be defined before generic {book}/{test} parameters)
@router.get("/toeic/{year}/pdf/{pdf_type}/{test_number}")
@router.get("/toeic/pdf/{pdf_type}/{test_number}")
def get_ets_pdf(pdf_type: str, test_number: int, year: str = "2026"):
    relative_key = services.get_ets_pdf_path(pdf_type, test_number, year)
    filename = Path(relative_key).name
    if is_local_file(relative_key):
        local_path = get_local_file_path(relative_key)
        headers = {"Content-Disposition": f"inline; filename=\"{filename}\""}
        return FileResponse(path=local_path, media_type="application/pdf", headers=headers)
    elif is_r2_enabled():
        stream, content_type = get_r2_file_stream(relative_key)
        headers = {"Content-Disposition": f"inline; filename=\"{filename}\""}
        return StreamingResponse(stream, media_type=content_type, headers=headers)
    else:
        raise HTTPException(status_code=404, detail=f"ETS {year} {pdf_type.upper()} Test {test_number} PDF not found")

@router.get("/toeic/{year}/audio/{test_number}")
@router.get("/toeic/audio/{test_number}")
def get_ets_audio_list(test_number: int, year: str = "2026"):
    return services.get_ets_audio_list(test_number, year)

@router.get("/toeic/{year}/audio-file/{test_number}/{file_name}")
@router.get("/toeic/audio-file/{test_number}/{file_name}")
def get_ets_audio_file(test_number: int, file_name: str, year: str = "2026"):
    relative_key = services.get_ets_audio_file_path(test_number, file_name, year)
    if is_local_file(relative_key):
        local_path = get_local_file_path(relative_key)
        return FileResponse(path=local_path, media_type="audio/mpeg", filename=file_name)
    elif is_r2_enabled():
        stream, content_type = get_r2_file_stream(relative_key)
        headers = {"Content-Disposition": f"inline; filename=\"{file_name}\""}
        return StreamingResponse(stream, media_type=content_type, headers=headers)
    else:
        raise HTTPException(status_code=404, detail=f"ETS {year} Audio Test {test_number} File {file_name} not found")

@router.get("/toeic/{year}/answers/{pdf_type}/{test_number}")
@router.get("/toeic/answers/{pdf_type}/{test_number}")
def get_ets_answers(pdf_type: str, test_number: int, year: str = "2026"):
    return services.get_ets_answers(pdf_type, test_number, year)

# Generic book/test routes
@router.get("/{book}/page-count")
def get_pdf_page_count(book: int, pdf_type: str = "academic"):
    return services.get_pdf_page_count(book, pdf_type)

@router.get("/{book}/pdf")
def get_book_pdf(book: int, pdf_type: str = "academic"):
    relative_key = services.find_book_pdf_path(book, pdf_type)
    filename = Path(relative_key).name
    if is_local_file(relative_key):
        local_path = get_local_file_path(relative_key)
        headers = {"Content-Disposition": f"inline; filename=\"{filename}\""}
        return FileResponse(path=local_path, media_type="application/pdf", headers=headers)
    elif is_r2_enabled():
        stream, content_type = get_r2_file_stream(relative_key)
        headers = {"Content-Disposition": f"inline; filename=\"{filename}\""}
        return StreamingResponse(stream, media_type=content_type, headers=headers)
    else:
        raise HTTPException(status_code=404, detail=f"Cambridge IELTS {book} PDF not found")

@router.get("/{book}/{test}")
def get_test(book: int, test: int):
    return services.get_test(book, test)

@router.get("/{book}/{test}/audio")
def get_test_audio(book: int, test: int):
    return services.get_test_audio(book, test)

@router.get("/{book}/{test}/{skill}")
def get_skill(book: int, test: int, skill: str):
    return services.get_skill(book, test, skill)

