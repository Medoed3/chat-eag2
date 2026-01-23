# backend/utils/redis_client.py
import redis
import json
import asyncio
from typing import Optional, Dict, Any, List
import logging

logger = logging.getLogger(__name__)


class RedisClient:
    def __init__(self, host: str = "localhost", port: int = 6379, db: int = 0):
        self.host = host
        self.port = port
        self.db = db
        self._redis: Optional[redis.Redis] = None
        self._pubsub: Optional[redis.client.PubSub] = None
        self._connected = False  # Добавляем флаг подключения

    def connect(self):
        """Синхронное подключение к Redis"""
        try:
            self._redis = redis.Redis(
                host=self.host,
                port=self.port,
                db=self.db,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5,
                retry_on_timeout=True
            )
            self._redis.ping()
            self._connected = True  # Устанавливаем флаг
            logger.info(f"Connected to Redis at {self.host}:{self.port}")
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            self._connected = False
            raise

    async def connect_async(self):
        """Асинхронное подключение к Redis"""
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, self.connect)

    def disconnect(self):
        """Отключение от Redis"""
        if self._pubsub:
            self._pubsub.close()
        if self._redis:
            self._redis.close()
        self._connected = False  # Сбрасываем флаг
        logger.info("Disconnected from Redis")

    def _ensure_connected(self):
        """Проверяет, подключен ли Redis"""
        if not self._connected or not self._redis:
            raise RuntimeError("Redis is not connected. Call connect() first.")

    # ========== Управление WebSocket соединениями ==========

    def add_connection(self, user_id: int, connection_id: str, chat_ids: List[int]):
        """
        Добавляет WebSocket соединение для пользователя
        """
        try:
            self._ensure_connected()  # Проверяем подключение
            # Сохраняем маппинг connection_id -> user_id
            self._redis.set(f"conn:{connection_id}", user_id, ex=86400)  # TTL 24 часа

            # Добавляем connection_id в набор активных соединений пользователя
            self._redis.sadd(f"user:{user_id}:connections", connection_id)

            # Для каждого чата добавляем пользователя в список онлайн-участников
            for chat_id in chat_ids:
                self._redis.sadd(f"chat:{chat_id}:online", user_id)
                # Устанавливаем TTL для автоматической очистки (4 часа)
                self._redis.expire(f"chat:{chat_id}:online", 14400)

            # Устанавливаем TTL для соединения (4 часа)
            self._redis.expire(f"user:{user_id}:connections", 14400)

        except RuntimeError as e:
            logger.error(f"Redis not connected: {e}")
        except Exception as e:
            logger.error(f"Error adding connection: {e}")

    def remove_connection(self, connection_id: str):
        """
        Удаляет WebSocket соединение
        """
        try:
            self._ensure_connected()
            # Получаем user_id по connection_id
            user_id = self._redis.get(f"conn:{connection_id}")
            if not user_id:
                return

            user_id = int(user_id)

            # Удаляем connection_id из набора пользователя
            self._redis.srem(f"user:{user_id}:connections", connection_id)

            # Удаляем маппинг connection_id -> user_id
            self._redis.delete(f"conn:{connection_id}")

            # Если у пользователя больше нет активных соединений, удаляем его из онлайн-чатов
            if not self._redis.exists(f"user:{user_id}:connections"):
                # Нужно найти все чаты, где был пользователь и удалить его
                # Пока просто логируем, в будущем можно добавить более точное удаление
                logger.info(f"User {user_id} has no more active connections")

        except RuntimeError as e:
            logger.error(f"Redis not connected: {e}")
        except Exception as e:
            logger.error(f"Error removing connection: {e}")

    def get_user_connections(self, user_id: int) -> List[str]:
        """Получает список активных соединений пользователя"""
        try:
            self._ensure_connected()
            connections = self._redis.smembers(f"user:{user_id}:connections")
            return list(connections)
        except RuntimeError as e:
            logger.error(f"Redis not connected: {e}")
            return []
        except Exception as e:
            logger.error(f"Error getting user connections: {e}")
            return []

    def is_user_online(self, user_id: int) -> bool:
        """Проверяет, онлайн ли пользователь"""
        try:
            self._ensure_connected()
            return self._redis.exists(f"user:{user_id}:connections") > 0
        except RuntimeError as e:
            logger.error(f"Redis not connected: {e}")
            return False
        except Exception as e:
            logger.error(f"Error checking user online status: {e}")
            return False

    # ========== Очереди для фоновых задач ==========

    def enqueue_notification(self, task_type: str, task_data: Dict[str, Any]):
        """
        Добавляет задачу в очередь уведомлений
        """
        try:
            self._ensure_connected()
            task = {
                "type": task_type,
                "data": task_data,
                "timestamp": asyncio.get_event_loop().time()
            }
            self._redis.rpush("queue:notifications", json.dumps(task))
        except RuntimeError as e:
            logger.error(f"Redis not connected: {e}")
        except Exception as e:
            logger.error(f"Error enqueueing notification: {e}")

    def dequeue_notification(self) -> Optional[Dict[str, Any]]:
        """Извлекает задачу из очереди уведомлений"""
        try:
            self._ensure_connected()
            task_json = self._redis.lpop("queue:notifications")
            if task_json:
                return json.loads(task_json)
            return None
        except RuntimeError as e:
            logger.error(f"Redis not connected: {e}")
            return None
        except Exception as e:
            logger.error(f"Error dequeueing notification: {e}")
            return None

    # ========== Утилиты ==========

    def ping(self) -> bool:
        """Проверяет соединение с Redis"""
        try:
            self._ensure_connected()
            return self._redis.ping()
        except RuntimeError:
            return False
        except:
            return False

    @property
    def is_connected(self) -> bool:
        """Проверяет, подключен ли Redis"""
        return self._connected and self._redis is not None

    def get_redis(self):
        """Безопасное получение объекта Redis"""
        if not self.is_connected:
            raise RuntimeError("Redis is not connected")
        return self._redis

    def get_online_users_in_chat(self, chat_id: int) -> List[int]:
        """
        Возвращает список ID пользователей, которые онлайн в указанном чате
        """
        try:
            self._ensure_connected()
            # Получаем всех пользователей, которые онлайн в чате
            online_users = self._redis.smembers(f"chat:{chat_id}:online")
            return [int(user_id) for user_id in online_users]
        except RuntimeError as e:
            logger.error(f"Redis not connected: {e}")
            return []
        except Exception as e:
            logger.error(f"Error getting online users in chat {chat_id}: {e}")
            return []

    def publish_message(self, chat_id: int, message: dict):
        """
        Публикует сообщение в канал чата
        """
        try:
            self._ensure_connected()
            channel = f"chat:{chat_id}:messages"
            self._redis.publish(channel, json.dumps(message))
        except RuntimeError as e:
            logger.error(f"Redis not connected: {e}")
        except Exception as e:
            logger.error(f"Error publishing message to chat {chat_id}: {e}")


# Глобальный экземпляр Redis клиента
redis_client = RedisClient()


async def init_redis():
    """Инициализация Redis при запуске приложения"""
    try:
        await redis_client.connect_async()
        logger.info("Redis initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize Redis: {e}")
        # В продакшене можно заменить на заглушку или продолжить без Redis
