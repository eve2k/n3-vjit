# Chạy website với DuckDNS và cổng 4173

Địa chỉ được cấu hình:

```text
http://chungchitiengnhatvjit.duckdns.org:4173
```

Domain được kiểm tra trỏ về IP công khai `42.115.33.237` tại thời điểm thiết lập. Máy chủ chạy Caddy, phục vụ bản build `dist`, có fallback cho các route React như `/quiz`, `/exam`, `/login`. Không dùng Vite preview để phục vụ domain công khai.

## Ba lớp cấu hình kết nối

1. **DuckDNS:** bản ghi A phải trùng IP WAN hiện tại. Nếu IP Internet thay đổi, DuckDNS cần được cập nhật bằng router hoặc một tác vụ dùng token riêng. Phiên thiết lập này chưa cấu hình tác vụ cập nhật IP tự động và không cần token để phục vụ domain đang trỏ đúng IP.
2. **Router:** TCP ngoài `4173` chuyển đến `192.168.1.105:4173`. Nên giữ IP LAN của laptop server ổn định bằng DHCP reservation.
3. **Firewall server:** UFW phải cho phép TCP `4173`. Tài khoản `eve` hiện không được dùng sudo, nên cần root/tài khoản quản trị chạy:

```bash
sudo ufw allow 4173/tcp
sudo ufw status
```

Nếu đã ở shell root, bỏ `sudo`. Không cần tắt toàn bộ firewall.

Sau đó kiểm tra bằng 4G hoặc mạng khác:

```text
http://chungchitiengnhatvjit.duckdns.org:4173
```

Một số router không hỗ trợ truy cập IP WAN từ chính LAN (NAT loopback), nên thử bằng 4G để phân biệt với lỗi port forwarding/firewall.

## Dịch vụ trên server

Caddy được cài riêng cho `eve` tại `~/.local/bin/caddy`. Cấu hình hoạt động ở `~/.config/n3-vjit/Caddyfile`, unit ở `~/.config/systemd/user/n3-vjit-web.service`. Các mẫu cấu hình tương ứng nằm trong thư mục `deploy/` của project.

```bash
systemctl --user status n3-vjit-web.service --no-pager
systemctl --user restart n3-vjit-web.service
journalctl --user -u n3-vjit-web.service -n 50 --no-pager
```

User lingering đã bật, dịch vụ web được enable để tiếp tục sau khi đóng SSH và khởi động lại. Dịch vụ `n3-vjit-preview.service` cũ đã disable để không tranh cổng 4173. Đường hầm SSH cũ vẫn dùng được với `http://127.0.0.1:4173` trên laptop code.

## Build lại sau khi sửa code

Đợi Syncthing báo Up to Date, rồi trên server:

```bash
cd /home/eve/workspace/website/n3-vjit-webapp
bash scripts/rebuild-server.sh
```

Script kiểm tra Caddyfile, build lại, cập nhật cấu hình và restart dịch vụ web. Lệnh `bash scripts/rebuild-server-preview.sh` cũ vẫn chuyển tới script mới để tương thích.

## Supabase và HTTPS

Để liên kết xác nhận email/khôi phục mật khẩu trở về đúng website, trong Supabase → Authentication → URL Configuration, thêm Redirect URL:

```text
http://chungchitiengnhatvjit.duckdns.org:4173/auth/callback
```

Site URL có thể đặt thành `http://chungchitiengnhatvjit.duckdns.org:4173` khi chọn domain này làm địa chỉ chính. Đăng nhập bằng mật khẩu vẫn gửi trực tiếp đến Supabase qua HTTPS.

Cấu hình hiện tại phục vụ **HTTP**, chưa cấp chứng chỉ HTTPS. Khi dùng cho người học thật, nên bổ sung HTTPS và đổi các URL Supabase sang HTTPS. Chứng chỉ có thể xác minh qua cổng 80/443 hoặc DNS-01 nếu chỉ giữ cổng 4173; DNS-01 với DuckDNS cần token đặt riêng trên server, không đưa vào Git/biến `VITE_*` hoặc mã frontend.

Tham khảo: [DuckDNS API](https://www.duckdns.org/spec.jsp), [Caddy static/SPAs](https://caddyserver.com/docs/caddyfile/patterns).
