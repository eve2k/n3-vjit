# Đồng bộ mã nguồn với laptop server

Folder ID: `n3-vjit-webapp`, nhãn **N3 VJIT - source**, đồng bộ hai chiều.

| Máy | Đường dẫn |
| --- | --- |
| Laptop code | `/home/eve/Documents/workspace-debian/nn13/n3-vjit-webapp` |
| Laptop server qua SSH | `/home/eve/workspace/website/n3-vjit-webapp` |
| Đường dẫn thật trên server | `/DATA/AppData/syncthing/config/workspaces/n3-vjit-webapp` |
| Bên trong container Syncthing | `/config/workspaces/n3-vjit-webapp` |

Đường dẫn trên server qua SSH là symlink tới vùng dữ liệu bền vững đã được Docker mount sẵn. Tài khoản `eve` sở hữu thư mục và Syncthing chạy cùng UID 1000, nên cả hai đều đọc/ghi được. Không cần quyền sudo hoặc đổi quyền toàn bộ thư mục hệ thống.

## Các tệp được đồng bộ

Đồng bộ mã nguồn, tài nguyên, `package.json`, `package-lock.json`, tài liệu và `.env.example`. Các tệp dưới đây giữ riêng trên từng máy qua `.stignore` ở cả hai đầu:

- `node_modules`, `dist`, `dist-ssr`, `.vite`, `.cache`, `coverage`.
- `.git`, log, cache Supabase CLI.
- `.env`, `.env.*` (trừ `.env.example`), các tệp `*.local`.

Không sao chép `node_modules` giữa hai máy. Server hiện có Node.js và bản chạy thử, mở từ laptop code qua SSH tunnel tại `http://127.0.0.1:4173`; cổng LAN 4173 còn bị UFW chặn. Xem [cách truy cập, build lại và quản lý dịch vụ](deploy/LAN_PREVIEW.md). File `.env.local` của server được cấu hình riêng.

Website hiện phục vụ bằng Caddy, đã cấu hình domain `chungchitiengnhatvjit.duckdns.org:4173`. Xem [thiết lập DuckDNS và mở UFW](deploy/DUCKDNS.md) để truy cập trực tiếp từ Internet.

Syncthing không truyền quyền file (`ignorePerms` được bật) để mỗi máy giữ quyền phù hợp với người dùng chạy dịch vụ. Giữ tối đa 5 phiên bản trước của tệp bị thay đổi/xóa bởi máy bên kia trong `.stversions`; đây không thay thế bản sao lưu độc lập.

## Folder workspace cũ

Chia sẻ cũ `workspace debian` (ID `zda9h-mufnp`) trên server trỏ vào `/workspace_debian`, không tồn tại trong container và không được Docker mount. Chia sẻ đó được giữ cấu hình nhưng tạm dừng trên server. Trên laptop code, project `/nn13/n3-vjit-webapp` được loại khỏi chia sẻ cha để tránh hai folder Syncthing cùng quản lý một cây mã nguồn.

Cấu hình trước thay đổi được sao lưu ở `~/.local/state/n3-vjit-syncthing-backups/` trên mỗi máy, chỉ tài khoản `eve` đọc được. Không đưa thư mục sao lưu này vào Syncthing hoặc Git vì cấu hình chứa API key riêng của dịch vụ.

## Sử dụng

1. Code trên laptop chính và đợi folder **N3 VJIT - source** hiển thị **Up to Date** ở hai máy.
2. SSH tới server, mở `/home/eve/workspace/website/n3-vjit-webapp` để xem/cài dependency/build từ mã đã đồng bộ.
3. Nếu sửa nguồn trên server, Syncthing gửi lại về laptop code. Tránh sửa cùng một tệp đồng thời trên cả hai máy; nếu có `sync-conflict`, xem và hợp nhất nội dung trước khi xóa bản dư.
4. Đừng bấm Override/Revert để ép đồng bộ khi chưa xem các thay đổi cần giữ.

Laptop code thêm địa chỉ LAN `tcp://192.168.1.105:22000` cho thiết bị server, vẫn giữ discovery động. Syncthing GUI dùng các thiết lập xác thực hiện có; API key không nằm trong project.
