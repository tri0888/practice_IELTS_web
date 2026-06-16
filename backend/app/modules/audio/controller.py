from fastapi import APIRouter
from fastapi.responses import FileResponse
from . import services

router = APIRouter(tags=["Audio"])

@router.get("/api/audio/{file_name}")
def stream_audio(file_name: str):
    audio_path = services.stream_audio(file_name)
    return FileResponse(path=audio_path, media_type="audio/mpeg", filename=file_name)

@router.get("/api/admin/books/{book}/audio-files")
def list_book_audio_files(book: int):
    return services.list_book_audio_files(book)
