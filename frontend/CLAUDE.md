# Frontend — Next.js (IELTS Platform)

Xem quy tắc chung ở `../CLAUDE.md` (communication, planning, DB naming) — luôn áp dụng, kể cả khi chỉ làm việc trong `frontend/`.

## Stack & Run
- Node.js 20+
- `npm install`, chép `.env.example` thành `.env.local`, sau đó `npm run dev`
- App chạy tại `http://localhost:3000`. Mọi request `/api/*` được rewrite (`next.config.js`) sang backend tại `NEXT_PUBLIC_API_URL` (mặc định `http://127.0.0.1:8000`, tức `npm run dev` trong `../backend`). Rewrite được tính lúc build.
- Frontend không chứa code server. API, DB, R2, bot Telegram đều nằm ở `../backend` (xem `../backend/CLAUDE.md`).

## Codebase Structure
Dự án được tổ chức để giữ `app/` sạch, chỉ chứa routing:

- **`app/`**: Chỉ chứa routing handlers và container entry points mỏng (ví dụ `tests/[test]/practice/listening/page.tsx`, `tests/[test]/practice/reading/page.tsx`). Không đặt logic hiển thị/nghiệp vụ trực tiếp ở đây.
- **`components/`**: Chứa toàn bộ logic hiển thị có thể tái sử dụng.
  - `components/practice/`: Implementation thực tế cho các view luyện tập (`ListeningPractice.tsx`, `ReadingPractice.tsx`).
  - `components/PDFViewer.tsx`: Component render page scroll view cho các file PDF Cambridge.
  - `components/ResultModal.tsx`: Modal ước tính band score và kết quả chấm điểm.

Khi thêm feature mới, tuân theo pattern này: tạo route mỏng trong `app/`, đặt logic thật trong `components/`.

## UI Stack
- **Ant Design** là thư viện component chính (Button, Input, Form, Modal, Tabs, Table, Tag, Alert...).
- **MUI** là phụ: chủ yếu icon (`@mui/icons-material`) và component AntD không có. Không dùng `CssBaseline`.
- Cả hai được bọc trong `components/Providers/UIProvider.tsx`, dùng chung dark mode (`<html data-theme>` + `localStorage('theme')`). Đổi theme qua hook `useThemeMode()`.
- **Form dùng react-hook-form**: field AntD bọc trong `Controller` (hoặc `components/form/RHFField.tsx`). Bảng đáp án của các trang luyện tập dùng `lib/useAnswerForm.ts`.
- Thông báo dùng `App.useApp().message`/`Popconfirm` của AntD, không dùng `alert()`/`confirm()`.

## Route Guard (proxy.ts)
- `proxy.ts` (Next 16, trước đây là middleware) chặn việc tự gõ URL: chưa đăng nhập thì về `/login?next=`, tài khoản pending thì về `/pending`, số sách/đề không hợp lệ thì về `/tests`. Luật nằm trong `lib/routeGuard.ts` (có test ở `tests/routeGuard.test.ts`). Thêm route mới thì phải cập nhật `isKnownAppPath`.
- Proxy đọc cookie `practice_hub_token`/`practice_hub_role` do `AuthProvider` ghi. Đặt `JWT_SECRET` (cùng giá trị với backend) cho frontend để proxy verify chữ ký; nếu thiếu thì proxy chỉ decode token và kiểm tra hạn dùng.
- Proxy chỉ là lớp chặn điều hướng; API vẫn tự xác thực mọi request `/api` (proxy không chạy cho `/api/*`).

## PDF Rendering
Frontend **không** sử dụng ảnh (PNG) để hiển thị tài liệu. Phải sử dụng định dạng PDF thực thụ, được cắt lát động (slice) khớp chính xác với danh sách trang cấu hình trong layout map.

## Verification
Sau khi AI agent sửa code xong, **bắt buộc** chạy `npm test` và `npm run build` trong thư mục `frontend/` để kiểm tra trước khi báo hoàn thành. Nếu có sửa `backend/` thì chạy thêm `npm run typecheck` và `npm test` ở đó.