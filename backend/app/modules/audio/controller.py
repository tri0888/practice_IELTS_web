from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from app.modules.r2_client import is_local_file, get_local_file_path, get_r2_file_stream, is_r2_enabled
from . import services

router = APIRouter(tags=["Audio"])
@router.get("/api/audio/{file_name:path}")
def stream_audio(file_name: str):
    relative_key = services.stream_audio(file_name)
    # Extract just the filename portion for headers/response parameter
    filename_only = file_name.split("/")[-1].split("\\")[-1]
    if is_local_file(relative_key):
        local_path = get_local_file_path(relative_key)
        return FileResponse(path=local_path, media_type="audio/mpeg", filename=filename_only)
    elif is_r2_enabled():
        stream, content_type = get_r2_file_stream(relative_key)
        headers = {"Content-Disposition": f"inline; filename=\"{filename_only}\""}
        return StreamingResponse(stream, media_type=content_type, headers=headers)
    else:
        raise HTTPException(status_code=404, detail=f"Audio file {file_name} not found")
@router.get("/api/admin/books/{book}/audio-files")
def list_book_audio_files(book: int):
    return services.list_book_audio_files(book)
