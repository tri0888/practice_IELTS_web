# Backend — Node.js API (IELTS Platform)

Xem quy tắc chung ở `../CLAUDE.md` (communication, planning, DB naming). Các quy tắc đó luôn áp dụng, kể cả khi chỉ làm việc trong `backend/`.

Service API viết bằng TypeScript thuần trên Node.js 22.9+, dùng `node:http` có sẵn, không dùng framework web. Frontend gọi `/api/*` và Next.js rewrite các request đó sang service này.

## Run
- `npm install`, chép `.env.example` thành `.env` (hoặc `.env.local`) rồi điền giá trị. Các lệnh npm tự nạp file env bằng flag `--env-file-if-exists` của Node.
- `npm run dev`: server local tại `http://localhost:8000/api` (đổi port bằng `PORT`).
- `npm run seed`: import dữ liệu từ `src/data/*.json` vào MongoDB (upsert, chạy lại an toàn). `--delete` thì xoá trước khi import. `-- --claim-histories <email>` gán các lịch sử chưa có `user_id` cho một tài khoản.
- `npm run telegram:webhook`: đăng ký webhook bot sau khi deploy (`TELEGRAM_WEBHOOK_URL` + `/api/telegram/webhook`, kèm `TELEGRAM_WEBHOOK_SECRET` nếu có). `-- --info` xem webhook hiện tại, `-- --delete` gỡ webhook.
- `npm run seed:tts`: sinh voice phát âm cho flashcard, chạy **một lần cho mỗi bot**, chỉ ở máy local. Luồng: Edge-TTS (MP3) → ffmpeg (OGG/Opus) → `sendVoice` tới `SEED_CHAT_ID` (id Telegram của bạn, phải `/start` bot trước) → lưu `file_id` vào `flashcard_audio`. Chạy tiếp được nếu bị ngắt giữa chừng. `-- --limit 5` thử vài từ, `-- --delay 1.5` giãn thời gian giữa các lần gửi. Bot chỉ gửi lại `file_id` đã lưu, nên production không cần TTS hay ffmpeg.

## Cấu trúc
- `src/server.ts`:
  - Ghép các mảng routes theo thứ tự ưu tiên.
  - `dispatch({ method, url, headers, body })` là lõi xử lý: bỏ tiền tố `/api`, tìm route khớp đầu tiên, chạy guard, gọi controller, biến lỗi thành `{detail}`, và log `No route` khi không khớp.
  - `handleRequest(req, res)` là adapter `node:http`, dùng cho local, test và Vercel.
  - Chỉ `listen` khi file được chạy trực tiếp.
- **Deploy Vercel:** Vercel tự nhận `src/server.ts` làm entry (chế độ Node server) và gọi `export default` (phải là hàm `(req, res)`). Có hai điều cấm:
  - **Không được bỏ `export default handleRequest`**. Nếu bỏ, mọi request crash với lỗi `Invalid export… The default export must be a function or server`.
  - **Không thêm `rewrites` vào `vercel.json`**. Rewrite đổi `req.url` thành đích của nó (ví dụ `/api`), làm mọi GET ra trang health và mọi POST báo Not Found.
  - Không có thư mục `api/`. Giới hạn thời gian chạy (Max Duration) chỉnh ở *Vercel → Settings → Functions*.
- `src/routes/<module>.routes.ts`: mỗi module một file routes, tất cả để chung trong thư mục `src/routes/`. Gồm `auth`, `practice`, `tests`, `attempts` (`/histories`), `audio`, `vocabulary`, `telegram`, và `health` (`/r2/status`, `/`). Mỗi file export một mảng `Route[]`, mỗi phần tử có `{ method, path, guard?, handler }`. Path dùng `:name` cho một đoạn, `:name*` cho cả phần đuôi còn lại (ví dụ `/audio/:file_name*`).
- `src/middleware/middleware.ts`: guard `auth` (đọc token từ `?token=` hoặc `Authorization: Bearer`) và guard `approved`.
- `src/modules/<name>/`: mỗi module có đúng 3 file:
  - `<name>.controllers.ts`: giao tiếp FE ↔ BE. Đọc params/query/body từ `ApiRequest`, gọi service, trả kết quả. Không chứa URL.
  - `<name>.services.ts`: logic, xử lý data. Không gọi MongoDB trực tiếp.
  - `<name>.repositories.ts`: giao tiếp BE ↔ database. Mọi truy vấn MongoDB, kể cả đọc file JSON dự phòng trong `src/data/`.
  - Các module: auth, tests, practice, attempts, audio, vocabulary, telegram. Với telegram, chat Telegram được coi là "frontend": `telegram.controllers.ts` chứa webhook, tạo bot grammY và mọi handler lệnh/nút.
- `src/shared/`: hạ tầng dùng chung, mỏng, không chứa nghiệp vụ:
  - `database.ts`: một MongoClient cho cả process (cache cho serverless), kèm `COLLECTIONS`.
  - `storage.ts`: Cloudflare R2 (presigned redirect, cache PDF slice).
  - `http.ts`: `HttpError`, kiểu `ApiRequest`/`Route`/`Reply`, `json()`/`text()`/`redirect()`, các hàm parse (`intParam`, `intQuery`, `jsonBody`, `requireString`).
- `scripts/`: các script CLI. `tests/`: vitest.

## Quy tắc
- **Giữ nguyên đường dẫn và dạng response của API**: frontend đọc `data.detail` (chuỗi) khi có lỗi. Lỗi 422 có dạng `"<field>: <message>"`.
- Ném lỗi bằng `httpError(status, message)` ở bất kỳ tầng nào; `server.ts` sẽ trả `{detail}`. Controller trả object thường thì thành JSON 200; cần mã khác thì dùng `json(data, status)` hoặc `redirect(url)`.
- **Không viết comment trong code.** Kiến thức cần ghi lại thì đưa vào file này.
- Guard khai báo trên từng route trong `src/routes/*.routes.ts` (`guard: 'auth' | 'approved'`), không kiểm tra lại trong controller.
- Thứ tự route quan trọng (match đầu tiên thắng): trong `server.ts`, `practiceRoutes` phải đứng trước `testsRoutes` (vì route generic `/tests/:book/:test/:skill`). Trong `tests.routes.ts`, route ETS `/tests/toeic/...` phải đứng trước `/tests/:book/...`.
- Lỗi 401 khi token hết hạn có `detail` là `'Authentication token expired'`; token sai hoặc không tìm thấy user thì `'Invalid authentication token'`.
- Thời gian lưu DB dùng `nowIso()`: chuỗi ISO **không có `Z`**, đúng định dạng dữ liệu đang có (sắp xếp `histories` theo `started_at` dựa vào đó).
- Webhook Telegram trả lời trong tối đa 50s (`WEBHOOK_TIMEOUT_MS`), nên Max Duration của Vercel phải ≥ 60s, để Telegram không gửi lại update mãi.
- Module gọi chéo nhau qua **services** (ví dụ attempts gọi `practice.services`), không gọi repositories của module khác.
- Collection theo convention ở `../CLAUDE.md` § Database Architecture. Tên collection tập trung ở `COLLECTIONS` trong `src/shared/database.ts`.
- `histories` lưu cả bài nháp (TTL 24h) và **luôn lọc theo user đang đăng nhập**.
- **Không stream file qua API** (Vercel giới hạn response khoảng 4,5 MB): dùng `fileResponse()` để redirect 302 sang presigned URL của R2. PDF cắt trang được cache trong R2 ở `_cache/pdf-slices/` (không đổi công thức `sliceCacheKey`). Key R2 không có tiền tố `Books/` (dùng `normalizeKey`).
- Auth dùng `jsonwebtoken` (HS256, hạn 7 ngày) và `bcryptjs`. `JWT_SECRET` phải giống với frontend (`proxy.ts`).
- Bot Telegram (grammY) nhận update qua webhook `/api/telegram/webhook`, kiểm tra header secret, rồi gọi `bot.handleUpdate`. Trạng thái hội thoại lưu ở `telegram_sessions`, vì serverless không giữ RAM giữa các request.
- Backend là package CommonJS (cần cho các lệnh import file `.json` khi chạy trên Vercel), nên không dùng top-level await trong `src/`.

## Verification
Sau khi sửa code, **bắt buộc** chạy `npm run typecheck` và `npm test` trong `backend/`. Logic chấm điểm (trong `attempts.services.ts`) được khoá bằng characterization test (`tests/grading.test.ts`), giữ nguyên cả các điểm "lạ". Ví dụ:
- `'main reason'` **không** khớp `'the (main) reason'`.
- Chữ đầu trước dấu gạch nối được chấp nhận: `'twenty'` khớp `'twenty-five'`.

Khi sửa chấm điểm thì không được làm thay đổi kết quả của các test này.
