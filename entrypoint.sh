#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${ROOT_DIR}/backend"

export PYTHONUNBUFFERED=1
exec python -m gunicorn -c gunicorn.conf.py wsgi:app
