#!/usr/bin/env python3
"""Reset DB and seed 7 historical games from run_prediction_game6.py."""
from __future__ import annotations

import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
BACKEND = pathlib.Path(__file__).resolve().parents[1]
for path in (ROOT, BACKEND):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

from app.seed import ensure_schema, seed


def main() -> None:
    ensure_schema()
    seed(reset=True)
    print("Seed complete: 7 historical matches + model_state")


if __name__ == "__main__":
    main()
