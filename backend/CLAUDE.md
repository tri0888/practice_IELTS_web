# Backend — FastAPI (IELTS Platform)

Xem quy tắc chung ở `../CLAUDE.md` (communication, planning, DB naming) — luôn áp dụng, kể cả khi chỉ làm việc trong `backend/`.

## Stack & Run
- Python 3.10+
- Dev server: `uvicorn app.main:app --reload --port 8000` (chạy từ `backend/`, sau khi `pip install -r backend/requirements.txt`)
- Service chạy tại `http://localhost:8000`

## MongoDB & Fallback Behavior
- Kết nối qua biến môi trường `MONGODB_URI` (mặc định `mongodb://localhost:27017`).
- **Quan trọng**: nếu MongoDB không chạy hoặc không kết nối được, backend tự động fallback sang **in-memory storage** và load test items trực tiếp từ JSON seed file — không báo lỗi crash.
  - Khi debug các vấn đề kiểu "data không lưu / mất sau khi restart", luôn kiểm tra trước xem có đang chạy ở chế độ fallback này không, trước khi nghi ngờ logic nghiệp vụ.

## Seed Command
Seed database với nội dung Cambridge tests:
```bash
python -c "from backend.app import seeder, db; seed = seeder.load_seed(); tcoll = db.tests_collection(); acoll = db.audio_collection(); [tcoll.update_one({'test_number': t['test_number']}, {'$set': t}, upsert=True) for t in seed.get('tests',[])]; [acoll.update_one({'file_name': a['file_name']}, {'$set': a}, upsert=True) for a in seed.get('audio_assets',[])]; print('Database Seeded!')"
```

## Collections
Naming convention theo `../CLAUDE.md` § Database Architecture — dùng đúng tên collection (`ielts_tests`, `ielts_answers`, `ielts_audio_assets`, `ielts_layouts`, và tương đương cho `toeic_*`) khi viết query hoặc seed logic mới.