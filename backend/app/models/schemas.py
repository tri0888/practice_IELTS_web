from pydantic import BaseModel
from typing import List

class AttemptCreate(BaseModel):
    user_id: str | None = None
    book: int = 11
    test: int
    skill: str

class AttemptSubmit(BaseModel):
    responses: List[dict]
