from __future__ import annotations

from datetime import datetime, timedelta
from threading import Lock


_LOCK = Lock()
_WINDOWS: dict[str, datetime] = {}


def allow(key: str, cooldown_seconds: int) -> bool:
    """Simple in-memory cooldown gate for high-frequency user actions."""
    if cooldown_seconds <= 0:
        return True
    now = datetime.utcnow()
    with _LOCK:
        expires_at = _WINDOWS.get(key)
        if expires_at and expires_at > now:
            return False
        _WINDOWS[key] = now + timedelta(seconds=cooldown_seconds)
    return True
