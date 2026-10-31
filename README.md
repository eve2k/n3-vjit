# N3-VJIT Exam Mastery

Website ôn tập tiếng Nhật N3 bằng React và Vite, gồm 257 câu trắc nghiệm, đọc hiểu, luyện nghe, flashcard, ngữ pháp, hội thoại và viết bài.

Trang `/study` mở phiên ôn hôm nay trong bố cục tập trung, không có thanh điều hướng. Pomodoro mặc định học 25 phút, nghỉ ngắn 5 phút, nghỉ dài 15 phút sau mỗi 4 phiên; thời lượng có thể chỉnh trong trang học. Trang `/admin` quản lý quyền tài khoản sau khi cấu hình migration.

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

- **Luyện câu hỏi theo lộ trình tới ngày thi:** ghi nhận ngày bắt đầu theo tài khoản, chọn ngày thi và tự chia lượng câu mới theo phần chưa học/số ngày còn lại. Có dự kiến 7 ngày và giai đoạn cuối để củng cố; nghỉ vài ngày sẽ tính lại khối lượng.
- Lộ trình chừa ngày thi thử và chữa đề, không giao câu mới vào các ngày đó. Mốc 21/11/2026 mặc định có thi thử 15/11, 18/11 và chữa đề 16/11, 19/11. Lịch ngắn sẽ giảm số đề; ngày thi thử chỉ gợi ý thêm một phiên ôn nhanh tối đa 10 câu.
- Mỗi phiên tối đa 20 câu, ưu tiên câu đến hạn. Đúng khi đến hạn thì giãn lịch 1 → 3 → 7 → 14 → 30 → 60 ngày; sai hẹn ôn lại sau 10 phút. Lịch dài được đưa về các mốc củng cố trước thi. Xem [cách tính lộ trình và SRS](supabase/STUDY_ROADMAP.md).

- Trang tổng quan có tiến độ riêng từng chuyên đề, nút học tiếp và 5 kết quả thi gần nhất.
- Câu bỏ trống không được đánh dấu là đã hoàn thành; kết quả thi lưu cả thời gian làm bài.
- Sổ tay câu sai hỗ trợ câu trắc nghiệm, đọc hiểu và các câu nghe có đáp án. Trả lời đúng trong 2 lượt ôn để bỏ câu khỏi sổ tay.
- Flashcard có bộ lọc thẻ chưa thuộc; chuyển thẻ sẽ trở về mặt câu hỏi.
- Luyện câu hỏi, đọc hiểu, nghe và thi thử hỗ trợ phím 1–4 chọn đáp án theo thứ tự A–D (hoặc 1–4); Space xác nhận, Space lần nữa chuyển câu. Phím tắt không hoạt động khi nhập văn bản/điểm hoặc dùng nút điều khiển khác. Flashcard giữ Space để lật thẻ.
- Chế độ khách chỉ học thử và xem kết quả trong lượt hiện tại, không lưu tiến độ, bài viết hay lịch sử thi. Cần đăng nhập trước khi học để lưu và tự đồng bộ.
- Đăng nhập bằng email để tự tải và tự đồng bộ tiến độ lên Supabase; trang **Tài khoản** hiển thị trạng thái và có nút thử đồng bộ ngay. Mất mạng vẫn giữ dữ liệu trên thiết bị và tự thử lại.
- Dùng **Sao lưu** trên trang tổng quan để tải tệp JSON. **Khôi phục** hỗ trợ cả bản sao lưu cũ và định dạng có phiên bản mới, kiểm tra dữ liệu trước khi ghi. Các mục có trong tệp sẽ thay thế dữ liệu tương ứng trên máy.
- Khách không lưu tiến độ trên trình duyệt. Tiến độ tài khoản đã đồng bộ có thể tải lại khi đăng nhập cùng tài khoản trên website dùng cùng project Supabase.

## Đăng nhập / đăng ký với Supabase

1. Sao chép `.env.example` thành `.env.local`, điền Project URL và publishable key (hoặc biến `VITE_SUPABASE_ANON_KEY` với anon key cũ). Dự án dùng Vite, vì vậy biến môi trường phải có tiền tố `VITE_`, không dùng `NEXT_PUBLIC_`. File `.env.local` được Git bỏ qua.
2. Trong Supabase → Authentication → Providers, bật Email. Bật xác nhận email nếu muốn tài khoản chỉ đăng nhập sau khi xác minh địa chỉ.
3. Trong Authentication → URL Configuration, với website trên VPS hãy đặt Site URL là `http://chungchitiengnhatvjit.duckdns.org:4173` và thêm Redirect URL `http://chungchitiengnhatvjit.duckdns.org:4173/auth/callback`. Khi phát triển cục bộ, thêm riêng `http://localhost:5173/auth/callback` (đổi cổng nếu Vite dùng cổng khác). Địa chỉ callback trong ứng dụng được lấy từ domain đang mở; nếu nó không nằm trong danh sách Redirect URLs, Supabase có thể chuyển về Site URL.
4. Trong Authentication → Email Templates → Confirm signup, giữ liên kết xác nhận là `{{ .ConfirmationURL }}` để Supabase chuyển tiếp tới callback đã yêu cầu. Nếu email vẫn trỏ về localhost, kiểm tra Site URL, danh sách Redirect URLs và template này; gửi lại email sau khi lưu cấu hình vì liên kết cũ vẫn giữ địa chỉ cũ.
5. Để bật lưu tiến độ trực tuyến, chạy file `supabase/migrations/20261026_study_progress.sql` một lần bằng Supabase SQL Editor hoặc quy trình migrations của bạn. Migration tạo bảng `public.n3vjit_study_progress`, bật RLS và giới hạn đọc/ghi theo `auth.uid() = user_id`.
6. Để bật dashboard quản trị, chạy `supabase/migrations/20261027_admin_roles.sql` một lần bằng Supabase SQL Editor. Migration cấp quyền cho `nguyeenhuynhlong@gmail.com` nếu tài khoản đã tồn tại. Nếu tài khoản được tạo sau đó, project owner cần xác minh chủ tài khoản rồi chạy câu lệnh sau một lần:

   ```sql
   insert into n3vjit_private.admin_roles(user_id)
   select id from auth.users where lower(email) = 'nguyeenhuynhlong@gmail.com'
   on conflict (user_id) do nothing;
   ```

   Vì xác nhận email đang tắt, chỉ chạy câu lệnh này sau khi đã xác minh chủ email để tránh cấp quyền cho người đăng ký giả mạo địa chỉ. Admin có thể mở `/admin` để xem người dùng và cấp/thu hồi quyền; xác thực quyền và danh sách đều kiểm tra ở Supabase.
7. Sau migration phân quyền ở bước 6, chạy `supabase/migrations/20261029_question_bank.sql`. Migration tạo ngân hàng dùng chung, nhập 257 câu từ 5 bộ hiện tại theo ID cũ và bật RLS: đọc công khai, ghi/lưu trữ chỉ admin. Dữ liệu seed không ghi đè câu đã tồn tại.
8. Khởi động lại `npm run dev` sau khi thay đổi biến môi trường. Khi triển khai, khai báo hai biến công khai tương ứng trong môi trường build của hosting, rồi build lại.

Các trang: `/login`, `/register`, `/forgot-password`, `/reset-password`, `/auth/callback`, `/account`, `/study`, `/admin`. Đăng ký có kiểm tra mật khẩu nhập lại; hỗ trợ hiện/ẩn mật khẩu, gửi lại xác nhận, đặt lại mật khẩu và đăng xuất. Liên kết email được xử lý theo implicit flow dành cho ứng dụng trình duyệt; token được kiểm tra qua Supabase trước khi nhận phiên và fragment chứa token được xóa khỏi thanh địa chỉ.

Mật khẩu chỉ được gửi đến Supabase Auth qua HTTPS, không lưu trong tiến độ hoặc trình duyệt. Trình duyệt lưu access/refresh token cho phiên đăng nhập; các token này không được đưa vào tệp sao lưu hoặc dữ liệu tiến độ trên database. Chỉ dùng publishable/anon key cho frontend, không dùng secret key, `service_role` hoặc mật khẩu database.

Sau khi đăng nhập, tiến độ tự tải và tự đồng bộ lên tài khoản trong quá trình học. Ứng dụng giữ bản cục bộ để dùng khi mất mạng và tự thử lại khi kết nối trở lại. Nhãn “Đã đồng bộ” cho biết bản lưu đã được server xác nhận; không cần bấm lưu/tải thủ công. Chế độ khách không lưu và không gộp tiến độ vào tài khoản. SQL migration không tự chạy khi build frontend.

Đăng nhập bằng email và mật khẩu để dùng tự đồng bộ. Xem [hướng dẫn tự đồng bộ tiến độ](supabase/PROGRESS_SYNC.md), gồm cách thiết lập bảng lưu, xử lý mất mạng, xung đột giữa thiết bị và kiểm tra thực tế.

Tài liệu tham khảo: [Supabase Auth REST API](https://github.com/supabase/auth/blob/master/openapi.yaml), [xác thực bằng mật khẩu](https://supabase.com/docs/guides/auth/passwords), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Email nhắc giờ học

Trang Tài khoản có lịch nhắc theo ngày, giờ và múi giờ, mặc định tắt. Cần triển khai Supabase Edge Function + Cron và cấu hình Resend trước khi người học có thể bật email. Không cần dịch vụ email để chạy các tính năng học khác. Xem [hướng dẫn đầy đủ](supabase/REMINDERS.md); mã nguồn không chứa API key gửi email, và build frontend không tự tạo lịch hay gửi thư.

## Triển khai trên laptop server

Mã nguồn được đồng bộ qua Syncthing; Caddy phục vụ bản build trên cổng 4173 với domain `chungchitiengnhatvjit.duckdns.org`. Xem [cấu hình DuckDNS, UFW và Supabase callback](deploy/DUCKDNS.md). Sau khi mã đã đồng bộ, chạy `bash scripts/rebuild-server.sh` trên server để build lại và restart dịch vụ.
