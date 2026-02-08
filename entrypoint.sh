#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${ROOT_DIR}/backend"

export PYTHONUNBUFFERED=1

PY_BIN="${ROOT_DIR}/backend/venv/bin/python"
if [[ -x "${PY_BIN}" ]]; then
  exec "${PY_BIN}" -m gunicorn -c gunicorn.conf.py wsgi:app
fi

if command -v python3 >/dev/null 2>&1; then
  exec python3 -m gunicorn -c gunicorn.conf.py wsgi:app
fi

exec python -m gunicorn -c gunicorn.conf.py wsgi:app
