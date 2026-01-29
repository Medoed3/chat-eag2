# backend/listeners/redis_listener.py - СЛУШАТЕЛЬ REDIS PUB/SUB
from typing import Dict, Any, Optional, Callable
import asyncio
import logging
import json
from dataclasses import dataclass

from utils.redis_client import redis_client

logger = logging.getLogger(__name__)


class RedisListener:
    def __init__(self):
        self.running = False
        self.pubsub = None
        self._subscriptions: Dict[str, set] = {}  # chat_id -> set of callbacks

    async def connect(self):
        """Подключение к Redis Pub/Sub"""
        try:
            if not redis_client.is_connected:
                await redis_client.connect_async()
            
            self.pubsub = redis_client.get_redis().pubsub()
            
            logger.info("Подключено к Redis Pub/Sub")
            return True
            
        except Exception as e:
            logger.error(f"Ошибка подключения к Redis Pub/Sub: {e}")
            return False

    async def subscribe_to_chat(self, chat_id: int, callback: Callable[[Dict[str, Any]], None]):
        """Подписка на уведомления для конкретного чата"""
        chat_channel = f"chat:{chat_id}:notifications"
        
        if chat_id not in self._subscriptions:
            self._subscriptions[chat_id] = set()
            
        self._subscriptions[chat_id].add(callback)
        
        # Если это первая подписка на этот чат, подписываемся на канал
        if len(self._subscriptions[chat_id]) == 1:
            if not self.pubsub:
                await self.connect()
                
            await self.pubsub.subscribe(chat_channel)
            logger.debug(f"Подписан на канал Redis: {chat_channel}")

    async def unsubscribe_from_chat(self, chat_id: int, callback: Callable[[Dict[str, Any]], None]):
        """Отписка от уведомлений для конкретного чата"""
        if chat_id in self._subscriptions:
            chat_channel = f"chat:{chat_id}:notifications"
            
            if callback in self._subscriptions[chat_id]:
                self._subscriptions[chat_id].remove(callback)
                
            # Если нет больше подписчиков, отписываемся от канала
            if len(self._subscriptions[chat_id]) == 0:
                await self.pubsub.unsubscribe(chat_channel)
                del self._subscriptions[chat_id]
                logger.debug(f"Отписан от канала Redis: {chat_channel}")

    async def listen(self):
        """Начало прослушивания каналов Redis с автоматическим восстановлением"""
        self.running = True
        
        while self.running:
            try:
                if not await self.connect():
                    await asyncio.sleep(5)
                    continue

                while self.running:
                    try:
                        message = await self.pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                        
                        if message and message['type'] == 'message':
                            try:
                                data = json.loads(message['data'])
                                chat_id = data.get('chat_id')
                                
                                # Распределяем сообщение всем подписчикам этого чата
                                if chat_id and chat_id in self._subscriptions:
                                    for callback in list(self._subscriptions[chat_id]):  # Копируем множество на случай изменения во время итерации
                                        try:
                                            await callback(data)
                                        except Exception as e:
                                            logger.error(f"Ошибка в callback для чата {chat_id}: {e}")
                                            
                                # Логируем полученное сообщение для отладки
                                logger.debug(f"Получено сообщение из Redis: {data}")
                                            
                            except json.JSONDecodeError as e:
                                logger.error(f"Ошибка парсинга JSON: {e}")
                                
                        elif message and message['type'] == 'unsubscribe':
                            break
                            
                    except asyncio.TimeoutError:
                        continue
                    
            except Exception as e:
                logger.error(f"Ошибка при прослушивании Redis: {e}", exc_info=True)
                
            # Пауза перед повторным подключением
            if self.running:
                logger.warning("Переподключение к Redis Pub/Sub...")
                await asyncio.sleep(5)

    async def cleanup(self):
        """Очистка ресурсов"""
        self.running = False
        if self.pubsub:
            try:
                await self.pubsub.unsubscribe()
                await self.pubsub.close()
            except Exception as e:
                logger.error(f"Ошибка при очистке Redis Pub/Sub: {e}")
            
        self._subscriptions.clear()

    async def publish_to_chat(self, chat_id: int, message: Dict[str, Any]):
        """Публикация сообщения в канал чата"""
        try:
            chat_channel = f"chat:{chat_id}:notifications"
            await redis_client.get_redis().publish(chat_channel, json.dumps(message))
            logger.debug(f"Опубликовано сообщение в Redis канал {chat_channel}")
            
        except Exception as e:
            logger.error(f"Ошибка публикации в Redis: {e}")


def create_redis_listener() -> RedisListener:
    """
    Создает и возвращает экземпляр слушателя Redis
    """
    return RedisListener()
