**PRODUCT REQUIREMENTS DOCUMENT**

**Cambridge IELTS Practice Platform**

Books 1 -- 20 • Full 4 Skills • Web Application

*Phần mềm dò tầm IELTS toàn diện*

|                 |                 |
|----------------:|-----------------|
|    **Version:** | 1.0.0           |
|       **Ngày:** | Tháng 6, 2026   |
| **Trạng thái:** | Draft -- nội bộ |

**1. Tổng Quan Dự Án**

**1.1 Mô tả sản phẩm**

Cambridge IELTS Practice Platform là một web application cho phép người dùng luyện thi IELTS toàn diện với toàn bộ nội dung từ sách Cambridge IELTS 1--20, bao gồm đầy đủ 4 kỹ năng: Listening, Reading, Writing và Speaking. Hệ thống tái hiện môi trường thi thực tế, chấm điểm tự động và theo dõi tiến trình học của từng người dùng.

**1.2 Mục tiêu**

- Cung cấp đầy đủ 80 full tests (20 cuốn × 4 tests) với nội dung chính xác theo sách gốc

- Hỗ trợ luyện tập cả 4 kỹ năng trong cùng một nền tảng

- Chấm điểm tự động Listening và Reading theo thang điểm IELTS Band 0--9

- Hỗ trợ Writing và Speaking bằng AI feedback (giai đoạn 2)

- Theo dõi tiến trình và phân tích điểm yếu của từng cá nhân

**1.3 Phạm vi (Scope)**

|  |  |
|:--:|:--:|
| **IN SCOPE** | **OUT OF SCOPE** |
| Cambridge IELTS Books 1--20 | Cambridge IELTS 1--20 Authentic Practice Tests (dòng khác) |
| Academic và General Training | IELTS Life Skills, OET, TOEIC |
| 4 kỹ năng đầy đủ | App mobile nững (native iOS/Android) |
| Chấm tự động Listening & Reading | Thanh toán / mô hình premium (giai đoạn 1) |
| AI feedback Writing & Speaking (Phase 2) | Offline mode |

**2. Các Bên Liên Quan**

**2.1 Người dùng mục tiêu**

|  |  |  |
|:--:|:--:|:--:|
| **Nhóm** | **Mô tả** | **Nhu cầu chính** |
| Học viên IELTS | Chuẩn bị thi lần đầu hoặc luyện nâng cao | Full test thực chiến, biết điểm ngay |
| Giáo viên IELTS | Dạy lệch, giao bài tập | Giao test cho học viên, xem kết quả |
| Tự học tự do | Luyện theo kỹ năng yếu | Chọn từng skill, theo dõi điểm mạnh/yếu |

**3. Yêu Cầu Chức Năng**

**3.1 Quản lý tài khoản**

- FR-01: Đăng ký bằng email/mật khẩu hoặc OAuth (Google)

- FR-02: Đăng nhập, đăng xuất, quản lý phiên (JWT + Refresh Token)

- FR-03: Xác thực email, đặt lại mật khẩu

- FR-04: Trang profile: ảnh đại diện, thông tin cá nhân, lịch sử thi

- FR-05: Vai trò người dùng: Student / Teacher / Admin

**3.2 Thư viện đề thi (Test Library)**

- FR-06: Liệt kê toàn bộ 80 tests theo book (1--20), mỗi book 4 tests

- FR-07: Lọc theo: book number, skill, loại (Academic/General), đã làm/chưa

- FR-08: Trang chi tiết test: tiêu đề, thời gian, số câu, điểm lần cuối

- FR-09: Chọn luyện tập 1 skill riêng lẻ hoặc full 4 skills

**3.3 Listening**

- FR-10: Phát audio MP3 với thanh tiến trình, nút play/pause/seek

- FR-11: Hiển thị đồng hồ đếm ngược (30 phút)

- FR-12: Hỗ trợ đầy đủ loại câu hỏi: MCQ, gap-fill, matching, labelling, map/diagram completion

- FR-13: Nội dung câu hỏi hiển thị theo Part (1--4)

- FR-14: Sau khi nộp: hiển thị đáp án đúng, so sánh với đáp án thí sinh, band score tương ường

**3.4 Reading**

- FR-15: Hiển thị passage và câu hỏi 2 cột (split view)

- FR-16: Hỗ trợ highlight văn bản trong passage

- FR-17: Đồng hồ 60 phút, phân chia theo Passage 1/2/3

- FR-18: Hỗ trợ các loại câu hỏi: True/False/Not Given, Yes/No/NG, matching headings, matching information, sentence completion, summary completion, short answer

- FR-19: Sau khi nộp: đáp án, giải thích, band score

**3.5 Writing**

- FR-20: Giao diện editor Task 1 và Task 2 riêng biệt

- FR-21: Đếm từ real-time (Task 1: tối thiểu 150, Task 2: tối thiểu 250)

- FR-22: Hiển thị đề bài, hình ảnh biểu đồ (Task 1)

- FR-23: Đồng hồ 60 phút

- FR-24: Lưu bài viết để xem lại sau

- FR-25 (Phase 2): AI chấm điểm theo 4 tiêu chí (Task Achievement, Coherence, Lexical Resource, Grammatical Range)

**3.6 Speaking**

- FR-26: Hiển thị topic card Part 1/2/3

- FR-27: Đồng hồ thèo từng part (Part 1: 4--5 phút, Part 2: 3--4 phút, Part 3: 4--5 phút)

- FR-28: Ghi âm trước trá lời (Web Audio API / MediaRecorder)

- FR-29: Xem lại bản ghi âm sau buổi thi

- FR-30 (Phase 2): AI phân tích ngữ âm, nội dung, ngữ pháp

**3.7 Kết quả và phân tích**

- FR-31: Trang kết quả ngay sau khi nộp: tổng điểm, band score, phân tích từng phần

- FR-32: Lịch sử tất cả các lần làm bài, so sánh theo thời gian

- FR-33: Biểu đồ tiến trình (band score theo tháng)

- FR-34: Danh sách câu hỏi sai để ôn tập lại

- FR-35: Thống kê độ chính xác theo loại câu hỏi (gap-fill, MCQ, T/F/NG,...)

**3.8 Admin Panel**

- FR-36: Quản lý người dùng: xem, khóa, phan quyền

- FR-37: Quản lý nội dung: thêm/sửa/xóa câu hỏi, đáp án, audio

- FR-38: Thống kê tổng: lượt thi, người dùng mới, test phổ biến

- FR-39: Import dữ liệu từ JSON (đầu ra của data pipeline)

**4. Yêu Cầu Phi Chức Năng**

**4.1 Hiệu năng (Performance)**

|                               |              |                   |
|:-----------------------------:|:------------:|:-----------------:|
|          **Chỉ số**           | **Mục tiêu** | **Ngưỡng tối đa** |
|   Time to First Byte (TTFB)   |   \< 200ms   |     \< 500ms      |
| First Contentful Paint (FCP)  |   \< 1.2s    |       \< 2s       |
|    Audio start (buffering)    |    \< 1s     |       \< 3s       |
| API response (submit answers) |   \< 300ms   |       \< 1s       |
|       Concurrent users        |  500 users   |    1000 users     |

**4.2 Độ tin cậy (Reliability)**

- NFR-01: Uptime ≥ 99.5% (downtime tối đa \~43 giờ/năm)

- NFR-02: Không mất dữ liệu bài thi đang làm khi mất kết nối (auto-save mỗi 30 giây)

- NFR-03: Database backup hàng ngày, retention 30 ngày

- NFR-04: Health check endpoint và tự động restart khi service cử

**4.3 Bảo mật (Security)**

- NFR-05: HTTPS bắt buộc toàn bộ (TLS 1.2+)

- NFR-06: JWT có expiry 15 phút + Refresh Token 7 ngày

- NFR-07: Mật khẩu hash bằng bcrypt (cost factor 12)

- NFR-08: Rate limiting API: 100 req/phút/IP, 20 req/phút cho auth endpoint

- NFR-09: Input validation và sanitization chống XSS, SQL/NoSQL injection

- NFR-10: Audio/PDF URL có signed URL, hết hạn sau 1 giờ

- NFR-11: CORS chỉ cho phép domain đăng ký

**4.4 Khả năng mở rộng (Scalability)**

- NFR-12: Stateless backend --- có thể horizontal scale bằng cách tăng số replica

- NFR-13: MongoDB Atlas hỗ trợ auto-scale read replicas

- NFR-14: Static assets (audio, ảnh) phân phối qua CDN, không qua server

- NFR-15: Redis cluster cho session/cache khi cần

**4.5 Khả năng bảo trì (Maintainability)**

- NFR-16: Code coverage unit test ≥ 70%

- NFR-17: Tài liệu API theo chuẩn OpenAPI 3.0 (Swagger UI)

- NFR-18: Logging tập trung (structured JSON log), lưu 14 ngày

- NFR-19: CI/CD tự động: lint → test → build → deploy khi push lên main

**4.6 Khả năng tiếp cận (Accessibility)**

- NFR-20: Tuân thủ WCAG 2.1 Level AA

- NFR-21: Hỗ trợ keyboard navigation toàn bộ luồng thi

- NFR-22: Responsive design: Desktop, Tablet, Mobile (breakpoint 768px, 1024px)

- NFR-23: Hỗ trợ trình duyệt: Chrome 100+, Firefox 100+, Safari 15+, Edge 100+

**5. Ràng Buộc Hệ Thống**

**5.1 Ràng buộc kỹ thuật**

- CON-01: Backend viết bằng Python 3.11+ và FastAPI

- CON-02: Frontend dùng Next.js 14 (App Router), TypeScript

- CON-03: Database chính là MongoDB (Atlas), có thể dùng free tier ban đầu

- CON-04: File audio/media lưu trữ trên Cloudflare R2 hoặc AWS S3

- CON-05: Container hóa toàn bộ bằng Docker + Docker Compose

- CON-06: Node.js ≥ 18 LTS cho frontend build

- CON-07: Audio format chuẩn là MP3 128kbps --- không re-encode khi upload

**5.2 Ràng buộc dữ liệu**

- CON-08: Dữ liệu câu hỏi phải qua pipeline kiểm tra trước khi import (schema validation)

- CON-09: Mỗi câu hỏi phải có ít nhất 1 đáp án chính xác

- CON-10: Audio file phải được liên kết với ít nhất 1 section trước khi test được publish

- CON-11: Kích thước tối đa 1 file audio: 50MB

- CON-12: Dữ liệu người dùng (bài làm, điểm) lưu ít nhất 1 năm

**5.3 Ràng buộc pháp lý**

- CON-13: Phần mềm chỉ dùng cho mục đích nội bộ / học tập, không phân phối công khai

- CON-14: Không tái phân phối nội dung gốc của Cambridge University Press

- CON-15: Dữ liệu cá nhân người dùng phải tuân thủ GDPR (có quyền xóa tài khoản và dữ liệu)

**5.4 Ràng buộc ngân sách & hạ tầng**

- CON-16: Giai đoạn 1 deploy trên 1 VPS duy nhất (tối thiểu 4 vCPU, 8GB RAM)

- CON-17: MongoDB Atlas free tier (512MB) cho môi trường dev; trả phí khi production

- CON-18: Cloudflare R2 --- miễn phí egress, ưu tiên trước S3

**6. Kiến Trúc Hệ Thống**

**6.1 Tổng quan kiến trúc**

Hệ thống theo mô hình 3-tier: Presentation Layer (Next.js), Application Layer (FastAPI), Data Layer (MongoDB + Redis + R2). Toàn bộ được container hóa và deploy trên một VPS duy nhất ở giai đoạn 1.

**6.2 Component chính**

|  |  |  |  |
|:--:|:--:|:--:|:--:|
| **Layer** | **Công nghệ** | **Vai trò** | **Ghi chú** |
| Frontend | Next.js 14 + Tailwind | UI, routing, SSR | TypeScript, shadcn/ui |
| Backend API | FastAPI + Motor | Business logic, auth | Python 3.11, async |
| Database | MongoDB Atlas | Dữ liệu câu hỏi, user | Document store |
| Cache / Session | Redis | Timer state, token blacklist | In-memory |
| File Storage | Cloudflare R2 | Audio, ảnh | S3-compatible |
| Reverse Proxy | Nginx | SSL, load balance | Docker container |
| CI/CD | GitHub Actions | Build, test, deploy | Push-to-deploy |

**6.3 Data Pipeline (xử lý PDF thô)**

Pipeline chạy một lần (offline) để chuyển PDF + audio thô thành dữ liệu cấu trúc trong MongoDB:

1.  Phase 1 --- PDF Extraction: dùng pdfplumber/pymupdf để trích xuất text + layout

2.  Phase 2 --- Structuring: rule-based parser (regex + heuristic) nhận diện loại câu hỏi, boundary, stem, options và word limit từ raw text đã extract

3.  Phase 3 --- Image Extraction: pymupdf trích xuất ảnh nhúng (map, diagram, chart) theo bounding box, crop và upload lên R2, gán image_url vào document câu hỏi tương ứng

4.  Phase 4 --- Human Review: kiểm tra thủ công kết quả parse, sửa lỗi edge case (\< 5% câu hỏi bị nhận sai loại)

5.  Phase 5 --- Audio Mapping: gán file audio → section tương ứng

6.  Phase 6 --- Import: chạy script import JSON → MongoDB, upload audio + ảnh → R2

**7. Cấu Trúc Dữ Liệu (MongoDB Collections)**

**7.1 Collections chính**

|  |  |  |
|:--:|:--:|:--:|
| **Collection** | **Fields chính** | **Mô tả** |
| users | \_id, email, role, created_at, profile | Tài khoản người dùng |
| questions | book, test, skill, part, number, type, stem, options, correct_answer, audio_url | Kho câu hỏi toàn bộ |
| sections | book, test, skill, part, content, audio_url, question_ids | Passage / Part trong mỗi test |
| attempts | user_id, book, test, skill, started_at, submitted_at, responses\[\], band_score | Lần làm bài của user |
| writing_submissions | user_id, book, test, task, content, word_count, ai_feedback, submitted_at | Bài viết Writing |
| speaking_recordings | user_id, book, test, part, audio_url, transcript, submitted_at | Bản ghi âm Speaking |

**8. API Endpoints (Hỏ sơ)**

**8.1 Auth**

|            |                    |                                          |
|:----------:|:------------------:|:----------------------------------------:|
| **Method** |    **Endpoint**    |                **Mô tả**                 |
|    POST    | /api/auth/register |          Đăng ký tài khoản mới           |
|    POST    |  /api/auth/login   | Đăng nhập, trả về access + refresh token |
|    POST    | /api/auth/refresh  |           Làm mới access token           |
|    POST    |  /api/auth/logout  |                Hủy phiên                 |

**8.2 Tests & Questions**

|  |  |  |
|:--:|:--:|:--:|
| **Method** | **Endpoint** | **Mô tả** |
| GET | /api/tests | Danh sách tất cả tests |
| GET | /api/tests/{book}/{test} | Chi tiết 1 test |
| GET | /api/tests/{book}/{test}/{skill} | Câu hỏi + audio URL của 1 skill |
| POST | /api/attempts | Bắt đầu làm bài |
| PUT | /api/attempts/{id}/submit | Nộp bài, nhận kết quả |
| GET | /api/attempts/{id}/result | Kết quả chi tiết |

**8.3 User & Analytics**

|            |                        |                        |
|:----------:|:----------------------:|:----------------------:|
| **Method** |      **Endpoint**      |       **Mô tả**        |
|    GET     | /api/users/me/history  |  Lịch sử thi của user  |
|    GET     |  /api/users/me/stats   |  Thống kê tiến trình   |
|    GET     | /api/users/me/mistakes | Danh sách câu hỏi sai  |
|    POST    |  /api/writing/submit   |    Nộp bài Writing     |
|    POST    |  /api/speaking/upload  | Upload ghi âm Speaking |

**9. User Flow Chính**

**9.1 Luồng làm bài Listening**

7.  User vào trang Test Library → chọn Book 5, Test 2

8.  Chọn kỹ năng Listening → nhấn "Bắt đầu"

9.  Hệ thống tạo attempt, trả về câu hỏi + signed audio URL

10. Đồng hồ 30 phút chạy, audio tự động phát

11. User điền đáp án theo từng Part

12. Nộp bài (thủ công hoặc hết giờ) → API chấm tự động

13. Trang kết quả: band score, danh sách đúng/sai, đáp án đầy đủ

**9.2 Luồng làm bài Writing**

14. Chọn Writing → hệ thống hiển thị Task 1 và Task 2

15. Đồng hồ 60 phút, auto-save bài mỗi 30 giây

16. Word counter real-time theo từng Task

17. Nộp bài → lưu vào writing_submissions

18. (Phase 2) AI chấm điểm và feedback sau 10--30 giây

**9.3 Luồng làm bài Reading**

19. Chọn Reading → hệ thống tải 3 passages + câu hỏi tương ứng

20. Giao diện split view: passage bên trái, câu hỏi bên phải --- cuộn độc lập

21. Đồng hồ 60 phút chạy liên tục qua cả 3 passages

22. User có thể highlight văn bản trong passage để đánh dấu

23. Điền đáp án cho từng câu, có thể chuyển qua lại giữa các passages tự do

24. Nộp bài (thủ công hoặc hết giờ) → API chấm tự động 40 câu

25. Trang kết quả: band score, đánh dấu từng câu đúng/sai trực tiếp trên passage, giải thích đáp án

**9.4 Luồng làm bài Speaking**

26. Chọn Speaking → hệ thống hiển thị hướng dẫn và yêu cầu quyền micro

27. Part 1: hiển thị câu hỏi general topics, đồng hồ 4--5 phút, ghi âm tự động qua MediaRecorder

28. Part 2: hiển thị cue card, 1 phút chuẩn bị (đếm ngược riêng), sau đó ghi âm 2 phút trả lời

29. Part 3: câu hỏi thảo luận chuyên sâu liên quan Part 2, đồng hồ 4--5 phút, ghi âm tiếp tục

30. Kết thúc → upload bản ghi âm lên R2, lưu vào speaking_recordings

31. User có thể nghe lại toàn bộ bản ghi từ trang lịch sử thi

32. (Phase 2) AI phân tích phát âm, từ vựng, ngữ pháp và cho điểm theo 4 tiêu chí band score

**10. Lộ Trình Phát Triển**

|  |  |  |  |
|:--:|:--:|:--:|:--:|
| **Giai đoạn** | **Thời gian** | **Nội dung** | **Deliverable** |
| Phase 0 | Tuần 1--2 | Data Pipeline: parse PDF → JSON, import 1 book mẫu | JSON + DB seed |
| Phase 1a | Tuần 3--4 | Backend: auth, CRUD tests/questions, submit API | API v1 |
| Phase 1b | Tuần 5--6 | Frontend: Test Library, Listening UI, Reading UI | MVP UI |
| Phase 1c | Tuần 7--8 | Writing UI, Speaking UI, dashboard tiến trình | Full 4 skills |
| Phase 1d | Tuần 9--10 | Import đủ 20 books, QA từng test, admin panel | Production |
| Phase 2 | Tháng 3+ | AI chấm Writing, AI feedback Speaking, leaderboard | v2.0 |

**11. Rủi Ro & Giảm Thiểu**

|  |  |  |  |
|:--:|:--:|:--:|:--:|
| **Rủi ro** | **Xác suất** | **Mức độ** | **Giảm thiểu** |
| PDF parse sai cấu trúc | Cao | Cao | Human review từng câu; rule-based parser + regex golden set cho các pattern lặp lại |
| Audio không khớp section | Trung bình | Cao | Tạo mapping table thủ công, test từng file |
| Bản quyền nội dung Cambridge | Thấp\* | Rất cao | Giới hạn truy cập nội bộ; không public |
| Downtime khi thi | Thấp | Cao | Auto-save 30s; health check + auto-restart |
| Data pipeline chậm (20 books) | Trung bình | Trung bình | Pipeline song song; có thể duyệt dần từng book |

*\* Riếng tư, không thương mại hóa*

**12. Tiêu Chí Thành Công**

**12.1 Điều kiện hoàn thành Phase 1 (Definition of Done)**

- [x] Đủ 80 tests (20 books × 4 tests) được import chính xác

- [x] Độ chính xác câu hỏi so với sách gốc ≥ 98%

- [x] Cả 4 skills hoạt động được end-to-end

- [x] Band score Listening & Reading sai số không quá 0.5 band

- [x] Thời gian tải trang \< 2s trên kết nối 4G

- [x] Không có lỗ bảo mật OWASP Top 10 nào

- [x] Auto-save hoạt động, không mất bài khi reload

**12.2 KPI theo dõi sau launch**

|  |  |  |
|:--:|:--:|:--:|
| **KPI** | **Mục tiêu tháng 1** | **Mục tiêu tháng 3** |
| Người dùng đăng ký | 50 | 200 |
| Lượt thi / ngày | 20 | 100 |
| Tỏ lệ hoàn thành test (đến trang kết quả) | ≥ 80% | ≥ 85% |
| Uptime | ≥ 99% | ≥ 99.5% |
| User satisfaction (self-report) | ≥ 4/5 | ≥ 4.2/5 |

**13. Phụ Lục**

**13.1 Thuật ngữ**

|  |  |
|:--:|:--:|
| **Thuật ngữ** | **Ý nghĩa** |
| Band Score | Thang điểm IELTS từ 0 đến 9 (có thể lẻ 0.5) |
| Attempt | Một lần làm bài của một user |
| Section | Một phần trong test (ví dụ: Listening Part 2) |
| Signed URL | URL có token thời hạn để truy cập tài nguyên bảo mật trên R2/S3 |
| Pipeline | Chuỗi xử lý dữ liệu từ PDF thô đến MongoDB |
| OOF | Out-Of-Fold --- kỹ thuật validation trong ML (nếu có AI scoring) |

**13.2 Tham khảo**

- Cambridge IELTS 1--20 Official Books --- Cambridge University Press

- IELTS Band Descriptors --- British Council / IDP / Cambridge Assessment English

- Next.js 14 Documentation --- nextjs.org

- FastAPI Documentation --- fastapi.tiangolo.com

- MongoDB Atlas --- mongodb.com/atlas

- WCAG 2.1 Guidelines --- w3.org/WAI/WCAG21

*Hết tài liệu --- PRD v1.0.0 --- Cambridge IELTS Practice Platform*
