# backend/init_database.py
import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import engine, Base
from sqlalchemy import text


def init_database():
    """Инициализация базы данных"""
    print("Инициализация базы данных...")

    # Создаем все таблицы
    Base.metadata.create_all(bind=engine)
    print("✅ Таблицы созданы")

    # Проверяем, что таблицы созданы
    with engine.connect() as conn:
        result = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table'"))
        tables = [row[0] for row in result]
        print(f"✅ Созданы таблицы: {', '.join(tables)}")


if __name__ == "__main__":
    init_database()