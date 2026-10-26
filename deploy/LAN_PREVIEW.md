# Bản chạy thử trên laptop server

**Cập nhật:** server đã chuyển sang Caddy với domain DuckDNS. Xem [cấu hình domain, firewall và dịch vụ đang dùng](DUCKDNS.md). Dịch vụ Vite preview mô tả bên dưới hiện được giữ làm phương án thử trước đây và đã disable; đường hầm SSH vẫn dùng được với Caddy trên cùng cổng 4173.

URL dùng thử ngay trên laptop code: **http://127.0.0.1:4173**. Website chạy trên laptop server, truy cập qua đường hầm SSH từ laptop code.

Server phục vụ tại `http://192.168.1.105:4173`, nhưng UFW hiện chưa cho phép kết nối từ LAN vào cổng 4173. Tài khoản `eve` không có quyền sudo nên bước chạy thử dùng đường hầm SSH, giữ nguyên cấu hình firewall.

- Mã nguồn: `/home/eve/workspace/website/n3-vjit-webapp`.
- Node.js 22 LTS được cài riêng cho `eve` tại `~/.local/opt/`, các lệnh ở `~/.local/bin/`.
- Dependencies và `dist` được tạo trên server; không chuyển qua Syncthing hoặc Git.
- `.env.local` riêng trên server chứa hai biến Supabase công khai dùng khi build, quyền 600. File này không được đồng bộ. Không đặt secret/service-role key vào frontend.
- Chạy bằng systemd user service `n3-vjit-preview.service`, user lingering được bật để dịch vụ tiếp tục khi đóng SSH và có thể khởi động sau reboot.

Đây là **Vite preview để thử trên LAN**, chưa phải cấu hình hosting Internet. Trước khi triển khai công khai cần dùng máy chủ phục vụ static phù hợp và cấu hình tên miền/HTTPS.

## Truy cập qua SSH

Đường hầm hiện chạy nền trên laptop code. Nếu đóng tunnel hoặc khởi động lại laptop code, có thể mở lại bằng lệnh sau và giữ terminal đó chạy:

```bash
ssh -N -L 127.0.0.1:4173:127.0.0.1:4173 eve@192.168.1.105
```

Sau đó mở `http://127.0.0.1:4173`. Lệnh không cần ghi mật khẩu vào file hoặc script.

Để đóng đường hầm nền đã tạo trong phiên thiết lập:

```bash
ssh -S /tmp/n3-vjit-preview-tunnel.sock -O exit eve@192.168.1.105
```

## Mở trực tiếp từ các máy trong LAN

Một tài khoản có quyền quản trị trên server có thể cho phép riêng mạng LAN hiện tại:

```bash
sudo ufw allow from 192.168.1.0/24 to any port 4173 proto tcp
```

Sau đó kiểm tra từ máy khác bằng `http://192.168.1.105:4173`. Nếu mạng dùng subnet khác, thay CIDR tương ứng. Cấu hình này không tự mở router ra Internet.

## Sau khi sửa mã nguồn

Đợi Syncthing báo Up to Date, rồi trên server chạy:

```bash
cd /home/eve/workspace/website/n3-vjit-webapp
bash scripts/rebuild-server-preview.sh
```

Bản preview phục vụ `dist`, nên chỉnh source xong phải build lại mới hiện thay đổi. Khi `package-lock.json` thay đổi, cài lại dependencies trước:

```bash
export PATH="$HOME/.local/bin:$PATH"
npm ci --include=optional --no-audit --no-fund
bash scripts/rebuild-server-preview.sh
```

## Quản lý dịch vụ

```bash
systemctl --user status n3-vjit-preview.service --no-pager
systemctl --user restart n3-vjit-preview.service
systemctl --user stop n3-vjit-preview.service
journalctl --user -u n3-vjit-preview.service -n 50 --no-pager
```

Mẫu unit nằm ở `deploy/n3-vjit-preview.service`. Bản đang dùng trên server ở `~/.config/systemd/user/n3-vjit-preview.service`.

## Đăng nhập và xác nhận email

Đăng nhập email/mật khẩu vẫn gọi Supabase qua HTTPS. Nếu thử đăng ký, xác nhận email hoặc khôi phục mật khẩu, thêm các Redirect URL tương ứng trong Supabase → Authentication → URL Configuration:

```text
http://127.0.0.1:4173/auth/callback
http://192.168.1.105:4173/auth/callback
```

Người dùng và tiến độ dùng cùng project Supabase đã cấu hình. Bộ nhớ trình duyệt của địa chỉ LAN khác với `localhost`; đăng nhập cùng tài khoản để lấy tiến độ đã đồng bộ. Chế độ khách vẫn không lưu tiến độ.

Phần tạo ID phiên học/đề thi có dự phòng bằng `crypto.getRandomValues`, hỗ trợ mở thử qua HTTP LAN nơi `crypto.randomUUID` có thể không khả dụng.
