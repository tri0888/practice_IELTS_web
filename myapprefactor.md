# myapprefactor.md — Nguồn thông tin chính xác cho đợt Refactoring

> **Đây là source of truth của toàn bộ đợt refactor.** Mọi thay đổi cấu trúc phải được phản ánh ở đây.
> Cập nhật checklist + "Nhật ký quyết định" ở cuối **mỗi milestone**. Đọc file này trước khi bắt đầu bất kỳ milestone nào.

- **Repo:** `practice_IELTS_web` (monorepo: `backend/` FastAPI + `frontend/` Next.js)
- **Ngày khởi tạo:** 2026-07-02
- **Trạng thái hiện tại:** ✅ M1 **hoàn thành** — backend cleanup (pytest **34 passed**). Chờ duyệt để bắt đầu **M2** (frontend lib dùng chung).

---

## 1. Mục tiêu & Nguyên tắc

Refactor để giảm nợ kỹ thuật **mà không đổi hành vi người dùng**. Ba nguyên tắc bắt buộc:

- **KISS** — Ưu tiên giải pháp đơn giản nhất chạy được. Route mỏng, hàm một việc, tránh trừu tượng hoá thừa.
- **YAGNI** — Xoá dead code, không thêm khả năng "phòng khi cần". Chỉ trừu tượng khi đã có ≥2 chỗ dùng thật.
- **SOLID** — Trọng tâm **SRP** (mỗi module/hàm một trách nhiệm) và **DIP/OCP** cho việc phân nhánh loại đề (IELTS vs TOEIC).

**Ràng buộc quy trình (theo `CLAUDE.md`):** mỗi milestone phải có plan → chờ user duyệt (Proceed) → code → chạy test xanh → cập nhật file này → xin duyệt milestone kế tiếp.

---

## 2. Bản đồ kiến trúc (hiện trạng)

### Backend — FastAPI (`backend/app`, ~3.600 dòng)
Mẫu module (tốt, giữ nguyên): mỗi module trong `app/modules/<name>/` gồm `controller.py` (router) + `services.py` (logic) + `__init__.py` (export `router`).

| Module | Vai trò |
|---|---|
| `auth` | Đăng ký/đăng nhập JWT, `middleware.py` (`require_auth`, `require_approved`) |
| `tests` | Liệt kê đề, resolve đường dẫn PDF (Cambridge + ETS), audio, đáp án ETS |
| `practice` | Layout luyện tập, cắt/ghép trang PDF theo `part_key` |
| `attempts` | Tạo/nộp bài, **chấm điểm**, lịch sử (histories) |
| `audio`, `r2_client`, `vocabulary`, `telegram` | Audio, Cloudflare R2, từ vựng, bot Telegram |
| `models/database.py` | Kết nối Mongo + **fallback** graceful (trả `None` khi không có DB) |
| `models/schemas.py` | Chỉ 2 model Pydantic (`AttemptCreate`, `AttemptSubmit`) — phần lớn endpoint trả dict thô |

### Frontend — Next.js 16 App Router (`frontend`, ~6.900 dòng app+components)
- `app/` — route + trang. **Đang chứa quá nhiều logic** (vi phạm `frontend/CLAUDE.md`).
- `components/` — `PDFViewer`, `ResultModal`, `AppLayout`, `AuthProvider` (patch `fetch` để gắn Bearer token + `getAuthUrl`).
- **Chưa có** `lib/`, `hooks/`, `types/`.
- Data fetching: `swr` dùng ở trang danh sách (`Home`, `history`, `tests`, `vocabulary`); trang practice dùng `fetch` thô.
- `/api/*` được Next rewrite sang backend (`next.config.js`).

---

## 3. Tooling & cách chạy test

| | Lệnh | Ghi chú |
|---|---|---|
| Backend dev | `uvicorn app.main:app --reload --port 8000` (từ `backend/`) | |
| Backend test | `python -m pytest` (từ `backend/`) | Dùng interpreter trong `.venv`. Deps test: `backend/requirements-dev.txt` |
| Frontend dev | `npm run dev` (từ `frontend/`) | |
| Frontend build | `npm run build` (**bắt buộc** trước khi báo done — theo CLAUDE.md) | |
| Frontend test | `npm test` (từ `frontend/`) | Vitest. Test grading thật sẽ có ở M2 |

---

## 4. Danh mục "code smell" (bằng chứng đã kiểm chứng)

### Backend
| # | Vấn đề | Vị trí | Nguyên tắc |
|---|---|---|---|
| B1 | **Dead code**: sinh PNG không nơi nào gọi | `practice/services.py` `get_pdf_page_bytes`, `get_pdf_part_bytes` | YAGNI |
| B2 | Import thừa `load_all_layouts` | `app/main.py:4` | YAGNI |
| B3 | **Trùng ~40 dòng** logic `part_key → pages` | `practice/services.py` giữa `get_pdf_part_bytes` & `get_pdf_part_file` | DRY |
| B4 | Magic number `book >= 2000` (= "là TOEIC") lặp 5 lần | `practice/services.py` (58, 67, 102, 277, 305) | KISS/OCP |
| B5 | Logic **chấm điểm** trộn lẫn phần lưu trữ attempt | `attempts/services.py` (`check_user_answer`, `expand_*`, …) | SRP |
| B6 | `print()` thay logging; `@app.on_event` (deprecated); CORS `*` + credentials | `main.py`, `telegram/bot.py` | (chất lượng) |

### Frontend
| # | Vấn đề | Vị trí | Nguyên tắc |
|---|---|---|---|
| F1 | **Logic chấm điểm chép 3 lần**: reading + listening page (và trùng backend) | `.../practice/reading/page.tsx:582-687`, `.../practice/listening/page.tsx:469+` | DRY |
| F2 | `estimateBand`, `parseQuestionGroups`, `formatTime` lặp giữa các trang | reading/listening | DRY |
| F3 | `const BACKEND='/api'` lặp ở 7 file; không có API client chung | 7 file | DRY |
| F4 | **Fat pages**: logic nghiệp vụ nhét trong route | `vocabulary/page.tsx` (1.828 dòng), `tests/page.tsx` (762), practice pages (300–686) | KISS/SRP + vi phạm CLAUDE.md |
| F5 | **Doc drift**: `frontend/CLAUDE.md` nhắc `components/practice/ListeningPractice.tsx` — **không tồn tại** | `frontend/CLAUDE.md:15` | (chính xác hoá) |
| F6 | `any` khắp nơi (`result`, `practiceLayout`, `answerKey`) — thiếu type response | các trang practice | (type safety) |
| F7 | Hardcoded fallback page maps | reading page (`241-276`) | YAGNI |

---

## 5. Kế hoạch Milestone

> Mỗi milestone **không đổi hành vi**; test viết/chạy trước & sau. Ký hiệu: `[ ]` chưa làm · `[~]` đang làm · `[x]` xong.

### M0 — Tài liệu + Lưới an toàn test  `[x]`
- [x] Tạo `myapprefactor.md` (file này)
- [x] Backend: `requirements-dev.txt` (pytest) + `pytest.ini` + `backend/tests/` — 12 characterization test grading + 2 smoke endpoint (`test_grading_characterization.py`, `test_app_smoke.py`) → **20 passed**
- [x] Frontend: `vitest.config.ts` + script `npm test` + `tests/smoke.test.ts` → **1 passed**
- [x] Chốt baseline: test xanh, **chưa refactor gì**

### M1 — Backend cleanup (YAGNI + SRP)  `[x]`
- [x] Xoá B1 (`get_pdf_page_bytes`, `get_pdf_part_bytes` — PNG dead code) + B2 (import thừa `load_all_layouts` ở `main.py`)
- [x] B3: tách `resolve_part_pages(layout, part_key)` trong `practice/services.py` (dùng ở `get_pdf_part_file`)
- [x] B4: thêm `is_toeic(book)` — thay cả 5 chỗ `book >= 2000`
- [x] B5: tách `attempts/grading.py` (SRP); `services.py` re-export để giữ public surface
- [x] Thêm test mới `test_practice_helpers.py` (is_toeic + resolve_part_pages) → **pytest 34 passed** (20 characterization vẫn xanh ⇒ hành vi không đổi)

### M2 — Frontend lib dùng chung (DRY)  `[ ]`
- [ ] `lib/grading.ts` (nguồn duy nhất) + `lib/band.ts`, `lib/format.ts`, `lib/questions.ts`
- [ ] `lib/api.ts` (base `/api` + token) thay các `const BACKEND`
- [ ] `types/` cho response API — giảm `any`
- [ ] Reading/Listening/TOEIC dùng lib chung; xoá bản chép
- [ ] Vitest cho `grading.ts` (port từ characterization backend)

### M3 — Làm mỏng route (KISS + đúng CLAUDE.md)  `[ ]`
- [ ] `components/practice/{Reading,Listening,Writing,Speaking}Practice.tsx` + hooks (`usePracticeAttempt`, `useCountdown`)
- [ ] Tách `vocabulary/page.tsx` & `tests/page.tsx` thành component + hook
- [ ] Cập nhật `frontend/CLAUDE.md` cho khớp thực tế (sửa F5)

### M4 — Nhất quán API & dọn cuối  `[ ]`
- [ ] Thống nhất data fetching (swr/client); bỏ fallback map (F7)
- [ ] Pydantic response models cho endpoint chính (F6/B)
- [ ] `lifespan` thay `@app.on_event`; logging thay `print`; siết CORS (B6)
- [ ] Full: pytest + vitest + `npm run build` xanh

---

## 6. Quy ước
- **Backend module**: giữ pattern `controller.py` + `services.py` + `__init__.py (export router)`.
- **Frontend**: `app/` chỉ route mỏng → logic ở `components/` + `hooks/` + `lib/` (theo `frontend/CLAUDE.md`).
- **Collections**: theo `CLAUDE.md` §Database — `{exam}_tests|answers|audio_assets|layouts`.
- **Test**: đặt cạnh vùng refactor; characterization test khoá **hành vi hiện tại** (kể cả quirk), không phải hành vi "đúng lý tưởng".

## 7. Hành vi đã khoá (quirks quan trọng — đừng vô tình "sửa")
- `check_user_answer('main reason', 'the (main) reason') == False` — mở ngoặc **giữ nguyên prefix**, chỉ sinh `'the reason'` & `'the main reason'`.
- Đáp án dạng `A-B-C` (có gạch nối): chấp nhận **từ đầu tiên** trước dấu gạch (`'twenty' == 'twenty-five'` → đúng).
- `get_correct_answer_for_question` hỗ trợ key dạng dải `'14-26'` (trả đáp án cho mọi q trong dải).
- So khớp: chuẩn hoá khoảng trắng + bỏ dấu câu 2 đầu + lowercase; `/` (có/không khoảng trắng) và `( )` sinh biến thể.

---

## 8. Nhật ký quyết định (Decision Log)
| Ngày | Milestone | Quyết định |
|---|---|---|
| 2026-07-02 | M0 | Test deps tách sang `requirements-dev.txt` (giữ prod deps sạch — KISS). `httpx` đã có sẵn trong `.venv`. |
| 2026-07-02 | M0 | Ưu tiên characterization test cho **grading** (thuần, tất định) vì đây là vùng bị đụng nhiều nhất ở M1/M2. |
| 2026-07-02 | M1 | `attempts/services.py` **re-export** các hàm grading từ `grading.py` (không xoá tên cũ) — giữ backward-compat, để characterization test làm bằng chứng "không đổi hành vi". |
| 2026-07-02 | M1 | Xoá luôn PNG stitching (`get_pdf_part_bytes`) — frontend chỉ dùng PDF thật (đúng quy tắc "không dùng ảnh" trong `frontend/CLAUDE.md`), nên đây là dead code an toàn để xoá. |
| 2026-11-14 | R2/Vercel | File PDF/audio không stream qua backend nữa mà redirect 302 sang presigned URL của R2, vì Vercel giới hạn response khoảng 4,5 MB (PDF sách khoảng 56 MB). PDF cắt trang được lưu cache vào R2 (`_cache/pdf-slices/`). Key R2 luôn bỏ tiền tố `Books/` (sửa lỗi audio TOEIC luôn 404). Cache PDF trong RAM giới hạn còn 2 file. |
| 2026-11-14 | UI | Ant Design là UI chính, MUI phụ (icon). Form dùng react-hook-form (`RHFField`, `useAnswerForm`). Thêm `proxy.ts` (Next 16) chặn việc tự gõ URL dựa trên cookie auth do `AuthProvider` ghi; luật nằm trong `lib/routeGuard.ts`. Không chuyển backend sang Node (user quyết định để sau). |
| 2026-11-15 | Node backend | Port toàn bộ FastAPI sang Node.js: Hono mount trong Next.js (`app/api/[[...route]]`, `frontend/server/`), dùng mongodb, bcryptjs (tương thích hash `$2b$` cũ), jose (token cũ vẫn hợp lệ), pdf-lib (thay PyMuPDF), AWS SDK v3 (R2), grammY (bot Telegram, session lưu Mongo). Giữ nguyên API. Đã xoá thư mục `backend/`. |
| 2026-11-15 | Node backend | Sửa lỗi khi port: (1) bài nháp lưu MongoDB (TTL 24h) thay vì RAM, vì serverless; (2) lịch sử làm bài lọc/xoá theo user; (3) bỏ việc reset mật khẩu admin mỗi lần khởi động; `npm run seed` không flag thì không còn xoá dữ liệu. Bỏ Cloudflare tunnel và chế độ đọc file local `Books/` (chỉ dùng R2). Đã kiểm chứng: 89 unit test, 45 check e2e trên build production (Mongo tạm + R2 thật), chấm điểm khớp 100% với bản Python trên cùng dữ liệu, 23 kịch bản bot Telegram. |
| 2026-11-16 | Node backend | Tách API khỏi Next.js thành service riêng ở `backend/` (theo yêu cầu user): Hono + `@hono/node-server` khi chạy local (port 8000), `api/index.ts` + `vercel.json` khi deploy Vercel; package CommonJS để `@vercel/node` chạy được các lệnh import JSON. `frontend/` chỉ còn UI, khôi phục rewrites `/api/*` sang `NEXT_PUBLIC_API_URL`. Không đổi logic hay API. Đã kiểm chứng: backend 65 test, frontend 24 test, 45/45 check e2e qua rewrite thật. |
