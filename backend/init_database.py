# backend/init_database.py
import sys
import os

# Добавляем путь к backend в sys.path если его нет
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.join(current_dir, '..')
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Теперь можно импортировать из database и models
from database import engine
from models import Base
from sqlalchemy import text


def init_database():
    """Инициализация базы данных"""
    print("Инициализация базы данных...")

    # Создаем все таблицы
    print(f"Используем URL: {engine.url}")
    Base.metadata.create_all(bind=engine)
    print("✅ Таблицы созданы")
    
    # Проверяем, что метаданные содержат таблицы
    print(f"Количество таблиц в метаданных: {len(Base.metadata.tables)}")
    if Base.metadata.tables:
        print(f"Таблицы в метаданных: {list(Base.metadata.tables.keys())}")
    else:
        print("⚠️  Внимание: метаданные Base не содержат таблиц. Убедитесь, что модели импортированы правильно.")
    
    # Создаем новое подключение для проверки таблиц
    with engine.connect() as conn:
        result = conn.execute(text("SELECT tablename FROM pg_tables WHERE schemaname = 'public'"))
        tables = [row[0] for row in result]
        if tables:
            print(f"✅ Созданы таблицы: {', '.join(tables)}")
        else:
            print("❌ Таблицы не созданы в базе данных")

    # Проверяем, что таблицы созданы
    with engine.connect() as conn:
        result = conn.execute(text("SELECT tablename FROM pg_tables WHERE schemaname = 'public'"))
        tables = [row[0] for row in result]
        if tables:
            print(f"✅ Созданы таблицы: {', '.join(tables)}")
        else:
            print("✅ База данных инициализирована, но таблицы не найдены")


if __name__ == "__main__":
    init_database()