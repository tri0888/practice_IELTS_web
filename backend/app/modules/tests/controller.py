from fastapi import APIRouter
from . import services

router = APIRouter(prefix="/api/tests", tags=["Tests"])

@router.get("")
def list_tests():
    return services.list_tests()

@router.get("/{book}/page-count")
def get_pdf_page_count(book: int, pdf_type: str = "academic"):
    return services.get_pdf_page_count(book, pdf_type)

@router.get("/{book}/{test}")
def get_test(book: int, test: int):
    return services.get_test(book, test)

@router.get("/{book}/{test}/audio")
def get_test_audio(book: int, test: int):
    return services.get_test_audio(book, test)

@router.get("/{book}/{test}/{skill}")
def get_skill(book: int, test: int, skill: str):
    return services.get_skill(book, test, skill)
