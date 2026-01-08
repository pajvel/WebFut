import json

from flask import Blueprint, request

from ..auth import _check_telegram_init_data, _get_or_create_dev_user
from ..config import Config
from ..db import get_db
from ..models import User, UserSettings
from ..utils import err, ok

bp = Blueprint("auth", __name__, url_prefix="/auth")


@bp.post("/telegram")
def auth_telegram():
    data = request.get_json(silent=True) or {}
    init_data = data.get("initData", "")
    
    print(f"[AUTH] Received initData length: {len(init_data)}")
    print(f"[AUTH] DEV_AUTH_BYPASS: {Config.DEV_AUTH_BYPASS}")
    
    if Config.DEV_AUTH_BYPASS:
        if not init_data:
            user = _get_or_create_dev_user()
            return ok({"tg_id": user.tg_id, "dev": True})
        try:
            from urllib.parse import parse_qsl
            parsed = dict(parse_qsl(init_data, strict_parsing=True))
            user_json = parsed.get("user")
            if user_json:
                user_data = json.loads(user_json)
                print(f"[AUTH DEV] Bypassing hash check, user: {user_data.get('id')}")
                db = get_db()
                user = db.query(User).filter_by(tg_id=user_data["id"]).one_or_none()
                if user is None:
                    user = User(
                        tg_id=user_data["id"],
                        tg_name=user_data.get("first_name", ""),
                        tg_avatar=user_data.get("photo_url"),
                    )
                    db.add(user)
                    db.add(UserSettings(tg_id=user_data["id"]))
                else:
                    user.tg_name = user_data.get("first_name", "")
                    user.tg_avatar = user_data.get("photo_url")
                db.commit()
                return ok({"tg_id": user.tg_id})
        except Exception as e:
            print(f"[AUTH DEV ERROR] {e}")
    
    print(f"[AUTH] Full initData: {init_data}")
    print(f"[AUTH] Bot token configured: {bool(Config.TELEGRAM_BOT_TOKEN)}")
    print(f"[AUTH] Bot token: {Config.TELEGRAM_BOT_TOKEN[:20]}...")
    print(f"[AUTH] Full bot token: {Config.TELEGRAM_BOT_TOKEN}")
    try:
        parsed = _check_telegram_init_data(init_data, Config.TELEGRAM_BOT_TOKEN)
    except ValueError as exc:
        print(f"[AUTH ERROR] {exc}")
        return err(f"initData не совпадает с токеном бота. Проверь TELEGRAM_BOT_TOKEN", 401)

    user_json = parsed.get("user")
    if not user_json:
        return err("user_missing", 400)

    user_data = json.loads(user_json)
    db = get_db()
    user = db.query(User).filter_by(tg_id=user_data["id"]).one_or_none()
    tg_avatar = user_data.get("photo_url")
    if isinstance(tg_avatar, str):
        tg_avatar = tg_avatar.replace("\\/", "/")
    if user is None:
        user = User(
            tg_id=user_data["id"],
            tg_name=user_data.get("first_name", ""),
            tg_avatar=tg_avatar,
        )
        db.add(user)
        db.add(UserSettings(tg_id=user_data["id"]))
    else:
        user.tg_name = user_data.get("first_name", "")
        user.tg_avatar = tg_avatar
    db.commit()
    return ok({"tg_id": user.tg_id})
