# Backend (Phase 1a) - FastAPI skeleton

Setup & run (using virtualenv):

```bash
# from repository root
# create virtualenv (if not exists)
C:/Users/trand/AppData/Local/Programs/Python/Python310/python.exe -m venv .venv
# activate (PowerShell)
.\.venv\Scripts\Activate.ps1
# or (bash)
source .venv/Scripts/activate
# install deps
.venv/Scripts/python.exe -m pip install -r backend/requirements.txt
# run dev server
.venv/Scripts/uvicorn.exe backend.app.main:app --reload --port 8000
```

Endpoints (dev):

- `POST /api/auth/register` — register (json: email, password)
- `POST /api/auth/login` — login (json: email, password) -> returns access token
- `GET /api/tests` — list tests (loaded from phase0 seed)
- `GET /api/tests/{book}/{test}` — test details
- `POST /api/attempts` — start an attempt
- `PUT /api/attempts/{id}/submit` — submit attempt

Seed loader reads `phase0/output/cambridge_11_seed.json` automatically from workspace.

Import seed into MongoDB (must run a MongoDB instance reachable at `mongodb://localhost:27017` or set `MONGODB_URI`):

```bash
# with venv activated
.venv/Scripts/python.exe - <<'PY'
from backend.app import seeder, db
seed = seeder.load_seed()
tcoll = db.tests_collection()
acoll = db.audio_collection()
for t in seed.get('tests',[]):
	tcoll.update_one({'test_number': t['test_number']}, {'$set': t}, upsert=True)
for a in seed.get('audio_assets',[]):
	acoll.update_one({'file_name': a['file_name']}, {'$set': a}, upsert=True)
print('imported')
PY
```