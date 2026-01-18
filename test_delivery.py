#!/usr/bin/env python3
"""
Скрипт для тестирования гарантированной доставки сообщений
"""

import asyncio
import requests
import json
import time
import sys
import os
from datetime import datetime

from sqlalchemy import text

sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from database import SessionLocal
from models import User, Chat, Message
from services.message_delivery import MessageDeliveryService


def test_redis_connection():
    """Тест подключения к Redis"""
    try:
        from utils.redis_client import redis_client
        redis_client.connect()
        print("✓ Redis подключен успешно")
        return True
    except Exception as e:
        print(f"✗ Ошибка подключения к Redis: {e}")
        return False


def test_database():
    """Тест подключения к базе данных"""
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        print("✓ База данных подключена успешно")

        # Проверяем наличие новых таблиц
        from sqlalchemy import inspect
        inspector = inspect(db.bind)
        tables = inspector.get_table_names()

        required_tables = ['messages', 'message_deliveries', 'unread_messages']
        for table in required_tables:
            if table in tables:
                print(f"  ✓ Таблица {table} существует")
            else:
                print(f"  ✗ Таблица {table} отсутствует")

        return True
    except Exception as e:
        print(f"✗ Ошибка подключения к БД: {e}")
        return False


async def test_message_delivery():
    """Тест сервиса доставки сообщений"""
    print("\nТестирование сервиса доставки сообщений...")

    db = SessionLocal()
    try:
        # Получаем тестовых пользователей
        users = db.query(User).limit(2).all()
        if len(users) < 2:
            print("✗ Нужно как минимум 2 пользователя для теста")
            return False

        user1, user2 = users[0], users[1]

        # Создаем тестовый чат
        chat = Chat(
            name="Тестовый чат",
            is_group=True,
            owner_id=user1.id,
            created_at=datetime.utcnow(),
            is_active=True
        )
        db.add(chat)
        db.flush()

        # Добавляем пользователей в чат
        chat.members.extend([user1, user2])
        db.commit()

        # Тестируем отправку сообщения
        delivery_service = MessageDeliveryService(db)

        print(f"Отправка сообщения от пользователя {user1.id} в чат {chat.id}...")
        message, status = await delivery_service.send_message(
            sender_id=user1.id,
            chat_id=chat.id,
            content="Тестовое сообщение с гарантированной доставкой",
            client_message_id="test-" + str(int(time.time()))
        )

        if message and status == "sent":
            print(f"✓ Сообщение {message.id} отправлено успешно")

            # Проверяем записи доставки
            deliveries = db.query(MessageDelivery).filter(
                MessageDelivery.message_id == message.id
            ).all()

            print(f"✓ Создано {len(deliveries)} записей доставки")

            # Тестируем подтверждение доставки
            print(f"Подтверждение доставки пользователем {user2.id}...")
            success = await delivery_service.confirm_delivery(
                message_id=message.id,
                user_id=user2.id
            )

            if success:
                print("✓ Доставка подтверждена успешно")

                # Проверяем обновление статуса
                delivery = db.query(MessageDelivery).filter(
                    MessageDelivery.message_id == message.id,
                    MessageDelivery.user_id == user2.id
                ).first()

                if delivery and delivery.status == "delivered":
                    print("✓ Статус доставки обновлен правильно")
                else:
                    print("✗ Статус доставки не обновлен")
                    return False
            else:
                print("✗ Ошибка подтверждения доставки")
                return False

            return True
        else:
            print(f"✗ Ошибка отправки сообщения: {status}")
            return False

    except Exception as e:
        print(f"✗ Ошибка в тесте доставки: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()


async def test_websocket_notifications():
    """Тест WebSocket уведомлений"""
    print("\nТестирование WebSocket уведомлений...")

    # Этот тест требует запущенного сервера
    # В реальном тесте нужно подключаться к WebSocket
    print("⚠️ WebSocket тест требует ручного тестирования с запущенным сервером")
    print("   Запустите сервер и откройте http://localhost:8000/docs для тестирования")
    return True


def test_api_endpoints():
    """Тест REST API эндпоинтов"""
    print("\nТестирование REST API эндпоинтов...")

    base_url = "http://localhost:8000"

    # Пытаемся получить health-check
    try:
        response = requests.get(f"{base_url}/health", timeout=5)
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Health-check: {data.get('status', 'unknown')}")
            print(f"  Redis: {data.get('components', {}).get('redis', 'unknown')}")
            print(f"  DB: {data.get('components', {}).get('database', 'unknown')}")
            return True
        else:
            print(f"✗ Health-check вернул статус {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print("✗ Не удалось подключиться к серверу")
        print("  Запустите сервер: uvicorn main:app --reload")
        return False
    except Exception as e:
        print(f"✗ Ошибка теста API: {e}")
        return False


async def main():
    """Основная функция тестирования"""
    print("=" * 60)
    print("Тестирование гарантированной доставки сообщений")
    print("=" * 60)

    tests_passed = 0
    tests_failed = 0

    # Тест Redis
    if test_redis_connection():
        tests_passed += 1
    else:
        tests_failed += 1

    # Тест базы данных
    if test_database():
        tests_passed += 1
    else:
        tests_failed += 1

    # Тест сервиса доставки
    if await test_message_delivery():
        tests_passed += 1
    else:
        tests_failed += 1

    # Тест API (требует запущенного сервера)
    if test_api_endpoints():
        tests_passed += 1
    else:
        tests_failed += 1

    print("\n" + "=" * 60)
    print(f"Результаты: {tests_passed} прошло, {tests_failed} не прошло")

    if tests_failed == 0:
        print("✓ Все тесты пройдены успешно!")
        print("\nСледующие шаги:")
        print("1. Запустите сервер: python -m uvicorn main:app --reload")
        print("2. Откройте http://localhost:8000/docs")
        print("3. Протестируйте новые эндпоинты:")
        print("   - POST /api/messages - отправка с client_message_id")
        print("   - POST /api/messages/{id}/delivered - подтверждение доставки")
        print("   - GET /api/chats/{id}/sync - синхронизация")
        print("   - GET /health - проверка состояния системы")
    else:
        print("✗ Некоторые тесты не пройдены")
        print("Проверьте конфигурацию и запустите тесты снова")

    return tests_failed == 0


if __name__ == "__main__":
    asyncio.run(main())