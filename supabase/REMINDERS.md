# Cấu hình email nhắc giờ học

Email giữ cấu hình hiện tại và không phụ thuộc Web Push. Xem [`docs/PUSH_NOTIFICATIONS.md`](../docs/PUSH_NOTIFICATIONS.md) để bật kênh push độc lập; migration push chưa được tự chạy.

Frontend và backend đã có mã nguồn, nhưng chưa gửi email khi chưa cấu hình. Không cần dịch vụ email để chạy website hoặc dùng các tính năng học tập khác. Email xác nhận đăng ký/khôi phục mật khẩu của Supabase là luồng riêng.

## 1. Tạo dịch vụ gửi email khi bạn sẵn sàng

Tạo tài khoản [Resend](https://resend.com), xác minh tên miền gửi và tạo API key có quyền gửi email. Cấu hình địa chỉ gửi, ví dụ `N3 VJIT <hoctap@ten-mien-cua-ban.vn>`. Sender thử nghiệm `onboarding@resend.dev` chỉ gửi được đến email chủ tài khoản Resend; để dùng cho người học khác cần xác minh tên miền. Không dùng email nhận của người học làm địa chỉ gửi.

Chưa có tên miền/dịch vụ: có thể để tính năng tắt, tiếp tục phát triển website bình thường.

## 2. Tạo bảng và RPC trên Supabase

Chạy `migrations/20261027_study_reminders.sql` **một lần** bằng SQL Editor với quyền owner, hoặc dùng migration workflow hiện có. Migration độc lập với bảng tiến độ. Tất cả bảng mới bật RLS và chặn truy cập trực tiếp của frontend. Người học chỉ được đọc/lưu lịch của mình thông qua hai RPC; recipient lấy từ `auth.users`, bắt buộc email đã xác nhận.

Migration mặc định để dịch vụ tắt. Người học vẫn có thể lưu giờ/ngày học sau khi migration chạy, nhưng chưa thể bật gửi email.

## 3. Khai báo secrets và triển khai Edge Function

Trong Supabase → Edge Functions → Secrets, đặt:

| Secret | Giá trị |
| --- | --- |
| `RESEND_API_KEY` | API key gửi email của Resend |
| `RESEND_FROM` | Sender đã xác minh, ví dụ `N3 VJIT <hoctap@example.com>` |
| `APP_URL` | URL HTTPS công khai của website, ví dụ `https://hoc.example.com/` |
| `REMINDER_CRON_SECRET` | Chuỗi ngẫu nhiên ít nhất 32 ký tự, có thể tạo bằng `openssl rand -hex 32` |

`SUPABASE_URL` và `SUPABASE_SERVICE_ROLE_KEY` là biến có sẵn của môi trường Supabase Edge Functions. Không đưa bất kỳ secret nào ở trên vào biến `VITE_*`, Git hoặc mã frontend. Public key hiện tại của ứng dụng không thể triển khai backend hay áp dụng migration.

Từ thư mục project, dùng Supabase CLI sau khi đăng nhập/link đúng project:

```bash
supabase functions deploy study-reminders --no-verify-jwt
```

`supabase/config.toml` tắt gateway JWT riêng cho function này: route gửi vẫn bắt buộc Bearer `REMINDER_CRON_SECRET`; route hủy đăng ký dùng token ngẫu nhiên chỉ có quyền tắt lịch. Không có route gửi thử dành cho trình duyệt. Không cần thêm dependency npm hoặc SDK Resend.

## 4. Lên lịch và kích hoạt

Trong Supabase Vault, tạo hai secrets (không ghi giá trị thật vào file SQL):

- `n3vjit_project_url`: Project URL, không có dấu `/` ở cuối.
- `n3vjit_reminder_cron_secret`: đúng chuỗi `REMINDER_CRON_SECRET` đã đặt cho function.

Chạy `setup-reminder-cron.sql`. Tác vụ gọi Edge Function mỗi phút; tác vụ dọn nhật ký xóa dữ liệu gửi quá 30 ngày. Kiểm tra Supabase Cron / Edge Function logs không có lỗi cấu hình, sau đó chạy riêng:

```sql
update public.n3vjit_reminder_runtime set enabled = true where id;
```

Người học đăng nhập → Tài khoản → tải lại cài đặt, bật từng ngày và đặt giờ riêng (mặc định 20:00), rồi tự bật email. Lịch luôn dùng múi giờ `Asia/Ho_Chi_Minh`; **chưa bật gửi** theo mặc định. Để kiểm tra thực tế, dùng chính email đã xác nhận của bạn và tự bật một lịch vài phút sau thời điểm hiện tại. Sau khi kiểm tra có thể tắt lịch ngay trong tài khoản. Việc cấu hình backend không tự đăng ký mọi tài khoản nhận email.

Khi deploy lại code cần giữ tương thích payload trong cửa sổ retry; payload đầu tiên được lưu và dùng lại cùng `Idempotency-Key`. Đừng đổi nhà cung cấp trong lúc còn lượt gửi chưa kết thúc.

## Cách hoạt động và giới hạn

- Lịch lưu trên server nên vẫn chạy khi đóng website. Mỗi ngày có giờ riêng theo múi giờ `Asia/Ho_Chi_Minh`, không phụ thuộc timezone của server. Ngày Chủ nhật có mã 0, thứ Hai 1…thứ Bảy 6.
- Một lượt nhắc cho mỗi tài khoản/ngày địa phương, kể cả thay đổi lịch hoặc khi đổi giờ mùa hè. Không bù dồn lịch quá 15 phút; hệ thống ngừng lâu có thể bỏ lỡ buổi nhắc.
- Claim nguyên tử với lease 5 phút, tối đa 3 lần thử trong cửa sổ 15 phút, tối thiểu 2 phút giữa các lần gửi lỗi. Kiểm tra lại email, trạng thái bật và phiên bản lịch ngay trước gửi; lịch đã đổi sẽ hủy lượt cũ. Đổi lịch trong sát thời điểm gửi có thể không ngăn email đã chuyển cho nhà cung cấp.
- Payload và mã idempotency được giữ nguyên khi retry. Resend giữ idempotency key 24 giờ, dài hơn cửa sổ retry của ứng dụng.
- Mỗi lần gọi xử lý tối đa 20 lịch và ngân sách vòng lặp 40 giây, giãn ít nhất 600ms giữa lần gửi. Đây là cấu hình phù hợp quy mô nhỏ; cần theo dõi quota/lỗi/độ trễ và mở rộng hàng đợi khi có nhiều người học cùng giờ. Mã HTTP 200 của worker có thể vẫn có `failed`; kiểm tra cả JSON trả về và bảng `n3vjit_reminder_deliveries` bằng quyền quản trị.
- `sent` trong ledger / `accepted` trong response nghĩa là nhà cung cấp đã nhận yêu cầu, không bảo đảm email đã vào hộp thư. Chưa tích hợp webhook bounce/delivery; không tự gửi thêm email nếu đã được nhà cung cấp nhận.
- Email có link hủy đăng ký. Mở link chỉ hiện xác nhận; nhấn nút mới tắt, tránh bot quét link làm tắt nhầm. Hỗ trợ `List-Unsubscribe` one-click POST từ ứng dụng email. Chỉ tắt lịch, không xóa tài khoản/tiến độ.
- Lịch nhắc không nằm trong file sao lưu tiến độ. Địa chỉ nhận cập nhật theo email đã xác nhận trong Supabase, không cho nhập email người khác.

Dừng toàn bộ gửi, giữ lịch của người học:

```sql
update public.n3vjit_reminder_runtime set enabled = false where id;
```

Gỡ cron nếu không dùng nữa:

```sql
select cron.unschedule('n3vjit-study-reminders');
select cron.unschedule('n3vjit-reminder-cleanup');
```

## Kiểm tra mã nguồn

```bash
node src/utils/studyReminders.test.js
npm test
npm run build
```

Unit test giả lập database/provider, không gửi email thật. Cần kiểm tra migration, cron và một lịch tự đăng ký trên project Supabase thực sau triển khai; build frontend không thực hiện các bước đó.

Tham khảo: [Supabase scheduling + Vault](https://supabase.com/docs/guides/functions/schedule-functions), [Resend Send Email](https://resend.com/docs/api-reference/emails/send-email), [idempotency 24 giờ](https://resend.com/docs/dashboard/emails/idempotency-keys), [giới hạn sender thử nghiệm](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain).
