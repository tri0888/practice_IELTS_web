# Frontend — Next.js (IELTS Platform)

Xem quy tắc chung ở `../CLAUDE.md` (communication, planning, DB naming) — luôn áp dụng, kể cả khi chỉ làm việc trong `frontend/`.

## Stack & Run
- Node.js 18+
- `npm install` rồi `npm run dev`
- App chạy tại `http://localhost:3000`, gọi API tới backend ở `http://localhost:8000`

## Codebase Structure
Dự án được tổ chức để giữ `app/` sạch, chỉ chứa routing:

- **`app/`**: Chỉ chứa routing handlers và container entry points mỏng (ví dụ `tests/[test]/practice/listening/page.tsx`, `tests/[test]/practice/reading/page.tsx`). Không đặt logic hiển thị/nghiệp vụ trực tiếp ở đây.
- **`components/`**: Chứa toàn bộ logic hiển thị có thể tái sử dụng.
  - `components/practice/`: Implementation thực tế cho các view luyện tập (`ListeningPractice.tsx`, `ReadingPractice.tsx`).
  - `components/PDFViewer.tsx`: Component render page scroll view cho các file PDF Cambridge.
  - `components/ResultModal.tsx`: Modal ước tính band score và kết quả chấm điểm.

Khi thêm feature mới, tuân theo pattern này: tạo route mỏng trong `app/`, đặt logic thật trong `components/`.

## PDF Rendering
Frontend **không** sử dụng ảnh (PNG) để hiển thị tài liệu. Phải sử dụng định dạng PDF thực thụ, được cắt lát động (slice) khớp chính xác với danh sách trang cấu hình trong layout map.

## Verification
Sau khi AI agent sửa code xong, **bắt buộc** chạy `npm run build` trong thư mục `frontend/` để kiểm tra lỗi biên dịch trước khi báo hoàn thành.