from fastapi import APIRouter, Depends, Query
from typing import Optional, List
from pydantic import BaseModel
from app.modules.auth.middleware import require_approved
from . import services

router = APIRouter(prefix="/api/vocabulary", tags=["Vocabulary"], dependencies=[Depends(require_approved)])

class ProgressUpdate(BaseModel):
    vocab: str
    status: Optional[str] = None
    is_correct: Optional[bool] = None

class BulkProgressUpdate(BaseModel):
    vocabs: List[str]
    status: str

@router.get("")
def get_vocabulary(
    search: Optional[str] = Query(None),
    pos: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    user: dict = Depends(require_approved)
):
    user_id = user.get("id")
    return services.get_vocabulary_list(
        user_id=user_id,
        search=search,
        pos=pos,
        status=status,
        page=page,
        limit=limit
    )

@router.get("/stats")
def get_stats(user: dict = Depends(require_approved)):
    user_id = user.get("id")
    return services.get_stats(user_id)

@router.get("/practice")
def get_practice(
    mode: str = Query("random"),
    pos: Optional[str] = Query(None),
    limit: int = Query(15, ge=5, le=50),
    user: dict = Depends(require_approved)
):
    user_id = user.get("id")
    return services.get_practice_words(
        user_id=user_id,
        mode=mode,
        pos=pos,
        limit=limit
    )

@router.post("/progress")
def update_progress(body: ProgressUpdate, user: dict = Depends(require_approved)):
    user_id = user.get("id")
    return services.update_progress(
        user_id=user_id,
        vocab=body.vocab,
        status=body.status,
        is_correct=body.is_correct
    )

@router.post("/progress/bulk")
def bulk_update_progress(body: BulkProgressUpdate, user: dict = Depends(require_approved)):
    user_id = user.get("id")
    return services.bulk_update_progress(
        user_id=user_id,
        vocabs=body.vocabs,
        status=body.status
    )
