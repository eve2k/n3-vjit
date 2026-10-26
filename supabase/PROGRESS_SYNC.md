# Tự đồng bộ tiến độ theo tài khoản

Tiến độ lưu trong bảng Supabase `public.n3vjit_study_progress`, gắn với user ID của tài khoản đăng nhập bằng email. Người học không cần tự tải/lưu tiến độ.

## Thiết lập một lần

1. Cấu hình `VITE_SUPABASE_URL` và `VITE_SUPABASE_PUBLISHABLE_KEY` theo README.
2. Bật Email provider, cấu hình Site URL và Redirect URL `/auth/callback` trên Supabase để xác nhận email/khôi phục mật khẩu.
3. Chạy `migrations/20261026_study_progress.sql` nếu chưa tạo bảng tiến độ. Nếu đã chạy migration, không chạy lại; không cần migration mới cho tự đồng bộ.

## Người học sử dụng thế nào?

Khách vãng lai không lưu tiến độ, lịch sử thi, flashcard hay bài viết và không có chức năng sao lưu/khôi phục. Chỉ kết quả đang xem trong lượt học hiện tại được giữ tạm trong giao diện. Dữ liệu khách từ phiên bản cũ được bỏ qua, không tự gộp vào tài khoản.

- Đăng nhập cùng tài khoản email trên điện thoại/laptop. Tiến độ tự tải trước khi mở bài học; dữ liệu của từng tài khoản được lưu riêng.
- Các thay đổi tiến độ tự được đồng bộ sau khoảng 800ms ngừng thay đổi. Ứng dụng cũng kiểm tra lại khi mở tab, có mạng trở lại và mỗi phút khi tab đang hiển thị.
- Nhãn trạng thái ở thanh điều hướng và trang Tài khoản cho biết đang đồng bộ, đã đồng bộ hoặc còn lưu trên thiết bị. Chỉ chuyển thiết bị sau khi thấy **Đã đồng bộ** nếu cần tiếp tục ngay.
- Mất mạng vẫn học được. Thay đổi giữ trên trình duyệt, tự thử lại với thời gian chờ tăng dần tối đa 60 giây; đóng trang ngay trước khi lưu xong có thể hoãn đồng bộ đến lần mở lại/đăng nhập lại. Không hứa gửi được request khi trình duyệt đã đóng.
- Lần đầu dùng đồng bộ tự động, tiến độ riêng của tài khoản trên thiết bị được gộp với bản lưu hiện có. Khách chỉ học thử, không lưu tiến độ; cần đăng nhập trước khi học.
- Bài viết chỉ đồng bộ sau khi đã lưu trong phần viết; bài thi đồng bộ khi có kết quả được lưu. Nội dung đang gõ/chưa nộp không phải bản lưu hoàn chỉnh.

## Xung đột và dữ liệu cũ

Ứng dụng lưu mốc dữ liệu đã được server xác nhận riêng cho mỗi tài khoản trên mỗi trình duyệt. Khi đồng bộ, so sánh mốc này với dữ liệu mới trên máy và server để giữ thay đổi chưa gửi, tiếp nhận thay đổi từ thiết bị khác và truyền được thao tác bỏ thuộc flashcard/xóa tiến độ. Ghi server có điều kiện `updated_at`; nếu thiết bị khác vừa lưu, tải lại và gộp trước khi thử lại tối đa 3 lần trong một lượt.

Các câu/thẻ mới và các bài thi khác nhau được hợp nhất. Với cùng trường cùng lúc, thay đổi tại thiết bị đang đồng bộ được ưu tiên; riêng bài viết chọn cả bản có `updatedAt` mới hơn. Đây không phải trình soạn thảo cộng tác thời gian thực: nên tránh sửa cùng bài viết/bài thi trên hai thiết bị đồng thời. Khi một thiết bị đã xóa/bỏ thuộc, thiết bị cũ không tự khôi phục dữ liệu chỉ vì còn cache cũ.

Nút xóa tiến độ khi đã đăng nhập sẽ đồng bộ thao tác xóa sang tài khoản và các thiết bị khác; giao diện có cảnh báo trước khi thực hiện. Vẫn có thể xuất tệp sao lưu ở Tổng quan. Tệp sao lưu không chứa phiên đăng nhập hay mốc đồng bộ.

## Kiểm tra sau cấu hình

1. Đăng nhập bằng email của bạn, kiểm tra tài khoản hiển thị đúng.
2. Làm một câu, đánh dấu một flashcard, đợi **Đã đồng bộ**.
3. Mở trình duyệt/thiết bị khác, đăng nhập cùng tài khoản và kiểm tra tiến độ.
4. Thử offline → học → online để xác nhận tự gửi lại. Thử bỏ thuộc một thẻ và xác nhận trên thiết bị kia.

Unit tests dùng dữ liệu giả lập, không tạo người dùng thật. Cần cấu hình bảng lưu tiến độ trên Supabase và kiểm tra đồng bộ thực tế giữa hai trình duyệt/thiết bị.

Tài liệu: [Supabase password authentication](https://supabase.com/docs/guides/auth/passwords), [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
