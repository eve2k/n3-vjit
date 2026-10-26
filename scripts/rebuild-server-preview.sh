#!/usr/bin/env bash
set -euo pipefail

n3_script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
exec bash "$n3_script_dir/rebuild-server.sh"
