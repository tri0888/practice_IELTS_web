# IELTS Platform — Backend

This is the FastAPI backend application for the IELTS practice web platform. It serves the test configuration layout maps, audio assets, text contents, grading capabilities, and authentication APIs.

## Quick Start

Ensure you have Python 3.10+ installed.

```bash
# create virtualenv (from root repository)
python -m venv .venv

# activate environment (Windows PowerShell)
.\.venv\Scripts\Activate.ps1
# or activate environment (Bash)
source .venv/Scripts/activate

# Install requirements
pip install -r backend/requirements.txt

# Start dev server on port 8000
uvicorn backend.app.main:app --reload --port 8000
```

The service will run at [http://localhost:8000](http://localhost:8000).

---

## Database (MongoDB) Fallback

The backend connects to MongoDB (configured by `MONGODB_URI` environment variable, defaulting to `mongodb://localhost:27017`). If MongoDB is not running or is unreachable, the API falls back to **in-memory data storage** and loads test items directly from JSON file seeds.

To seed the database with Cambridge tests content:
```bash
python -c "from backend.app import seeder, db; seed = seeder.load_seed(); tcoll = db.tests_collection(); acoll = db.audio_collection(); [tcoll.update_one({'test_number': t['test_number']}, {'$set': t}, upsert=True) for t in seed.get('tests',[])]; [acoll.update_one({'file_name': a['file_name']}, {'$set': a}, upsert=True) for a in seed.get('audio_assets',[])]; print('Database Seeded!')"
```

For more info, check the [Root README](file:///d:/Git/practice_IELTS_web/README.md).