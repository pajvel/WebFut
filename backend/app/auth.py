import hashlib
import hmac
import json
from urllib.parse import parse_qsl

from flask import request

from .config import Config
from .db import get_db
from .models import User, UserSettings


def _check_telegram_init_data(init_data: str, bot_token: str) -> dict:
    if not init_data:
        raise ValueError("init_data_missing")
    data = dict(parse_qsl(init_data, strict_parsing=True))
    provided_hash = data.pop("hash", None)
    if not provided_hash:
        raise ValueError("hash_missing")

    data_check = "\n".join(f"{k}={v}" for k, v in sorted(data.items()))
    secret_key = hmac.new(b"WebAppData", bot_token.encode("utf-8"), hashlib.sha256).digest()
    computed = hmac.new(secret_key, data_check.encode("utf-8"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(computed, provided_hash):
        raise ValueError("hash_mismatch")
    return data


def get_init_data() -> str:
    return request.headers.get("X-Telegram-InitData", "")


def _get_or_create_dev_user() -> User:
    db = get_db()
    user = db.query(User).filter_by(tg_id=Config.DEV_TG_ID).one_or_none()
    if user is None:
        user = User(
            tg_id=Config.DEV_TG_ID,
            tg_name=Config.DEV_TG_NAME,
            tg_avatar=Config.DEV_TG_AVATAR or None,
        )
        db.add(user)
        db.add(UserSettings(tg_id=Config.DEV_TG_ID))
    else:
        user.tg_name = Config.DEV_TG_NAME
        user.tg_avatar = Config.DEV_TG_AVATAR or None
    db.commit()
    return user


def require_user() -> User:
    init_data = get_init_data()
    if Config.DEV_AUTH_BYPASS and not init_data:
        return _get_or_create_dev_user()
    data = _check_telegram_init_data(init_data, Config.TELEGRAM_BOT_TOKEN)
    user_data = data.get("user")
    if not user_data:
        raise ValueError("user_missing")
    user_json = json.loads(user_data)
    db = get_db()
    user_id = int(user_json.get("id"))
    tg_name = user_json.get("first_name", "")
    tg_avatar = user_json.get("photo_url")
    if isinstance(tg_avatar, str):
        tg_avatar = tg_avatar.replace("\\/", "/")
    user = db.query(User).filter_by(tg_id=user_id).one_or_none()
    if user is None:
        user = User(tg_id=user_id, tg_name=tg_name, tg_avatar=tg_avatar)
        db.add(user)
        db.add(UserSettings(tg_id=user_id))
    else:
        user.tg_name = tg_name
        user.tg_avatar = tg_avatar
    db.commit()
    return user


def is_admin(user: User) -> bool:
    return user.tg_id == Config.ADMIN_TG_ID
