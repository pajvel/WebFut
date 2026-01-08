from datetime import datetime

from flask import jsonify


def ok(payload: dict | None = None, status: int = 200):
    data = payload or {}
    return jsonify({"ok": True, **data}), status


def err(message: str, status: int = 400):
    return jsonify({"ok": False, "error": message}), status


def now_utc() -> datetime:
    return datetime.utcnow()
