# IELTS Platform — Project Rules

Monorepo gồm 2 phần chính:
- `backend/` — FastAPI, xem `backend/CLAUDE.md` để biết chi tiết setup, DB fallback, seed command.
- `frontend/` — Next.js, xem `frontend/CLAUDE.md` để biết cấu trúc thư mục, quy tắc render PDF, lệnh build.

## Communication
Khi hoàn thành implementation plan, hãy viết vài dòng tóm tắt bằng tiếng Việt để user biết đang làm gì.

## Mandatory Planning
Trước khi thực hiện bất kỳ thay đổi code nào, AI agent **bắt buộc** phải lập implementation plan chi tiết và chờ người dùng xác nhận (Proceed) trước khi bắt đầu code. Không được phép bỏ qua bước lập plan cho bất kỳ yêu cầu nào, kể cả những yêu cầu đơn giản.

## Database Architecture
Hệ thống lưu trữ dữ liệu đề thi được đặt tên cấu trúc đối xứng (symmetric) và tường minh cho cả IELTS và TOEIC:

**Cambridge IELTS Collections**
- Danh sách đề & kỹ năng: `ielts_tests`
- Đáp án chính thức: `ielts_answers`
- Audio đề thi: `ielts_audio_assets`
- Sách đề / Layout PDF: `ielts_layouts`

**ETS TOEIC Collections**
- Danh sách đề & kỹ năng: `toeic_tests`
- Đáp án chính thức: `toeic_answers`
- Audio đề thi: `toeic_audio_assets`
- Sách đề / Layout PDF: `toeic_layouts`

Khi thêm entity mới (ví dụ 1 kỳ thi khác), giữ đúng pattern 4 collection: `{exam}_tests`, `{exam}_answers`, `{exam}_audio_assets`, `{exam}_layouts`.