from __future__ import annotations

import os
import time
from threading import Lock


# Use a simple file-based approach so cooldowns survive across workers.
# Falls back to in-memory if the lock file directory is not writable.

_LOCK = Lock()
_WINDOWS: dict[str, float] = {}
_FILE_DIR = os.getenv("RATE_LIMIT_DIR", "")


def _file_path(key: str) -> str:
    safe_key = key.replace("/", "_").replace(":", "_").replace("\\", "_")
    return os.path.join(_FILE_DIR, f".rl_{safe_key}")


def allow(key: str, cooldown_seconds: int) -> bool:
    """Cooldown gate for high-frequency user actions.

    If RATE_LIMIT_DIR is set, uses file-based timestamps that work across
    multiple gunicorn workers. Otherwise falls back to in-memory dict.
    """
    if cooldown_seconds <= 0:
        return True
    now = time.time()

    if _FILE_DIR:
        try:
            path = _file_path(key)
            try:
                mtime = os.path.getmtime(path)
                if now - mtime < cooldown_seconds:
                    return False
            except FileNotFoundError:
                pass
            # Touch the file to record this action
            with open(path, "w") as f:
                f.write("")
            return True
        except OSError:
            pass  # Fall through to in-memory

    with _LOCK:
        expires_at = _WINDOWS.get(key, 0)
        if expires_at > now:
            return False
        _WINDOWS[key] = now + cooldown_seconds
    return True
