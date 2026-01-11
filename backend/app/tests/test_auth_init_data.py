import hashlib
import hmac
import importlib.util
import json
import os
import pathlib
import sys
import time
import types
from urllib.parse import urlencode

import pytest


BASE_DIR = pathlib.Path(__file__).resolve().parents[2]
AUTH_PATH = BASE_DIR / "app" / "auth.py"

os.environ.setdefault("DATABASE_URL", "sqlite+pysqlite:///:memory:")

if "app" not in sys.modules:
    pkg = types.ModuleType("app")
    pkg.__path__ = [str(BASE_DIR / "app")]
    sys.modules["app"] = pkg

spec = importlib.util.spec_from_file_location("app.auth", AUTH_PATH)
auth = importlib.util.module_from_spec(spec)
sys.modules["app.auth"] = auth
assert spec.loader is not None
spec.loader.exec_module(auth)
_check_telegram_init_data = auth._check_telegram_init_data


def _make_init_data(payload: dict, bot_token: str) -> str:
    data = dict(payload)
    data_check = "\n".join(f"{k}={v}" for k, v in sorted(data.items()))
    secret_key = hmac.new(b"WebAppData", bot_token.encode("utf-8"), hashlib.sha256).digest()
    data["hash"] = hmac.new(secret_key, data_check.encode("utf-8"), hashlib.sha256).hexdigest()
    return urlencode(data)


def test_check_telegram_init_data_valid():
    bot_token = "bot-token"
    payload = {
        "auth_date": str(int(time.time())),
        "user": json.dumps({"id": 123, "first_name": "Dev"}, separators=(",", ":")),
    }
    init_data = _make_init_data(payload, bot_token)
    parsed = _check_telegram_init_data(init_data, bot_token)
    assert parsed["user"]
    assert parsed["auth_date"] == payload["auth_date"]


def test_check_telegram_init_data_hash_missing():
    payload = {"auth_date": "1", "user": "{}"}
    init_data = urlencode(payload)
    with pytest.raises(ValueError, match="hash_missing"):
        _check_telegram_init_data(init_data, "token")


def test_check_telegram_init_data_hash_mismatch():
    payload = {"auth_date": str(int(time.time())), "user": "{}"}
    init_data = urlencode({**payload, "hash": "bad"})
    with pytest.raises(ValueError, match="hash_mismatch"):
        _check_telegram_init_data(init_data, "token")


def test_check_telegram_init_data_auth_date_invalid():
    bot_token = "bot-token"
    payload = {
        "auth_date": "not-a-number",
        "user": json.dumps({"id": 1}, separators=(",", ":")),
    }
    init_data = _make_init_data(payload, bot_token)
    with pytest.raises(ValueError, match="auth_date_invalid"):
        _check_telegram_init_data(init_data, bot_token)


def test_check_telegram_init_data_auth_date_expired(monkeypatch):
    bot_token = "bot-token"
    old_timestamp = 1000
    monkeypatch.setattr(time, "time", lambda: old_timestamp + 60 * 60 * 24 * 2)
    payload = {
        "auth_date": str(old_timestamp),
        "user": json.dumps({"id": 1}, separators=(",", ":")),
    }
    init_data = _make_init_data(payload, bot_token)
    with pytest.raises(ValueError, match="auth_date_expired"):
        _check_telegram_init_data(init_data, bot_token)
