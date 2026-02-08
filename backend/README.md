# Backend (Flask)

Minimal Flask backend for Telegram WebApp.

Python version: 3.11 (preferred) or 3.12.

## Env
- `DATABASE_URL` (PostgreSQL, use psycopg v3 URL)
- `TELEGRAM_BOT_TOKEN`
- `ADMIN_TG_ID`
- `AUTO_SEED=1` (auto-seed DB on first run; set to 0 to disable)

## Run
Example `DATABASE_URL`:
```
postgresql+psycopg://user:password@host:5432/dbname
```

```
py -3.11 -m pip install -r requirements.txt
py -3.11 -m gunicorn -c gunicorn.conf.py wsgi:app
```

API is served under `/api`. Static frontend assets are served from `frontend/dist`.
Healthcheck: `GET /api/health`.

Entry point: run `entrypoint.sh` from repo root.

For dev:
```
py -3.11 -m flask --app wsgi:app run --host 0.0.0.0 --port 8000
```
