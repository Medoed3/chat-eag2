# backend/migrations.py
import sys
import os

# Добавляем путь к backend в sys.path если его нет
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.join(current_dir, '..')
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Теперь можно импортировать из database
from database import engine, Base
from models import DeliveryStatus
from sqlalchemy import inspect, text
import logging

logger = logging.getLogger(__name__)


def migrate_database():
    """
    Простая функция миграции для добавления новых таблиц и полей.
    """
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()

    # Создаем все таблицы, если их нет
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created/verified")

    # Проверяем и добавляем недостающие столбцы
    with engine.connect() as conn:
        # Проверяем наличие столбца client_message_id в messages
        try:
            conn.execute(text("SELECT client_message_id FROM messages LIMIT 1"))
        except Exception:
            logger.info("Adding missing columns to messages table...")
            # Добавляем новые столбцы
            conn.execute(text("""
                ALTER TABLE messages ADD COLUMN client_message_id TEXT UNIQUE
            """))
            conn.execute(text("""
                ALTER TABLE messages ADD COLUMN server_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            """))
            conn.execute(text("""
                ALTER TABLE messages ADD COLUMN delivery_status TEXT DEFAULT 'pending'
            """))
            conn.execute(text("""
                ALTER TABLE messages ADD COLUMN delivered_at DATETIME
            """))
            conn.execute(text("""
                ALTER TABLE messages ADD COLUMN read_at DATETIME
            """))
            conn.commit()
            logger.info("Added new columns to messages table")

        # Проверяем существование новых таблиц
        if 'message_deliveries' not in existing_tables:
            logger.info("Creating message_deliveries table...")

        if 'unread_messages' not in existing_tables:
            logger.info("Creating unread_messages table...")


if __name__ == "__main__":
    migrate_database()
    print("Миграции выполнены успешно!")