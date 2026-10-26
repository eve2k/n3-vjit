# Đăng nhập Google và tự đồng bộ tiến độ

Google xác định danh tính tài khoản. Tiến độ lưu trong bảng Supabase `public.n3vjit_study_progress`, gắn với Supabase user ID. Người học không cần tự tải/lưu tiến độ hay cấp quyền Google Drive.

## Bật Google một lần cho website

1. Trong Google Cloud / Google Auth Platform, tạo project hoặc chọn project của bạn. Cấu hình trang đồng ý OAuth, tên ứng dụng, email hỗ trợ và audience. Nếu còn ở chế độ thử nghiệm, thêm email của bạn vào Test users theo cấu hình Google của project.
2. Tạo OAuth Client ID loại **Web application**. Authorized JavaScript origins gồm origin website, ví dụ `http://localhost:5173` và `https://hoc.example.com`.
3. Authorized redirect URIs phải là **Supabase callback URL**, lấy tại Supabase → Authentication → Sign In / Providers → Google, có dạng `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`.
4. Bật Google provider trong Supabase, điền Client ID và Client Secret vừa tạo rồi lưu. Client Secret chỉ đặt tại Supabase, không đặt trong `.env` Vite hoặc commit vào Git.
5. Supabase → Authentication → URL Configuration: Site URL là website của bạn. Thêm vào Redirect URLs: `http://localhost:5173/auth/callback` và callback của tên miền production, ví dụ `https://hoc.example.com/auth/callback`. Cổng phải trùng cổng website thực tế.
6. Chạy migration `migrations/20261026_study_progress.sql` nếu chưa tạo bảng tiến độ. Cấu hình Google không tự tạo bảng này. Nếu đã chạy migration, không chạy lại; không cần migration mới cho tự đồng bộ.

Hai callback ở bước 3 và bước 5 có vai trò khác nhau: Google trả kết quả về Supabase, rồi Supabase trả về website. Cấu hình nhầm hai URL sẽ làm đăng nhập thất bại.

Frontend vẫn chỉ cần `VITE_SUPABASE_URL` và `VITE_SUPABASE_PUBLISHABLE_KEY` hiện có. Không cần Google Client Secret trong frontend. Mở `/login` hoặc `/register` → **Tiếp tục với Google**. Luồng dùng PKCE; verifier chỉ tồn tại trong sessionStorage của tab bắt đầu đăng nhập và hết hạn sau 10 phút. Callback đổi code lấy phiên Supabase, xóa code khỏi thanh địa chỉ và xóa verifier sau thành công. Không lưu Google access/refresh token, không yêu cầu quyền Drive hay gửi email Google.

Nút Google kiểm tra provider đã bật trước khi chuyển trang. Nếu báo chưa cấu hình, hãy hoàn thành bước 4. Nếu báo thiếu verifier, bắt đầu lại từ nút đăng nhập trên cùng trình duyệt/tab, thay vì sao chép callback sang thiết bị khác.

## Người học sử dụng thế nào?

- Đăng nhập cùng tài khoản Google trên điện thoại/laptop. Tiến độ tự tải trước khi mở bài học; dữ liệu của từng tài khoản được lưu riêng.
- Các thay đổi tiến độ tự được đồng bộ sau khoảng 800ms ngừng thay đổi. Ứng dụng cũng kiểm tra lại khi mở tab, có mạng trở lại và mỗi phút khi tab đang hiển thị.
- Nhãn trạng thái ở thanh điều hướng và trang Tài khoản cho biết đang đồng bộ, đã đồng bộ hoặc còn lưu trên thiết bị. Chỉ chuyển thiết bị sau khi thấy **Đã đồng bộ** nếu cần tiếp tục ngay.
- Mất mạng vẫn học được. Thay đổi giữ trên trình duyệt, tự thử lại với thời gian chờ tăng dần tối đa 60 giây; đóng trang ngay trước khi lưu xong có thể hoãn đồng bộ đến lần mở lại/đăng nhập lại. Không hứa gửi được request khi trình duyệt đã đóng.
- Lần đầu dùng đồng bộ tự động, tiến độ riêng của tài khoản trên thiết bị được gộp với bản lưu hiện có. Tiến độ khách chỉ gộp khi bạn nhấn nút gộp trong Tài khoản.
- Tài khoản đăng nhập email cũng được tự đồng bộ. Supabase hỗ trợ tự liên kết các danh tính có cùng email theo quy tắc xác minh của dịch vụ; email khác nhau thường là hai tài khoản riêng. Ứng dụng luôn dùng user ID để tách tiến độ, không tự gộp dựa trên email frontend.
- Bài viết chỉ đồng bộ sau khi đã lưu trong phần viết; bài thi đồng bộ khi có kết quả được lưu. Nội dung đang gõ/chưa nộp không phải bản lưu hoàn chỉnh.

## Xung đột và dữ liệu cũ

Ứng dụng lưu mốc dữ liệu đã được server xác nhận riêng cho mỗi tài khoản trên mỗi trình duyệt. Khi đồng bộ, so sánh mốc này với dữ liệu mới trên máy và server để giữ thay đổi chưa gửi, tiếp nhận thay đổi từ thiết bị khác và truyền được thao tác bỏ thuộc flashcard/xóa tiến độ. Ghi server có điều kiện `updated_at`; nếu thiết bị khác vừa lưu, tải lại và gộp trước khi thử lại tối đa 3 lần trong một lượt.

Các câu/thẻ mới và các bài thi khác nhau được hợp nhất. Với cùng trường cùng lúc, thay đổi tại thiết bị đang đồng bộ được ưu tiên; riêng bài viết chọn cả bản có `updatedAt` mới hơn. Đây không phải trình soạn thảo cộng tác thời gian thực: nên tránh sửa cùng bài viết/bài thi trên hai thiết bị đồng thời. Khi một thiết bị đã xóa/bỏ thuộc, thiết bị cũ không tự khôi phục dữ liệu chỉ vì còn cache cũ.

Nút xóa tiến độ khi đã đăng nhập sẽ đồng bộ thao tác xóa sang tài khoản và các thiết bị khác; giao diện có cảnh báo trước khi thực hiện. Vẫn có thể xuất tệp sao lưu ở Tổng quan. Tệp sao lưu không chứa phiên đăng nhập, verifier PKCE hay mốc đồng bộ.

## Kiểm tra sau cấu hình

1. Đăng nhập Google bằng email thử nghiệm của bạn, kiểm tra tài khoản hiển thị đúng.
2. Làm một câu, đánh dấu một flashcard, đợi **Đã đồng bộ**.
3. Mở trình duyệt/thiết bị khác, đăng nhập cùng Google và kiểm tra tiến độ.
4. Thử offline → học → online để xác nhận tự gửi lại. Thử bỏ thuộc một thẻ và xác nhận trên thiết bị kia.

Unit tests dùng dữ liệu giả lập, không đăng nhập Google thật hoặc tạo người dùng. Cần hoàn thành cấu hình OAuth của chủ project để kiểm tra luồng Google thực tế.

Tài liệu: [Google provider setup](https://supabase.com/docs/guides/auth/social-sign-in/auth-google), [PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow), [identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking).
