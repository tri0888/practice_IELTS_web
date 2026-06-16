from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.models import database as db
from app import seeder
from app.modules.practice.services import load_all_layouts
from app.modules.tests import router as tests_router
from app.modules.practice import router as practice_router
from app.modules.attempts import router as attempts_router
from app.modules.admin import router as admin_router
from app.modules.audio import router as audio_router

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
app.include_router(practice_router)
app.include_router(tests_router)
app.include_router(attempts_router)
app.include_router(admin_router)
app.include_router(audio_router)

@app.on_event("startup")
def startup_event():
    # Warm up seed data cache
    seeder.get_seed_data()
    print("Seed data loaded successfully on startup.")

@app.get("/")
def root():
    return {
        "service": "IELTS Backend",
        "status": "ok",
        "docs": "/docs",
        "tests_endpoint": "/api/tests",
    }

@app.post("/api/tests/import")
def import_tests():
    if not db.is_available():
        raise HTTPException(status_code=503, detail="DB not available; cannot import tests")
        
    # 1. Tests
    coll = db.tests_collection()
    coll.delete_many({})
    seed_data = seeder.get_seed_data()
    inserted = 0
    for t in seed_data.get("tests", []):
        book_id = t.get("book", 11)
        coll.update_one({"book": book_id, "test_number": t["test_number"]}, {"$set": t}, upsert=True)
        inserted += 1
        
    # 2. Audio Assets
    audio_coll = db.audio_collection()
    if audio_coll is not None:
        audio_coll.delete_many({})
        for a in seed_data.get("audio_assets", []):
            book_id = a.get("book", 11)
            audio_coll.update_one({"book": book_id, "test_number": a["test_number"], "file_name": a["file_name"]}, {"$set": a}, upsert=True)
            
    # 3. Layouts
    layout_coll = db.layouts_collection()
    if layout_coll is not None:
        layout_coll.delete_many({})
        layouts = load_all_layouts()
        for b_str, tests in layouts.items():
            b = int(b_str)
            for t_str, l_data in tests.items():
                t_num = int(t_str)
                layout_coll.update_one({"book": b, "test": t_num}, {"$set": {"layout": l_data}}, upsert=True)
                
    # 4. Answers
    ans_coll = db.answers_collection()
    if ans_coll is not None:
        ans_coll.delete_many({})
        for t in seed_data.get("tests", []):
            book_id = t.get("book", 11)
            test_number = t["test_number"]
            answers = {}
            for section in t.get("sections", []):
                for row in section.get("rows", []):
                    answers[str(row["question_number"])] = {
                        "answer": row.get("answer_text", ""),
                        "explanation": row.get("explanation_text", "")
                    }
            ans_coll.update_one({"book": book_id, "test": test_number}, {"$set": {"answers": answers}}, upsert=True)
            
    return {"inserted_tests": inserted}
