from fastapi import APIRouter
from app.models.schemas import AttemptCreate, AttemptSubmit
from . import services

router = APIRouter(prefix="/api/attempts", tags=["Attempts"])

@router.post("")
def start_attempt(a: AttemptCreate):
    return services.start_attempt(a)

@router.put("/{attempt_id}/submit")
def submit_attempt(attempt_id: str, body: AttemptSubmit):
    return services.submit_attempt(attempt_id, body)

@router.get("/{attempt_id}/result")
def get_result(attempt_id: str):
    return services.get_result(attempt_id)
