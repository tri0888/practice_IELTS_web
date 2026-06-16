from pydantic import BaseModel
from typing import List

class AttemptCreate(BaseModel):
    user_id: str | None = None
    book: int = 11
    test: int
    skill: str

class AttemptSubmit(BaseModel):
    responses: List[dict]

class AdminLayoutIn(BaseModel):
    layout: dict

class AdminAnswersIn(BaseModel):
    answers: dict

class ExtractAnswersIn(BaseModel):
    page_number: int
    skill: str  # "listening" or "reading"

class AdminAudioIn(BaseModel):
    audio_assets: list
