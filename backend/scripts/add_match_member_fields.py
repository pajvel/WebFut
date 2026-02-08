#!/usr/bin/env python3
"""
Миграция для добавления новых полей в таблицу match_members:
- name: Имя игрока для матча
- rating: Рейтинг на момент матча  
- invited_by_tg_id: Кто позвал
"""

import sys
import os

# Добавляем путь к app директории
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'app'))

from app.db import get_db
from sqlalchemy import text

def add_match_member_fields():
    """Добавляет новые поля в таблицу match_members"""
    db = get_db()
    
    try:
        # Проверяем, существуют ли уже поля
        result = db.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'match_members' 
            AND column_name IN ('name', 'rating', 'invited_by_tg_id')
        """)).fetchall()
        
        existing_columns = [row[0] for row in result]
        
        # Добавляем поле name, если его нет
        if 'name' not in existing_columns:
            print("Добавляю поле 'name'...")
            db.execute(text("""
                ALTER TABLE match_members 
                ADD COLUMN name VARCHAR(255)
            """))
            print("Поле 'name' добавлено")
        else:
            print("Поле 'name' уже существует")
        
        # Добавляем поле rating, если его нет
        if 'rating' not in existing_columns:
            print("Добавляю поле 'rating'...")
            db.execute(text("""
                ALTER TABLE match_members 
                ADD COLUMN rating FLOAT
            """))
            print("Поле 'rating' добавлено")
        else:
            print("Поле 'rating' уже существует")
        
        # Добавляем поле invited_by_tg_id, если его нет
        if 'invited_by_tg_id' not in existing_columns:
            print("Добавляю поле 'invited_by_tg_id'...")
            db.execute(text("""
                ALTER TABLE match_members 
                ADD COLUMN invited_by_tg_id BIGINT,
                ADD CONSTRAINT fk_match_members_invited_by 
                FOREIGN KEY (invited_by_tg_id) REFERENCES users(tg_id)
            """))
            print("Поле 'invited_by_tg_id' добавлено")
        else:
            print("Поле 'invited_by_tg_id' уже существует")
        
        db.commit()
        print("Миграция успешно завершена!")
        
    except Exception as e:
        print(f"Ошибка при выполнении миграции: {e}")
        db.rollback()
        raise

if __name__ == "__main__":
    add_match_member_fields()
