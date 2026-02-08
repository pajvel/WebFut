from sqlalchemy import create_engine
from sqlalchemy.orm import scoped_session, sessionmaker

from .config import Config


engine = create_engine(Config.DATABASE_URL, echo=Config.SQLALCHEMY_ECHO, pool_pre_ping=True)
SessionLocal = scoped_session(sessionmaker(bind=engine, autoflush=False, autocommit=False))


def get_db():
    return SessionLocal()
