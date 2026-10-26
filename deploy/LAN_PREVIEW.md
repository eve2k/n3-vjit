# Truy cập website trên laptop server

Server hiện dùng **Caddy** với dịch vụ `n3-vjit-web.service`. UFW đã mở TCP 4173. Cấu hình và hướng dẫn hiện hành nằm ở [DUCKDNS.md](DUCKDNS.md).

- Từ Internet / 4G: `http://chungchitiengnhatvjit.duckdns.org:4173`.
- Trong cùng LAN: `http://192.168.1.105:4173`.
- Qua đường hầm SSH trên laptop code: `http://127.0.0.1:4173`, nếu tunnel đang chạy.

Nếu domain không vào được từ chính Wi-Fi nhưng từ 4G vẫn được, có thể router thiếu NAT loopback. Khi đó dùng địa chỉ LAN trong nhà.

## Đường hầm SSH tùy chọn

Có thể mở lại đường hầm bằng lệnh sau và giữ terminal đó chạy:

```bash
ssh -N -L 127.0.0.1:4173:127.0.0.1:4173 eve@192.168.1.105
```

Để đóng đường hầm nền đã tạo trong phiên thiết lập ban đầu:

```bash
ssh -S /tmp/n3-vjit-preview-tunnel.sock -O exit eve@192.168.1.105
```

## Build lại và quản lý dịch vụ

Sau khi Syncthing đã đồng bộ, trên server chạy:

```bash
cd /home/eve/workspace/website/n3-vjit-webapp
bash scripts/rebuild-server.sh
systemctl --user status n3-vjit-web.service --no-pager
```

Lệnh `bash scripts/rebuild-server-preview.sh` cũ vẫn chuyển tới script build hiện tại. Dịch vụ Vite preview cũ đã disable để tránh tranh cổng 4173; không bật lại trong khi Caddy đang dùng cổng này.

Node.js/dependencies/dist và `.env.local` nằm riêng trên server. Caddy và user lingering cho phép web tiếp tục chạy sau khi đóng SSH và khởi động lại máy. Cấu hình HTTP hiện tại chưa có HTTPS; xem phần Supabase và HTTPS trong [hướng dẫn DuckDNS](DUCKDNS.md).
