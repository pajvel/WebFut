# WebFut

Telegram WebApp для организации футбольных матчей с рейтингами, генерацией команд, лайв‑событиями и фидбеком после игры.

## Функционал (подробнее)
### Для игроков
- Вход через Telegram WebApp (`initData`).
- Профиль: имя, аватар, персональные настройки.
- Просмотр ленты матчей и деталей конкретного матча.
- Участие в матче: вступить/выйти/наблюдать.
- Лайв‑события: голы и автоголы, правка и удаление событий.
- Фидбек после матча: быстрый и расширенный.
- Работа с платежами внутри матча: выбор плательщика и подтверждение.

### Для организаторов матча
- Создание матча и управление составом участников.
- Старт/финиш матча, добавление сегментов, повтор матча.
- Генерация вариантов команд и выбор рекомендованного.
- Создание кастомных команд и откат к предыдущему варианту.

### Для администраторов
- Управление пользователями и их статусом.
- Просмотр и правка состояния модели рейтинга.
- Перестроение состояния модели и логов рейтинга/взаимодействий.
- Админ‑операции по матчам (участники, сегменты, удаление).

### Модель команд и рейтингов
- Учет общего и площадочного рейтинга игрока.
- Взвешенная оценка силы команды для балансировки.
- Логика анти‑буста и ограничение изменений рейтинга (cap).
- Быстрый и расширенный фидбек влияет на модель через отдельные механики.

## Стек
- Backend: Flask 3, SQLAlchemy 2, psycopg3, gunicorn
- Frontend: React 18, Vite 5, TypeScript, Tailwind, Radix UI, Framer Motion
- Модель: `backend/team_model` (рейтинг + генерация команд)

## Структура проекта
- `backend/` — API, модели БД, team_model, сидинг
- `frontend/` — React приложение (Vite)
- `entrypoint.sh` — продовый запуск (gunicorn)
- `pytest.ini` — настройка тестов

## Требования
- Python 3.11+ (3.12 рекомендован; 3.13 работает, но возможны warnings)
- Node.js 18+
- PostgreSQL (или другая БД через SQLAlchemy)

## Окружение
Создай `.env` в `backend/` или в корне:
```
DATABASE_URL=postgresql+psycopg://user:password@host:5432/dbname
TELEGRAM_BOT_TOKEN=...
ADMIN_TG_ID=123456
AUTO_SEED=1
```

Опционально:
- `UPLOADS_DIR` (по умолчанию `backend/uploads`)
- `DEV_AUTH_BYPASS=1` (работает только при `FLASK_ENV=development`)
- `DEV_TG_ID`, `DEV_TG_NAME`, `DEV_TG_AVATAR`
- `DEFAULT_CONTEXT_ID`, `DEFAULT_CONTEXT_TITLE`
- `MODEL_STATE_TABLE`, `SQLALCHEMY_ECHO`

## Backend: запуск
```
py -3.11 -m pip install -r backend/requirements.txt
py -3.11 -m flask --app backend/wsgi:app run --host 0.0.0.0 --port 8000
```

Продовый entrypoint:
```
./entrypoint.sh
```

API доступен по `/api`.
Healthcheck: `GET /api/health`.

## Frontend: запуск
```
cd frontend
npm install
npm run dev
```

Сборка:
```
npm run build
```

Backend раздает `frontend/dist` как статику.

## Обзор API
Base: `/api`
- Auth: `POST /auth/telegram`
- Me/profile: `GET /me`, `PATCH /me`, `GET /me/profile`
- Matches: `GET /matches`, `POST /matches`, `POST /matches/<id>/join`, `POST /matches/<id>/start`, `POST /matches/<id>/finish`
- Teams: `POST /matches/<id>/teams/generate`, `POST /matches/<id>/teams/select`
- Events: `POST /matches/<id>/events/goal`, `PATCH /matches/<id>/events/<event_id>`
- Feedback: `GET /matches/<id>/feedback`, `POST /matches/<id>/feedback`
- Payments: `POST /matches/<id>/payer/request`, `POST /matches/<id>/payments/confirm`
- Admin: `GET /admin/users`, `POST /admin/state/rebuild`, `GET /admin/rating-logs`

## Тесты
```
py -m pytest backend
```

## Заметки
- Для защищенных маршрутов нужен заголовок `X-Telegram-InitData`.
- Авто‑сидинг происходит при первом старте, если `AUTO_SEED=1` и БД пустая.
