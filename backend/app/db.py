from sqlalchemy import create_engine
from sqlalchemy.engine.url import make_url
from sqlalchemy.pool import NullPool
from sqlalchemy.orm import scoped_session, sessionmaker

from .config import Config


url = make_url(Config.DATABASE_URL)
is_sqlite = url.get_backend_name() == "sqlite"

engine_kwargs = {
    "echo": Config.SQLALCHEMY_ECHO,
    "pool_pre_ping": True,
}
if is_sqlite:
    engine_kwargs["poolclass"] = NullPool
else:
    engine_kwargs["pool_size"] = Config.DB_POOL_SIZE
    engine_kwargs["max_overflow"] = Config.DB_MAX_OVERFLOW
    engine_kwargs["pool_timeout"] = Config.DB_POOL_TIMEOUT
    engine_kwargs["pool_recycle"] = Config.DB_POOL_RECYCLE

engine = create_engine(Config.DATABASE_URL, **engine_kwargs)
SessionLocal = scoped_session(sessionmaker(bind=engine, autoflush=False, autocommit=False))


def get_db():
    return SessionLocal()
