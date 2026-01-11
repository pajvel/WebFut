import importlib.util
import pathlib
import pytest
from datetime import datetime, timedelta, timezone

from flask import Flask


BASE_DIR = pathlib.Path(__file__).resolve().parents[2]
UTILS_PATH = BASE_DIR / "app" / "utils.py"
spec = importlib.util.spec_from_file_location("app_utils", UTILS_PATH)
utils = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(utils)
err = utils.err
now_utc = utils.now_utc
ok = utils.ok


def test_ok_and_err_responses():
    app = Flask(__name__)
    with app.app_context():
        ok_response, ok_status = ok({"value": 1}, status=201)
        err_response, err_status = err("bad", status=400)

    assert ok_status == 201
    assert ok_response.get_json() == {"ok": True, "value": 1}
    assert err_status == 400
    assert err_response.get_json() == {"ok": False, "error": "bad"}


def test_now_utc_is_recent():
    with pytest.warns(DeprecationWarning, match="utcnow"):
        before = datetime.utcnow() - timedelta(seconds=1)
        value = now_utc()
        after = datetime.utcnow() + timedelta(seconds=1)
        assert before <= value <= after
