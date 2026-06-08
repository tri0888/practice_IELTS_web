# IELTS Practice Platform

An interactive, premium web application for practicing Cambridge IELTS exams. The platform features responsive multi-column layouts, integrated audio streaming, PDF view synchronizations, and an automated answer key correction workflow with detailed explanations.

---

## 📂 Codebase Structure

The project is structured logically into three main components:

```
├── backend/                  # FastAPI Python backend service
│   ├── app/
│   │   ├── auth.py           # JWT Authentication logic
│   │   ├── db.py             # MongoDB connection and fallback mechanisms
│   │   ├── main.py           # REST API routes & PRACTICE_LAYOUTS mapping
│   │   └── seeder.py         # Seed loader and database helpers
│   ├── requirements.txt      # Python backend dependencies
│   └── README.md             # Backend setup guide
│
├── frontend/                 # Next.js 14 React frontend web app
│   ├── app/                  # Next.js App Router folders
│   │   ├── tests/[test]/     # Test landing & practice routes
│   │   ├── globals.css       # Core typography, dark mode, split-view styles
│   │   └── layout.tsx        # Global page wrapper
│   ├── components/           # Reusable UI Components
│   │   ├── practice/         # Extracted Practice Page Components
│   │   │   ├── ListeningPractice.tsx
│   │   │   └── ReadingPractice.tsx
│   │   ├── PDFViewer.tsx     # Generic multi-page PDF image scroll card
│   │   └── ResultModal.tsx   # Scoring estimator and band display
│   ├── package.json          # Node dependencies
│   └── README.md             # Frontend setup guide
│
└── phase0/                   # Data extraction pipeline and script assets
    ├── output/               # Extracted test content JSONs and seed manifests
    ├── extract_questions.py  # FitZ PDF text segmentation library
    ├── generate_all_contents.py  # Main text, Writing, & Speaking extraction pipeline
    ├── import_cambridge_11.py# Answer explanations importer
    ├── requirements.txt      # PDF extraction python requirements
    └── README.md             # Data ingestion workflow documentation
```

---

## 🛠️ Getting Started

### 1. Extract Test Data & Assets (Phase 0)

Ensure python dependencies are installed and run the extraction scripts to fetch exam texts, Writing tasks, Speaking questions, and answer seeds:

```bash
# Install PyMuPDF (fitz)
pip install -r phase0/requirements.txt

# Parse the Cambridge 11 PDF to output folder
python phase0/generate_all_contents.py

# Parse the answers explanations PDF to create seed JSON
python phase0/import_cambridge_11.py
```

### 2. Set Up the Backend

The backend runs on **FastAPI** and requires Python 3.10+. It supports **MongoDB** as a database store, falling back to local memory if MongoDB is unavailable.

```bash
# Go to backend
cd backend

# Create & activate python virtual environment
python -m venv .venv
# On Windows PowerShell:
.\.venv\Scripts\Activate.ps1
# On macOS/Linux:
source .venv/Scripts/activate

# Install requirements
pip install -r requirements.txt

# Run dev server on port 8000
uvicorn app.main:app --reload --port 8000
```

#### Seed MongoDB (Optional)
If you have MongoDB running locally (`mongodb://localhost:27017`), seed the DB with test structures:
```bash
python -c "from app import seeder, db; seed = seeder.load_seed(); tcoll = db.tests_collection(); acoll = db.audio_collection(); [tcoll.update_one({'test_number': t['test_number']}, {'$set': t}, upsert=True) for t in seed.get('tests',[])]; [acoll.update_one({'file_name': a['file_name']}, {'$set': a}, upsert=True) for a in seed.get('audio_assets',[])]; print('Database Seeded!')"
```

### 3. Set Up the Frontend

The frontend is a **Next.js** web application.

```bash
# Go to frontend
cd frontend

# Install Node dependencies
npm install

# Start development server on port 3000
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## ⚡ Key Technical Features Implemented

1. **Clean Component Organization**: Extracted massive layout pages into modular UI components (`ListeningPractice`, `ReadingPractice`, `PDFViewer`, `ResultModal`), avoiding code clutter in `app` router files.
2. **Writing & Speaking Extraction ready**: Text structures for Writing Tasks and Speaking Parts are pre-parsed into the backend and automatically delivered to the frontend under `/api/tests/11/{test}/content` for future UI expansions.
3. **Advanced PDF Grid Layouts**: Integrated full 3-column split view (Reading Passage, Questions, Answers) with specialized CSS rule configurations to prevent bottom viewport truncation and support page-level scrolling.
4. **Smart Palette Syncing**: Reading Question Palette links directly to sections and question group tabs, updating PDF views and layouts reactively.
