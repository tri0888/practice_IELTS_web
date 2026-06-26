from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.models import database as db
from app.modules.practice.services import load_all_layouts
from app.modules.auth import router as auth_router
from app.modules.auth.services import seed_approved_user
from app.modules.tests import router as tests_router
from app.modules.practice import router as practice_router
from app.modules.attempts import router as attempts_router
from app.modules.audio import router as audio_router
from app.modules.r2_client import router as r2_client_router

app = FastAPI(title="IELTS Platform API", version="1.0.0")

# CORS Setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount all routers
app.include_router(auth_router)
app.include_router(practice_router)
app.include_router(tests_router)
app.include_router(attempts_router)
app.include_router(audio_router)
app.include_router(r2_client_router)

@app.on_event("startup")
def startup_event():
    seed_approved_user()
    print("Backend started successfully.")

@app.get("/")
def root():
    return {
        "service": "IELTS Backend",
        "status": "ok",
        "docs": "/docs",
        "tests_endpoint": "/api/tests",
    }
