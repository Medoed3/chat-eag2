# backend/create_test_users.py
# Удаляем ручные настройки sys.path и chdir, так как backend является пакетом

from database import SessionLocal, engine, Base
from models import User, Chat, Message
from utils.security import get_password_hash
from datetime import datetime
import uuid

# Создаем таблицы
Base.metadata.create_all(bind=engine)
db = SessionLocal()

try:
    # Админ
    admin = User(
        login="admin",
        full_name="Администратор ИТ",
        password_hash=get_password_hash("admin123"),
        role="admin",
        is_active=True
    )

    # Тестовый пользователь
    user1 = User(
        login="user1",
        full_name="Иван Иванов",
        password_hash=get_password_hash("user123"),
        role="user",
        is_active=True
    )

    # Еще пользователь
    user2 = User(
        login="user2",
        full_name="Мария Петрова",
        password_hash=get_password_hash("user123"),
        role="user",
        is_active=True
    )

    db.add_all([admin, user1, user2])
    db.commit()

    print("✅ Пользователи созданы:")
    print(f"   - admin / admin123 (администратор)")
    print(f"   - user1 / user123")
    print(f"   - user2 / user123")

    # Создадим тестовый чат
    chat = Chat(
        name="Общий чат",
        is_group=True,
        owner_id=admin.id,
        is_active=True
    )
    db.add(chat)
    db.commit()

    # Добавим пользователей в чат
    chat.members.extend([admin, user1, user2])
    db.commit()

    print(f"✅ Создан чат 'Общий чат' (ID: {chat.id})")

except Exception as e:
    print(f"❌ Ошибка: {e}")
    db.rollback()
finally:
    db.close()