# IELTS Practice Platform

An interactive, premium web application for practicing Cambridge IELTS exams. The platform features responsive multi-column layouts, integrated audio streaming, PDF view synchronizations, and an automated answer key correction workflow with detailed explanations.

---

## 📂 Codebase Structure

The project has two parts: the Node.js API (`backend/`) and the Next.js UI (`frontend/`).

```
├── backend/                  # Node.js API (TypeScript, plain node:http)
│   ├── src/
│   │   ├── server.ts         # HTTP server: match route, run guard, call controller, errors -> {detail}
│   │   ├── routes/           # <module>.routes.ts: endpoints of each module (method, path, guard, controller)
│   │   ├── middleware/       # auth / approved guards
│   │   ├── modules/          # auth, tests, practice, attempts, audio, vocabulary, telegram
│   │   │                     #   each: <name>.controllers.ts / .services.ts / .repositories.ts
│   │   ├── shared/           # database (MongoDB), storage (Cloudflare R2), http helpers
│   │   └── data/             # Seed data (layouts, answers, audio assets, vocabulary, r2_keys)
│   ├── api/index.ts          # Vercel entry (vercel.json)
│   ├── scripts/              # npm run seed / seed:tts / telegram:webhook
│   └── tests/                # vitest
│
└── frontend/                 # Next.js 16 UI (Ant Design + MUI, react-hook-form); /api/* is rewritten to the backend
    ├── app/                  # Next.js App Router folders
    │   ├── tests/[test]/     # Test landing & practice routes
    │   ├── globals.css       # Core typography, dark mode, split-view styles
    │   └── layout.tsx        # Global page wrapper
    ├── components/           # Reusable UI Components
    │   ├── practice/         # Extracted Practice Page Components
    │   │   ├── ListeningPractice.tsx
    │   │   └── ReadingPractice.tsx
    │   ├── PDFViewer.tsx     # Generic multi-page PDF image scroll card
    │   └── ResultModal.tsx   # Scoring estimator and band display
    ├── package.json          # Node dependencies
    └── README.md             # Frontend setup guide
```

---

## 🛠️ Getting Started

### 1. Set Up the Backend (API)

Node.js 22.9+, **MongoDB** and **Cloudflare R2** (PDF/audio storage).

```bash
cd backend
npm install
cp .env.example .env            # MONGODB_URI, JWT_SECRET, R2_*, (optional) TELEGRAM_*
npm run seed                    # import layouts, answers, audio assets, vocabulary, users into MongoDB
npm run dev                     # http://localhost:8000/api
```

Other scripts: `npm test`, `npm run typecheck`, `npm run telegram:webhook` (after deploying),
`npm run seed:tts` (one-off: flashcard pronunciation voices for the Telegram bot).

### 2. Set Up the Frontend

```bash
cd frontend
npm install
cp .env.example .env.local      # NEXT_PUBLIC_API_URL (default http://127.0.0.1:8000), JWT_SECRET
npm run dev                     # http://localhost:3000 — /api/* is proxied to the backend
```

---

## ⚡ Key Technical Features Implemented

1. **Clean Component Organization**: Extracted massive layout pages into modular UI components (`ListeningPractice`, `ReadingPractice`, `PDFViewer`, `ResultModal`), avoiding code clutter in `app` router files.
2. **Writing & Speaking Extraction ready**: Text structures for Writing Tasks and Speaking Parts are pre-parsed into the API and automatically delivered to the frontend under `/api/tests/11/{test}/content` for future UI expansions.
3. **Advanced PDF Grid Layouts**: Integrated full 3-column split view (Reading Passage, Questions, Answers) with specialized CSS rule configurations to prevent bottom viewport truncation and support page-level scrolling.
4. **Smart Palette Syncing**: Reading Question Palette links directly to sections and question group tabs, updating PDF views and layouts reactively.
