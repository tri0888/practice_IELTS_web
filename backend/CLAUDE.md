# Backend — FastAPI (IELTS Platform)

Xem quy tắc chung ở `../CLAUDE.md` (communication, planning, DB naming) — luôn áp dụng, kể cả khi chỉ làm việc trong `backend/`.

## Stack & Run
- Python 3.10+
- Dev server: `uvicorn app.main:app --reload --port 8000` (chạy từ `backend/`, sau khi `pip install -r backend/requirements.txt`)
- Service chạy tại `http://localhost:8000`

## Collections
Naming convention theo `../CLAUDE.md` § Database Architecture — dùng đúng tên collection (`ielts_tests`, `ielts_answers`, `ielts_audio_assets`, `ielts_layouts`, và tương đương cho `toeic_*`) khi viết query hoặc seed logic mới.