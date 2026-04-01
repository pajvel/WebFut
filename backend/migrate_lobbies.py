import os
import sys

# Добавляем родительскую директорию в PYTHONPATH для импортов
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.config import Config
from app.models import Context, ContextMember, User, LobbyRole


def run_migration():
    print(f"Connecting to {Config.DATABASE_URL}...")
    engine = create_engine(Config.DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()

    try:
        # 1. Добавляем колонку password
        try:
            db.execute(text("ALTER TABLE contexts ADD COLUMN password VARCHAR NULL;"))
            print("Column 'password' added to contexts.")
        except Exception as e:
            db.rollback()
            print("Column 'password' might already exist or error:", e)
        
        # 2. Делаем title уникальным
        try:
            # Сначала проверим, есть ли дубликаты
            duplicates = db.execute(text("SELECT title, COUNT(*) FROM contexts GROUP BY title HAVING COUNT(*) > 1")).fetchall()
            for dup in duplicates:
                title = dup[0]
                rows = db.query(Context).filter_by(title=title).all()
                for i, row in enumerate(rows[1:], start=1):
                    row.title = f"{title}_{i}"
            db.commit()

            db.execute(text("ALTER TABLE contexts ADD CONSTRAINT uq_contexts_title UNIQUE (title);"))
            print("Unique constraint added to contexts.title.")
        except Exception as e:
            db.rollback()
            print("Constraint 'uq_contexts_title' might already exist or error:", e)

        # 3. Мигрируем всех существующих пользователей в лобби 1 (если его нет - создадим)
        default_context = db.query(Context).filter_by(id=1).one_or_none()
        if not default_context:
            default_context = Context(id=1, title=Config.DEFAULT_CONTEXT_TITLE)
            db.add(default_context)
            db.flush()
            print("Created default Context 1.")

        users = db.query(User).all()
        added_count = 0
        for user in users:
            member = db.query(ContextMember).filter_by(context_id=1, tg_id=user.tg_id).one_or_none()
            if not member:
                member = ContextMember(context_id=1, tg_id=user.tg_id, role=LobbyRole.PLAYER.value)
                db.add(member)
                added_count += 1
            
            # Установим лобби по умолчанию, если оно не задано
            if not user.default_context_id:
                user.default_context_id = 1

        db.commit()
        print(f"Migration completed successfully. Added {added_count} users to Context 1.")

    except Exception as e:
        db.rollback()
        print(f"Migration failed: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    run_migration()
