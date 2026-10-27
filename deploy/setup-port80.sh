#!/usr/bin/env bash
set -euo pipefail
export PATH="/usr/sbin:/usr/bin:/sbin:/bin"
if [[ $(id -u) != 0 ]]; then echo 'Chạy script bằng root.' >&2; exit 1; fi
project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
gateway_config=/etc/casaos/gateway.ini
backup_file="${gateway_config}.n3-vjit-$(date +%Y%m%d%H%M%S).bak"
if ! grep -Eq '^port[[:space:]]*=[[:space:]]*80[[:space:]]*$' "$gateway_config"; then echo 'Cổng CasaOS không phải 80; dừng để kiểm tra.' >&2; exit 1; fi
if ss -H -ltn 'sport = :8080' | grep -q .; then echo 'Cổng 8080 đã được sử dụng.' >&2; exit 1; fi
if systemctl list-unit-files n3-vjit-port80.socket --no-legend | grep -q n3-vjit-port80; then echo 'Unit cổng 80 đã tồn tại; dừng để kiểm tra.' >&2; exit 1; fi
cp -p "$gateway_config" "$backup_file"
rollback() {
  status=$?
  if (( status != 0 )); then
    echo 'Thiết lập thất bại; khôi phục cấu hình CasaOS.' >&2
    systemctl disable --now n3-vjit-port80.socket n3-vjit-port80.service >/dev/null 2>&1 || true
    rm -f /etc/systemd/system/n3-vjit-port80.socket /etc/systemd/system/n3-vjit-port80.service
    systemctl daemon-reload
    cp -p "$backup_file" "$gateway_config"
    systemctl restart casaos-gateway.service || true
  fi
  exit "$status"
}
trap rollback EXIT
sed -i -E 's/^port[[:space:]]*=[[:space:]]*80[[:space:]]*$/port=8080/' "$gateway_config"
systemctl restart casaos-gateway.service
casaos_page="$(curl -fsS --max-time 10 http://127.0.0.1:8080/)"
grep -qi casaos <<< "$casaos_page"
install -m 644 "$project_dir/deploy/n3-vjit-port80.socket" /etc/systemd/system/n3-vjit-port80.socket
install -m 644 "$project_dir/deploy/n3-vjit-port80.service" /etc/systemd/system/n3-vjit-port80.service
systemctl daemon-reload
systemctl enable --now n3-vjit-port80.socket
curl -fsS --max-time 10 -H 'Host: chungchitiengnhatvjit.duckdns.org' http://127.0.0.1/ >/dev/null
if ufw status | grep -q '^Status: active'; then
  ufw allow 80/tcp
  ufw allow from 192.168.1.0/24 to any port 8080 proto tcp
fi
trap - EXIT
printf 'CasaOS: cổng 8080; C2J Study: cổng 80 và 4173. Sao lưu: %s\n' "$backup_file"
