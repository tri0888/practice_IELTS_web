from fastapi import APIRouter, Depends
from app.models.schemas import AttemptCreate, AttemptSubmit
from app.modules.auth.middleware import require_approved
from . import services

router = APIRouter(prefix="/api/histories", tags=["Attempts"], dependencies=[Depends(require_approved)])

@router.post("")
def start_attempt(a: AttemptCreate):
    return services.start_attempt(a)

@router.put("/{attempt_id}/submit")
def submit_attempt(attempt_id: str, body: AttemptSubmit):
    return services.submit_attempt(attempt_id, body)

@router.get("/{attempt_id}/result")
def get_result(attempt_id: str):
    return services.get_result(attempt_id)

@router.get("")
def list_attempts():
    return services.list_attempts()

@router.delete("/{attempt_id}")
def delete_attempt(attempt_id: str):
    return services.delete_attempt(attempt_id)
