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
from app.modules.vocabulary import router as vocabulary_router
from app.modules.telegram import init_telegram_bot, shutdown_telegram_bot
from app.modules.telegram.controller import router as telegram_router

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
app.include_router(vocabulary_router)
app.include_router(telegram_router)


@app.on_event("startup")
async def startup_event():
    seed_approved_user()
    try:
        await init_telegram_bot()
    except Exception as e:
        print(f"Failed to start telegram bot: {e}")
    print("Backend started successfully.")


@app.on_event("shutdown")
async def shutdown_event():
    try:
        await shutdown_telegram_bot()
    except Exception as e:
        print(f"Failed to shutdown telegram bot: {e}")



@app.get("/")
def root():
    return {
        "service": "IELTS Backend",
        "status": "ok",
        "docs": "/docs",
        "tests_endpoint": "/api/tests",
    }
