# Tổng quan codebase N3-VJIT Exam Mastery

Tài liệu này mô tả cấu trúc và các luồng chính của mã nguồn tại thời điểm hiện tại. Hướng dẫn thiết lập và vận hành chi tiết vẫn nằm trong [README.md](README.md) và các tài liệu liên kết bên dưới.

## Mục đích

Ứng dụng web giúp ôn tiếng Nhật JLPT N3, giao diện tiếng Việt. Các chế độ chính gồm trắc nghiệm, đọc hiểu, nghe, flashcard, ngữ pháp, hội thoại, viết bài, thi thử, lộ trình ôn tập và sổ tay câu sai. Người dùng có thể học khách hoặc đăng nhập để lưu và đồng bộ tiến độ.

## Công nghệ và lệnh

- React 19, React Router và Vite; mã giao diện viết bằng JSX/JavaScript dạng ES modules.
- Supabase Auth và REST API được gọi từ client riêng trong `src/services/auth.js`; không có SDK Supabase trong danh sách dependency.
- Supabase Postgres lưu tiến độ khi cấu hình migration tương ứng. Email nhắc học chạy qua Supabase Edge Function và cần cấu hình dịch vụ email riêng.
- CSS nằm trong `src/index.css`, `src/App.css` và `src/redesign.css`; icon dùng `lucide-react`.

Các lệnh trong `package.json`:

```bash
npm run dev      # chạy máy chủ phát triển Vite
npm run build    # tạo bản build trong dist/
npm run preview  # xem thử bản build
npm test         # chạy bộ kiểm thử node:test
npm run lint     # kiểm tra bằng oxlint
```

## Bố cục thư mục

| Đường dẫn | Nội dung |
| --- | --- |
| `src/main.jsx` | Điểm vào; nạp CSS, khởi tạo router, `AuthProvider` và giọng đọc. |
| `src/App.jsx` | Khai báo các route, tải lười màn hình và điều phối trạng thái đăng nhập, quyền admin, giao diện. |
| `src/components/` | Các trang và thành phần chức năng: dashboard, quiz, thi thử, học theo lộ trình, tài khoản, admin, v.v. |
| `src/context/` | React context cho trạng thái xác thực. `AuthContext.jsx` quản lý phiên, sync và quyền admin. |
| `src/services/` | Client Supabase Auth và bộ điều phối đồng bộ tiến độ. |
| `src/utils/` | Nghiệp vụ có thể dùng lại: lưu trữ, SRS, lộ trình, tính điểm, gộp tiến độ, Pomodoro, nhắc học, TTS và xác thực dữ liệu. |
| `src/data/` | Ngân hàng câu hỏi và nội dung học; `index.js` gom dữ liệu và tạo danh sách section/deck dùng bởi UI. |
| `public/` | Ảnh, biểu tượng và tài nguyên tĩnh được phục vụ nguyên trạng. |
| `supabase/migrations/` | SQL thiết lập lưu tiến độ, nhắc học và vai trò quản trị. |
| `supabase/functions/` | Edge Function gửi email nhắc giờ học. |
| `scripts/` | Công cụ trích xuất/tạo dữ liệu học và build lại trên máy chủ. |
| `deploy/` | Ví dụ cấu hình dịch vụ systemd, Caddy và hướng dẫn triển khai. |

## Luồng chạy ứng dụng

1. `src/main.jsx` nạp theme đã lưu, khởi tạo giọng đọc và render React trong `BrowserRouter` cùng `AuthProvider`.
2. `AuthProvider` khôi phục phiên (nếu Supabase được cấu hình), đặt phạm vi storage theo người dùng, và khởi động đồng bộ tiến độ cho tài khoản đăng nhập.
3. `App.jsx` chọn trang dựa trên URL. Hầu hết trang được tải bằng `React.lazy`; `/study` điều hướng về `/`, còn `/quiz?mode=exam` chuyển sang `/exam`.
4. Các trang gọi hàm nghiệp vụ trong `src/utils/` và dữ liệu được tổng hợp từ `src/data/index.js`.

Route chính: `/` (lộ trình), `/dashboard`, `/quiz`, `/exam`, `/dokkai`, `/choukai`, `/flashcards`, `/grammar`, `/kaiwa`, `/sakubun`, `/review`, `/review/test`, `/account`, `/admin`, cùng các route đăng nhập và callback.

`/mistakes` chuyển hướng về `/review`. Trang Ôn tập dùng `ReviewPage`, `ReviewSetup`,
`ReviewTest`; logic chọn/chấm câu nằm trong `reviewLearning.js`, phiên và kết quả
trong `reviewProgress.js`, ánh xạ ID Đọc hiểu trong `reviewQuestionIds.js`.
Xem [docs/REVIEW_DATA.md](docs/REVIEW_DATA.md) để thử đồng bộ hai trình duyệt.

## Dữ liệu học và đồng bộ

- Nội dung câu hỏi/thẻ học là module JavaScript tĩnh trong `src/data/`; thay đổi dữ liệu thường không cần thay logic giao diện.
- `src/utils/storage.js` là lớp truy cập `localStorage`, đóng gói các key tiến độ. Dữ liệu tài khoản được đặt dưới tiền tố `n3vjit_account:<userId>:`; theme dùng key chung.
- Chế độ khách không ghi tiến độ học vào storage. Tài khoản dùng bản cục bộ để hoạt động khi offline.
- `src/services/progressSync.js` phối hợp tải bản server, bản cục bộ và baseline trước đó qua `src/utils/syncProgress.js`, sau đó gộp và lưu. Sự kiện thay đổi, online/focus và pagehide có thể kích hoạt đồng bộ lại.
- Đăng nhập chỉ dùng URL và publishable/anon key phía trình duyệt (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). Không đưa secret hoặc `service_role` key vào frontend.
- Schema, RLS và setup backend nằm trong `supabase/migrations/`; SQL không tự chạy khi build frontend.

## Nơi sửa theo chức năng

- Thêm/sửa câu hỏi: module dữ liệu tương ứng trong `src/data/`, cập nhật export ở `src/data/index.js` nếu thêm section mới.
- Sửa luồng học hoặc giao diện: component trong `src/components/`; route đặt ở `src/App.jsx`.
- Sửa cách lưu hoặc tính tiến độ: kiểm tra `src/utils/storage.js`, `src/utils/learning.js`, `src/utils/spacedRepetition.js`, `src/utils/studyRoadmap.js` và `src/utils/syncProgress.js` theo đúng miền nghiệp vụ.
- Sửa đăng nhập: `src/services/authClient.js`, `src/services/auth.js`, `src/context/AuthContext.jsx` và các trang auth.
- Sửa schema/backend: migration hoặc Edge Function trong `supabase/` và cập nhật hướng dẫn setup liên quan.

## Kiểm thử và tài liệu liên quan

Các kiểm thử hiện có là file `*.test.js` trong `src/utils/`, chạy bằng `node --test`. Khi thay đổi nên tập trung kiểm tra module nghiệp vụ tương ứng và build theo nhu cầu dự án.

- [README.md](README.md): cài đặt, tính năng, Supabase Auth và quy trình chạy.
- [supabase/PROGRESS_SYNC.md](supabase/PROGRESS_SYNC.md): thiết lập và hành vi đồng bộ tiến độ.
- [supabase/STUDY_ROADMAP.md](supabase/STUDY_ROADMAP.md): quy tắc chia lộ trình và ôn cách quãng.
- [supabase/REMINDERS.md](supabase/REMINDERS.md): triển khai email nhắc học.
- [deploy/DUCKDNS.md](deploy/DUCKDNS.md): triển khai trên máy chủ.
