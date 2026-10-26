# N3-VJIT Exam Mastery

Website ôn tập tiếng Nhật N3 bằng React và Vite, gồm 257 câu trắc nghiệm, đọc hiểu, luyện nghe, flashcard, ngữ pháp, hội thoại và viết bài.

## Chạy trên máy

Dùng Node.js 22.12 trở lên. Trong thư mục dự án:

```bash
npm ci --include=optional
npm run dev
```

Mở địa chỉ Vite hiển thị trong terminal, thường là `http://localhost:5173`.

Nếu chuyển dự án từ Windows sang Linux và gặp lỗi `Cannot find native binding`, chạy lại `npm ci --include=optional` để cài thư viện đúng hệ điều hành. Cần kết nối internet khi cài thư viện.

## Kiểm tra và build

```bash
npm test
npm run build
npm run preview
```

Kết quả build nằm trong `dist/`. Khi đưa lên hosting, cấu hình trả về `index.html` cho các đường dẫn ứng dụng như `/exam`, `/quiz`, `/grammar` và `/flashcards` để hỗ trợ mở liên kết trực tiếp.

Repository chỉ cần mã nguồn, tài nguyên trong `public/`, cấu hình và `package-lock.json`. Các thư mục `node_modules/`, `dist/`, cache, log và tệp môi trường riêng được bỏ qua; chạy `npm ci --include=optional` rồi `npm run build` sau khi clone.

## Thi thử tổng hợp

- 35 câu đọc hiểu từ ngân hàng trắc nghiệm, 2 bài đọc văn với câu hỏi đi kèm, 30 câu nghe và 1 chủ đề viết.
- Đọc hiểu, bài đọc văn và nghe chấm riêng trên thang 10. Phần nào dưới 3 điểm là **Không đạt**; đúng 3 điểm được tính là đạt. Kết quả chung chỉ đạt khi cả ba phần đạt, không dùng điểm trung bình để bù điểm liệt.
- Bài viết được lưu trong bài đã nộp để xem lại, **không tính điểm** và không ảnh hưởng kết quả đạt/không đạt.
- Đọc hiểu và bài đọc văn tự chấm theo tỉ lệ câu đúng; câu bỏ trống tính 0 điểm. Điểm liệt được so sánh trước khi làm tròn số hiển thị.
- Ngân hàng nghe hiện có 53 câu, chỉ 12 câu có đáp án và chưa có file nghe kèm theo. Đề chọn 30 câu không trùng. Có thể mở file âm thanh trên thiết bị nếu file đó khớp với các câu được chọn; ứng dụng chưa tự tạo hoặc ghép audio theo đề ngẫu nhiên.
- Do còn thiếu đáp án nghe, điểm toàn phần nghe cần nhập sau khi được chấm. Chưa nhập điểm sẽ hiển thị **Chờ chấm**; ứng dụng không tự suy đoán điểm của các câu thiếu đáp án.
- Lịch sử lưu cấu trúc đề, đáp án đã chọn, bài viết, thời gian, điểm và kết quả từng phần. Có thể mở lại bài từ trang tổng quan để cập nhật điểm nghe, không tạo thêm lịch sử trùng.

## Tiến độ học tập

- Trang tổng quan có tiến độ riêng từng chuyên đề, nút học tiếp và 5 kết quả thi gần nhất.
- Câu bỏ trống không được đánh dấu là đã hoàn thành; kết quả thi lưu cả thời gian làm bài.
- Sổ tay câu sai hỗ trợ câu trắc nghiệm, đọc hiểu và các câu nghe có đáp án. Trả lời đúng trong 2 lượt ôn để bỏ câu khỏi sổ tay.
- Flashcard có bộ lọc thẻ chưa thuộc; chuyển thẻ sẽ trở về mặt câu hỏi.
- Luyện câu hỏi, đọc hiểu, nghe và thi thử hỗ trợ phím 1–4 chọn đáp án theo thứ tự A–D (hoặc 1–4); Space xác nhận, Space lần nữa chuyển câu. Phím tắt không hoạt động khi nhập văn bản/điểm hoặc dùng nút điều khiển khác. Flashcard giữ Space để lật thẻ.
- Chế độ khách vẫn dùng được ngay. Khi đăng nhập, tiến độ được lưu riêng theo tài khoản trên trình duyệt; tiến độ khách được giữ nguyên và có thể gộp từ trang **Tài khoản**.
- Trang **Tài khoản** có nút lưu tiến độ lên Supabase và tải bản lưu về thiết bị khác. Đồng bộ do người học chủ động thực hiện; ứng dụng chưa tự tải hoặc ghi đè bản trực tuyến khi đăng nhập.
- Dùng **Sao lưu** trên trang tổng quan để tải tệp JSON. **Khôi phục** hỗ trợ cả bản sao lưu cũ và định dạng có phiên bản mới, kiểm tra dữ liệu trước khi ghi. Các mục có trong tệp sẽ thay thế dữ liệu tương ứng trên máy.
- Dữ liệu của `localhost` và tên miền công khai được lưu riêng. Hãy xuất tệp sao lưu rồi nhập trên tên miền mới khi chuyển sang website đã triển khai.

## Đăng nhập / đăng ký với Supabase

1. Sao chép `.env.example` thành `.env.local`, điền Project URL và publishable key (hoặc biến `VITE_SUPABASE_ANON_KEY` với anon key cũ). Dự án dùng Vite, vì vậy biến môi trường phải có tiền tố `VITE_`, không dùng `NEXT_PUBLIC_`. File `.env.local` được Git bỏ qua.
2. Trong Supabase → Authentication → Providers, bật Email. Bật xác nhận email nếu muốn tài khoản chỉ đăng nhập sau khi xác minh địa chỉ.
3. Trong Authentication → URL Configuration, đặt Site URL theo website đang chạy và thêm Redirect URL `http://localhost:5173/auth/callback` cùng `https://TEN_MIEN_CUA_BAN/auth/callback`. Nếu Vite chạy cổng khác, thêm URL đúng cổng đó.
4. Để bật lưu tiến độ trực tuyến, chạy file `supabase/migrations/20261026_study_progress.sql` một lần bằng Supabase SQL Editor hoặc quy trình migrations của bạn. Migration tạo bảng `public.n3vjit_study_progress`, bật RLS và giới hạn đọc/ghi theo `auth.uid() = user_id`.
5. Khởi động lại `npm run dev` sau khi thay đổi biến môi trường. Khi triển khai, khai báo hai biến công khai tương ứng trong môi trường build của hosting, rồi build lại.

Các trang: `/login`, `/register`, `/forgot-password`, `/reset-password`, `/auth/callback`, `/account`. Đăng ký có kiểm tra mật khẩu nhập lại; hỗ trợ hiện/ẩn mật khẩu, gửi lại xác nhận, đặt lại mật khẩu và đăng xuất. Liên kết email được xử lý theo implicit flow dành cho ứng dụng trình duyệt; token được kiểm tra qua Supabase trước khi nhận phiên và fragment chứa token được xóa khỏi thanh địa chỉ.

Mật khẩu chỉ được gửi đến Supabase Auth qua HTTPS, không lưu trong tiến độ hoặc trình duyệt. Trình duyệt lưu access/refresh token cho phiên đăng nhập; các token này không được đưa vào tệp sao lưu hoặc dữ liệu tiến độ trên database. Chỉ dùng publishable/anon key cho frontend, không dùng secret key, `service_role` hoặc mật khẩu database.

Khi lưu lên tài khoản, ứng dụng kiểm tra mốc cập nhật của bản lưu để phát hiện thay đổi từ thiết bị khác. Khi tải hoặc gộp tiến độ, dữ liệu được kiểm tra trước khi thay thế; tiến độ khách và tài khoản khác không bị thay đổi. SQL migration không tự chạy khi build frontend.

Tài liệu tham khảo: [Supabase Auth REST API](https://github.com/supabase/auth/blob/master/openapi.yaml), [xác thực bằng mật khẩu](https://supabase.com/docs/guides/auth/passwords), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Email nhắc giờ học

Trang Tài khoản có lịch nhắc theo ngày, giờ và múi giờ, mặc định tắt. Cần triển khai Supabase Edge Function + Cron và cấu hình Resend trước khi người học có thể bật email. Không cần dịch vụ email để chạy các tính năng học khác. Xem [hướng dẫn đầy đủ](supabase/REMINDERS.md); mã nguồn không chứa API key gửi email, và build frontend không tự tạo lịch hay gửi thư.
