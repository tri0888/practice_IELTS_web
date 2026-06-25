from fastapi import APIRouter
from . import services

router = APIRouter(prefix="/api/r2", tags=["R2 Client"])

@router.get("/status")
def get_r2_status():
    return {
        "enabled": services.is_r2_enabled(),
        "bucket": services.get_r2_bucket()
    }
