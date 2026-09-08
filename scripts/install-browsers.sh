#!/usr/bin/env bash
set -euo pipefail
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd -- "$script_dir/.." && pwd)"
python="$project_root/.venv/bin/python"
if [[ ! -x "$python" ]]; then python="python3.13"; fi
exec "$python" "$script_dir/project.py" 'install-browsers' "$@"
