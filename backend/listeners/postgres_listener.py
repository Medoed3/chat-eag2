# backend/listeners/postgres_listener.py - СЛУШАТЕЛЬ ПОТОКА БАЗЫ ДАННЫХ
import asyncio
import logging
import asyncpg
from typing import Dict, Any, Optional
from contextlib import asynccontextmanager
import json
from datetime import datetime

from backend.config import get_settings
from utils.redis_client import redis_client

logger = logging.getLogger(__name__)


class PostgresListener:
    def __init__(self):
        self.settings = get_settings()
        self.connection: Optional[asyncpg.Connection] = None
        self.is_running = False
        self.task: Optional[asyncio.Task] = None

    @asynccontextmanager
    async def get_connection(self):
        """
        Контекстный менеджер для подключения к PostgreSQL
        """
        conn = None
        try:
            conn = await asyncpg.connect(
                host=self.settings.DATABASE_HOST,
                port=self.settings.DATABASE_PORT,
                user=self.settings.DATABASE_USER,
                password=self.settings.DATABASE_PASSWORD,
                database=self.settings.DATABASE_NAME
            )
            yield conn
        except Exception as e:
            logger.error(f"Failed to connect to PostgreSQL: {e}")
            raise
        finally:
            if conn:
                await conn.close()

    async def listen(self):
        """
        Начинает прослушивание уведомлений PostgreSQL
        """
        if self.is_running:
            return

        self.is_running = True
        logger.info("Starting PostgreSQL listener")

        async with self.get_connection() as conn:
            try:
                # Подписываемся на канал
                await conn.add_listener('chat_updates', self._notification_callback)
                logger.info("Subscribed to 'chat_updates' channel")

                # Используем бесконечный цикл для поддержания соединения активным
                while self.is_running:
                    # Простая проверка соединения
                    try:
                        await conn.fetchval('SELECT 1')
                    except Exception as e:
                        logger.error(f"Connection lost: {e}. Reconnecting...")
                        break

                    await asyncio.sleep(1)  # Краткая пауза для предотвращения чрезмерной нагрузки

            except Exception as e:
            	logger.error(f"Error in PostgreSQL listener: {e}")
            finally:
            	await conn.remove_listener('chat_updates', self._notification_callback)

    async def _notification_callback(self, connection: asyncpg.Connection, pid: int, channel: str, payload: str):
        """
        Обработчик уведомлений PostgreSQL
        """
        try:
            data = json.loads(payload)
            
            # Определяем тип события
            event_type = data.get('event')
            chat_id = data.get('chat_id')
            message_id = data.get('message_id')
            
            # Создаем уведомление
            notification = {
                'type': f"postgres_{event_type}",
                'chat_id': chat_id,
                'message_id': message_id,
                'timestamp': data.get('timestamp'),
                'user_id': data.get('user_id'),
                'payload': data
            }
            
            # Отправляем сообщение в Redis
            await redis_client.publish_message(chat_id, notification)
            
            logger.info(f"Forwarded PostgreSQL event to Redis: {event_type} for chat {chat_id}, message {message_id}")
            
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in PostgreSQL notification: {payload}", exc_info=True)
        except Exception as e:
            logger.error(f"Error processing PostgreSQL notification: {e}", exc_info=True)

    async def start(self):
        """
        Запускает слушатель в фоновом режиме
        """
        if self.task is None or self.task.done():
            self.task = asyncio.create_task(self._run())

    async def _run(self):
        """
        Основной цикл выполнения слушателя с автоматическим восстановлением
        """
        while self.is_running:
            try:
                await self.listen()
            except Exception as e:
                logger.error(f"PostgreSQL listener crashed: {e}. Restarting in 5 seconds...")
                await asyncio.sleep(5)

    async def stop(self):
        """
        Останавливает слушатель
        """
        self.is_running = False
        if self.task:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass
            self.task = None

    async def notify_chat_update(self, chat_id: int, event_type: str, message_id: int = None, user_id: int = None):
        """
        Отправляет уведомление в PostgreSQL LISTEN/NOTIFY
        """
        async with self.get_connection() as conn:
            payload = {
                'event': event_type,
                'chat_id': chat_id,
                'message_id': message_id,
                'user_id': user_id,
                'timestamp': datetime.utcnow().isoformat()
            }
            
            await conn.execute(
                'NOTIFY chat_updates, $1',
                json.dumps(payload)
            )
            
            logger.debug(f"Sent PostgreSQL NOTIFY: {event_type} for chat {chat_id}")


def create_postgres_listener() -> PostgresListener:
    """
    Создает и возвращает экземпляр слушателя PostgreSQL
    """
    return PostgresListener()
