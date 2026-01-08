import os

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def _load_env() -> None:
    candidates = [
        os.path.join(BASE_DIR, ".env"),
        os.path.join(BASE_DIR, "backend", ".env"),
    ]
    for path in candidates:
        if not os.path.exists(path):
            continue
        with open(path, "r", encoding="utf-8") as handle:
            for raw in handle:
                line = raw.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                if key and key not in os.environ:
                    os.environ[key] = value


_load_env()


class Config:
    DATABASE_URL = os.getenv("DATABASE_URL", "")
    TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
    ADMIN_TG_ID = int(os.getenv("ADMIN_TG_ID", "0"))
    MODEL_STATE_TABLE = os.getenv("MODEL_STATE_TABLE", "model_states")
    SQLALCHEMY_ECHO = os.getenv("SQLALCHEMY_ECHO", "0") == "1"
    DEV_AUTH_BYPASS = os.getenv("DEV_AUTH_BYPASS", "0") == "1"
    DEV_TG_ID = int(os.getenv("DEV_TG_ID", "999000"))
    DEV_TG_NAME = os.getenv("DEV_TG_NAME", "Dev User")
    DEV_TG_AVATAR = os.getenv("DEV_TG_AVATAR", "")
    DEFAULT_CONTEXT_ID = int(os.getenv("DEFAULT_CONTEXT_ID", "1"))
    DEFAULT_CONTEXT_TITLE = os.getenv("DEFAULT_CONTEXT_TITLE", "Default")
    UPLOADS_DIR = os.getenv("UPLOADS_DIR", os.path.join(BASE_DIR, "uploads"))
    AUTO_SEED = os.getenv("AUTO_SEED", "1") == "1"
