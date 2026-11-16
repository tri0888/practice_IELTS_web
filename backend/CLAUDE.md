# Backend — Node.js API (IELTS Platform)

Xem quy tắc chung ở `../CLAUDE.md` (communication, planning, DB naming). Các quy tắc đó luôn áp dụng, kể cả khi chỉ làm việc trong `backend/`.

Service API độc lập (thay cho FastAPI cũ), viết bằng **Hono** + TypeScript, chạy trên Node.js 20.19+. Frontend gọi `/api/*`, và Next.js rewrite các request đó sang service này.

## Run
- `npm install`, chép `.env.example` thành `.env.local` rồi điền giá trị.
- `npm run dev`: server local tại `http://localhost:8000/api` (đổi port bằng `PORT`).
- `npm run seed`: import dữ liệu từ `src/data/*.json` vào MongoDB (upsert, chạy lại an toàn). `--delete` thì xoá trước khi import. `-- --claim-histories <email>` gán lịch sử cũ chưa có `user_id` cho một tài khoản.
- `npm run telegram:webhook`: đăng ký webhook bot sau khi deploy. `npm run seed:tts`: sinh voice phát âm cho flashcard, chỉ chạy ở máy local.

## Cấu trúc
- `src/app.ts`: app Hono, mount các router và auth guard theo prefix.
- `src/modules/<name>/`: mỗi module có `routes.ts` (giống controller) và `services.ts` (logic). Các module: auth, tests, practice, attempts, audio, vocabulary, telegram.
- Hạ tầng chung:
  - `src/db.ts`: MongoDB, cache kết nối cho serverless.
  - `src/r2.ts`: Cloudflare R2.
  - `src/http.ts`: lỗi dạng `{detail}` giống FastAPI, parse tham số.
  - `src/env.ts`: nạp `.env.local`/`.env` khi chạy local.
- `src/dev.ts`: server local (`@hono/node-server`). `api/index.ts` + `vercel.json`: entry khi deploy Vercel (Node runtime, `maxDuration` 60s).
- `scripts/`: các script CLI. `tests/`: vitest.

## Quy tắc
- **Giữ nguyên đường dẫn và dạng response của API**: frontend đọc `data.detail` khi có lỗi.
- Auth guard (`requireApproved`) chỉ áp theo prefix trong `src/app.ts`, không áp lại trong từng router.
- Thứ tự đăng ký route quan trọng (match đầu tiên thắng): practice routes phải đứng trước route generic `/tests/:book/:test/:skill`.
- Collection theo convention ở `../CLAUDE.md` § Database Architecture. Tên collection tập trung ở `COLLECTIONS` trong `src/db.ts`.
- `histories` lưu cả bài nháp (TTL 24h) và **luôn lọc theo user đang đăng nhập**.
- **Không stream file qua API** (Vercel giới hạn response khoảng 4,5 MB): dùng `fileResponse()` để redirect 302 sang presigned URL của R2. PDF cắt trang được cache trong R2 ở `_cache/pdf-slices/`. Key R2 không có tiền tố `Books/` (dùng `normalizeKey`).
- Bot Telegram (grammY) nhận update qua webhook `/api/telegram/webhook`. Trạng thái hội thoại lưu ở `telegram_sessions`, vì serverless không giữ RAM giữa các request.
- Backend là package CommonJS (cần cho các lệnh import file `.json` khi chạy trên Vercel), nên không dùng top-level await trong `src/`.

## Verification
Sau khi sửa code, **bắt buộc** chạy `npm run typecheck` và `npm test` trong `backend/`. Logic chấm điểm được khoá bằng characterization test (`tests/grading.test.ts`); khi sửa chấm điểm thì không được làm thay đổi kết quả của các test này.
