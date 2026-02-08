import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
BACKEND = pathlib.Path(__file__).resolve().parent
for path in (ROOT, BACKEND):
    if str(path) not in sys.path:
        sys.path.insert(0, str(path))

from app import create_app

app = create_app()
