#!/usr/bin/env bash
set -euo pipefail

n3_script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
n3_project_dir="$(cd -- "$n3_script_dir/.." && pwd)"
export PATH="$HOME/.local/bin:$PATH"
cd -- "$n3_project_dir"

if systemctl --user is-enabled n3-vjit-web.service >/dev/null 2>&1; then
  caddy validate --config deploy/Caddyfile --adapter caddyfile
  npm run build
  install -m 600 deploy/Caddyfile "$HOME/.config/n3-vjit/Caddyfile"
  systemctl --user restart n3-vjit-web.service
  systemctl --user is-active n3-vjit-web.service
else
  npm run build
  systemctl --user restart n3-vjit-preview.service
  systemctl --user is-active n3-vjit-preview.service
fi
