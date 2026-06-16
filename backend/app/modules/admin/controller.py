from fastapi import APIRouter
from app.models.schemas import AdminLayoutIn, AdminAnswersIn, AdminAudioIn, ExtractAnswersIn
from . import services

router = APIRouter(prefix="/api/admin/tests", tags=["Admin"])

@router.get("/{book}/{test}")
def admin_get_test_info(book: int, test: int):
    return services.admin_get_test_info(book, test)

@router.put("/{book}/{test}/layout")
def admin_update_layout(book: int, test: int, data: AdminLayoutIn):
    return services.admin_update_layout(book, test, data.layout)

@router.put("/{book}/{test}/answers")
def admin_update_answers(book: int, test: int, data: AdminAnswersIn):
    return services.admin_update_answers(book, test, data.answers)

@router.put("/{book}/{test}/audio")
def admin_update_audio(book: int, test: int, data: AdminAudioIn):
    return services.admin_update_audio(book, test, data.audio_assets)

@router.post("/{book}/{test}/extract-answers")
def extract_answers(book: int, test: int, data: ExtractAnswersIn):
    return services.extract_answers(book, test, data.page_number, data.skill)
