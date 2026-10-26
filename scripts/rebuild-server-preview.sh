#!/usr/bin/env bash
set -euo pipefail

n3_script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
n3_project_dir="$(cd -- "$n3_script_dir/.." && pwd)"
export PATH="$HOME/.local/bin:$PATH"
cd -- "$n3_project_dir"
npm run build
systemctl --user restart n3-vjit-preview.service
systemctl --user is-active n3-vjit-preview.service
