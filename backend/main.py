from fastapi import FastAPI, Depends, WebSocket, WebSocketDisconnect, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy import create_engine, func, text
from typing import Dict, List, Optional
import json
import uuid
import logging
import asyncio
import random
import time

from starlette.staticfiles import StaticFiles
from datetime import datetime

import sys
import os

# Добавляем путь к backend в sys.path если его нет
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.join(current_dir, '..')
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Теперь можно импортировать из database, models и schemas
import models
import schemas
from database import get_db
import auth
from utils.security import verify_token
from utils.redis_client import RedisClient, init_redis  # Убираем redis_client из импорта
from services.message_delivery import MessageDeliveryService

from middleware.metrics_middleware import MetricsMiddleware
from services.metrics import metrics_service

# Настройка логирования
import logging
import logging.handlers

# Настройка логирования
log_level = logging.INFO

# Создаем форматтер
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')

# Настройка обработчика для основного лога
file_handler = logging.handlers.RotatingFileHandler(
    '/Users/medoed/Dev/chat-eag2/backend/logs/app.log',
    maxBytes=10*1024*1024,  # 10MB
    backupCount=5
)
file_handler.setFormatter(formatter)
file_handler.setLevel(log_level)

# Настройка обработчика для ошибок
error_handler = logging.handlers.RotatingFileHandler(
    '/Users/medoed/Dev/chat-eag2/backend/logs/error.log',
    maxBytes=10*1024*1024,
    backupCount=5
)
error_handler.setFormatter(formatter)
error_handler.setLevel(logging.ERROR)

# Настраиваем корневой логгер
root_logger = logging.getLogger()
root_logger.setLevel(log_level)
root_logger.addHandler(file_handler)
root_logger.addHandler(error_handler)

# Предотвращаем дублирование логов
root_logger.propagate = False

logger = logging.getLogger(__name__)


# Конфигурация по умолчанию (если production.py не существует)
class Config:
    DATABASE_URL = "sqlite:///./messenger.db"
    DATABASE_POOL_SIZE = 20
    DATABASE_MAX_OVERFLOW = 0
    DATABASE_POOL_RECYCLE = 3600
    REDIS_HOST = "localhost"
    REDIS_PORT = 6379
    REDIS_DB = 0
    CORS_ORIGINS = ["*"]
    CORS_ALLOW_CREDENTIALS = True


# Пытаемся импортировать конфигурацию development
try:
    import config.development as config

    logger.info("Используется конфигурация development")
except ImportError:
    logger.warning("Конфигурация development.py не найдена, пробуем production")
    try:
        import config.production as config

        logger.info("Используется конфигурация production")
    except ImportError:
        config = Config()
        logger.info("Используется конфигурация по умолчанию")

# Создаем engine с правильными настройками
engine = create_engine(
    config.DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in config.DATABASE_URL else {},
    pool_size=config.DATABASE_POOL_SIZE,
    max_overflow=config.DATABASE_MAX_OVERFLOW,
    pool_recycle=config.DATABASE_POOL_RECYCLE,
    pool_pre_ping=True
)

# Создаем локальную сессию
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db_session():
    """Dependency для получения сессии БД"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Глобальный экземпляр Redis клиента - создаем один раз
redis_client = RedisClient(
    host=config.REDIS_HOST,
    port=config.REDIS_PORT,
    db=config.REDIS_DB
)

# Инициализация приложения
app = FastAPI(
    title="Corporate Messenger with Guaranteed Delivery",
    description="Мессенджер для производственной компании с гарантированной доставкой сообщений",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Настройка CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=config.CORS_ALLOW_CREDENTIALS,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

app.add_middleware(MetricsMiddleware)

# Импорт роутеров
from backend.api import users, chats, media


# ОБНОВЛЕННЫЙ менеджер WebSocket соединений с Redis
class ConnectionManager:
    def __init__(self, redis_client: RedisClient):
        self.redis_client = redis_client
        # Локальный кэш для быстрого доступа к активным соединениям
        self.active_connections: Dict[str, WebSocket] = {}  # connection_id -> WebSocket
        self.user_connections: Dict[int, List[str]] = {}  # user_id -> [connection_id]
        self.chat_connections: Dict[int, List[str]] = {}  # chat_id -> [connection_id]

    async def connect(self, websocket: WebSocket, user_id: int, chat_id: int) -> str:
        """Подключение WebSocket с регистрацией в Redis"""
        try:
            # Генерируем уникальный ID соединения
            connection_id = str(uuid.uuid4())

            # Сохраняем соединение локально
            self.active_connections[connection_id] = websocket

            # Регистрируем у пользователя
            if user_id not in self.user_connections:
                self.user_connections[user_id] = []
            self.user_connections[user_id].append(connection_id)

            # Регистрируем в чате
            if chat_id not in self.chat_connections:
                self.chat_connections[chat_id] = []
            self.chat_connections[chat_id].append(connection_id)

            # Регистрируем в Redis
            await self._register_in_redis(connection_id, user_id, chat_id)

            logger.info(f"User {user_id} connected to chat {chat_id} with connection_id {connection_id}")
            return connection_id

        except Exception as e:
            logger.error(f"Error in WebSocket connect: {e}")
            raise

    async def _register_in_redis(self, connection_id: str, user_id: int, chat_id: int):
        """Регистрирует соединение в Redis"""
        try:
            # Проверяем подключение Redis
            if not self.redis_client.is_connected:
                logger.warning("Redis not connected, skipping registration")
                return

            # Добавляем соединение для пользователя
            self.redis_client.add_connection(user_id, connection_id, [chat_id])
            logger.debug(f"Registered connection {connection_id} in Redis")
        except Exception as e:
            logger.error(f"Error registering connection in Redis: {e}")

    def disconnect(self, connection_id: str, user_id: int, chat_id: int):
        """Отключение WebSocket с очисткой в Redis"""
        try:
            # Удаляем из локального кэша
            if connection_id in self.active_connections:
                del self.active_connections[connection_id]

            if user_id in self.user_connections and connection_id in self.user_connections[user_id]:
                self.user_connections[user_id].remove(connection_id)
                if not self.user_connections[user_id]:
                    del self.user_connections[user_id]

            if chat_id in self.chat_connections and connection_id in self.chat_connections[chat_id]:
                self.chat_connections[chat_id].remove(connection_id)
                if not self.chat_connections[chat_id]:
                    del self.chat_connections[chat_id]

            # Удаляем из Redis
            if self.redis_client.is_connected:
                self.redis_client.remove_connection(connection_id)

            logger.info(f"User {user_id} disconnected from chat {chat_id}")

        except Exception as e:
            logger.error(f"Error in WebSocket disconnect: {e}")

    async def send_to_user(self, user_id: int, message: dict):
        """Отправляет сообщение всем соединениям пользователя"""
        try:
            if user_id in self.user_connections:
                dead_connections = []
                for connection_id in self.user_connections[user_id]:
                    websocket = self.active_connections.get(connection_id)
                    if websocket:
                        try:
                            await websocket.send_json(message)
                        except Exception as e:
                            logger.error(f"Error sending to connection {connection_id}: {e}")
                            dead_connections.append((connection_id, user_id))
                    else:
                        dead_connections.append((connection_id, user_id))

                # Очищаем мертвые соединения
                for connection_id, user_id in dead_connections:
                    self._cleanup_dead_connection(connection_id, user_id)
        except Exception as e:
            logger.error(f"Error in send_to_user: {e}")

    async def send_to_chat(self, chat_id: int, message: dict, exclude_user_id: Optional[int] = None):
        """Отправляет сообщение всем пользователям в чате"""
        try:
            if chat_id in self.chat_connections:
                dead_connections = []
                sent_users = set()

                for connection_id in self.chat_connections[chat_id]:
                    websocket = self.active_connections.get(connection_id)
                    if websocket:
                        # Получаем user_id для этого соединения
                        user_id = None
                        for uid, conn_ids in self.user_connections.items():
                            if connection_id in conn_ids:
                                user_id = uid
                                break

                        if user_id and user_id != exclude_user_id:
                            try:
                                await websocket.send_json(message)
                                sent_users.add(user_id)
                            except Exception as e:
                                logger.error(f"Error sending to connection {connection_id}: {e}")
                                dead_connections.append((connection_id, user_id))
                    else:
                        dead_connections.append((connection_id, None))

                # Очищаем мертвые соединения
                for connection_id, user_id in dead_connections:
                    if user_id:
                        self._cleanup_dead_connection(connection_id, user_id)

                return list(sent_users)
            return []
        except Exception as e:
            logger.error(f"Error in send_to_chat: {e}")
            return []

    def _cleanup_dead_connection(self, connection_id: str, user_id: int):
        """Очищает мертвое соединение"""
        try:
            # Находим chat_id для этого соединения
            chat_id = None
            for cid, conn_ids in self.chat_connections.items():
                if connection_id in conn_ids:
                    chat_id = cid
                    break

            if chat_id:
                self.disconnect(connection_id, user_id, chat_id)
        except Exception as e:
            logger.error(f"Error cleaning up dead connection: {e}")

    async def broadcast_notification(self, chat_id: int, notification: dict):
        """Рассылает уведомление в чат через Redis Pub/Sub"""
        try:
            # Проверяем подключение Redis
            if not self.redis_client.is_connected:
                logger.warning("Redis not connected, sending locally only")
                await self.send_to_chat(chat_id, notification)
                return

            # Публикуем в Redis для распределенной рассылки
            await self.redis_client.publish_message(chat_id, notification)

            # Также отправляем локально подключенным клиентам
            await self.send_to_chat(chat_id, notification)

        except Exception as e:
            logger.error(f"Error broadcasting notification: {e}")

    def get_online_users_in_chat(self, chat_id: int) -> List[int]:
        """Получает список онлайн пользователей в чате"""
        try:
            online_users = set()
            if chat_id in self.chat_connections:
                for connection_id in self.chat_connections[chat_id]:
                    for user_id, conn_ids in self.user_connections.items():
                        if connection_id in conn_ids:
                            online_users.add(user_id)
                            break
            return list(online_users)
        except Exception as e:
            logger.error(f"Error getting online users: {e}")
            return []



# Создаем менеджер с подключенным Redis клиентом
manager = ConnectionManager(redis_client)


async def get_websocket_user(websocket: WebSocket, db: Session):
    """Аутентификация пользователя для WebSocket"""
    try:
        # Получаем токен из query параметров
        token = websocket.query_params.get("token")
        if not token:
            await websocket.close(code=1008, reason="Token required")
            return None

        # Верифицируем токен
        payload = verify_token(token)
        if not payload:
            await websocket.close(code=1008, reason="Invalid token")
            return None

        user_login = payload.get("sub")
        if not user_login:
            await websocket.close(code=1008, reason="Invalid token payload")
            return None

        # Получаем пользователя из БД
        user = db.query(models.User).filter(models.User.login == user_login).first()
        if not user:
            await websocket.close(code=1008, reason="User not found")
            return None

        return user

    except Exception as e:
        logger.error(f"WebSocket auth error: {e}")
        try:
            await websocket.close(code=1011, reason="Internal error")
        except:
            pass
        return None


@app.websocket("/ws/chat/{chat_id}")
async def websocket_chat_endpoint(websocket: WebSocket, chat_id: int):
    """
    WebSocket endpoint для уведомлений в чате (новая архитектура)
    Теперь используется только для lightweight уведомлений
    """
    user = None
    connection_id = None
    db = None

    try:
        # Открываем сессию БД
        db = SessionLocal()

        # Шаг 1: Аутентификация
        user = await get_websocket_user(websocket, db)
        if not user:
            return

        # Шаг 2: Проверка доступа к чату
        chat = db.query(models.Chat).filter(models.Chat.id == chat_id).first()
        if not chat:
            await websocket.close(code=1008, reason="Chat not found")
            return

        # Проверка доступа
        has_access = False
        if chat.is_group:
            has_access = user in chat.members or user.role == "admin"
        else:
            has_access = (chat.owner_id == user.id or
                          db.query(models.chat_members).filter_by(chat_id=chat.id, user_id=user.id).first())

        if not has_access:
            await websocket.close(code=1008, reason="Access denied")
            return

        # Шаг 3: Принимаем соединение
        await websocket.accept()

        # Шаг 4: Регистрируем соединение
        connection_id = await manager.connect(websocket, user.id, chat_id)

        # Шаг 5: Отправляем подтверждение подключения
        await websocket.send_json({
            "type": "connection_established",
            "chat_id": chat_id,
            "user_id": user.id,
            "connection_id": connection_id,
            "timestamp": datetime.utcnow().isoformat()
        })

        # Шаг 6: Отправляем начальное состояние (непрочитанные сообщения)
        delivery_service = MessageDeliveryService(db)
        unread_messages = delivery_service.get_undelivered_messages(user.id)

        if unread_messages:
            await websocket.send_json({
                "type": "initial_state",
                "unread_count": len(unread_messages),
                "has_pending": True
            })

        # Шаг 7: Основной цикл обработки сообщений
        while True:
            try:
                data = await websocket.receive_text()
                message_data = json.loads(data)

                message_type = message_data.get("type")

                if message_type == "typing_indicator":
                    # Обработка индикатора набора текста
                    typing_data = {
                        "type": "user_typing",
                        "user_id": user.id,
                        "user_name": user.full_name,
                        "chat_id": chat_id,
                        "is_typing": message_data.get("is_typing", True)
                    }
                    await manager.send_to_chat(chat_id, typing_data, exclude_user_id=user.id)

                elif message_type == "ping":
                    # Ответ на ping для поддержания соединения
                    await websocket.send_json({
                        "type": "pong",
                        "timestamp": datetime.utcnow().isoformat()
                    })

                elif message_type == "subscribe":
                    # Подписка на дополнительные каналы
                    channels = message_data.get("channels", [])
                    await websocket.send_json({
                        "type": "subscribed",
                        "channels": channels
                    })

                else:
                    logger.warning(f"Unknown WebSocket message type: {message_type}")

            except WebSocketDisconnect:
                logger.info(f"WebSocket disconnected normally for user {user.id}")
                break
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "error": "Invalid JSON format"})
            except Exception as e:
                logger.error(f"Error processing WebSocket message: {e}")
                await websocket.send_json({"type": "error", "error": "Internal server error"})
                break

    except Exception as e:
        logger.error(f"WebSocket endpoint error: {e}")
    finally:
        # Шаг 8: Отключение и очистка
        if user and connection_id:
            manager.disconnect(connection_id, user.id, chat_id)
        if db:
            db.close()
        try:
            await websocket.close()
        except:
            pass


async def startup_event():
    """Инициализация при запуске"""
    logger.info("Starting Corporate Messenger with Guaranteed Delivery...")

    # Создаем таблицы БД
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables verified")

    # Инициализация Redis - СИНХРОННО
    try:
        # Используем синхронное подключение для надежности
        redis_client.connect()
        logger.info("Redis connected successfully")
    except Exception as e:
        logger.error(f"Failed to connect to Redis: {e}")
        logger.warning("Application will run with limited functionality (Redis not available)")

    # Запускаем фоновые задачи
    asyncio.create_task(_process_notification_queue())
    asyncio.create_task(_update_metrics_periodically())
    asyncio.create_task(_cleanup_old_data())
    
    # Запускаем PostgreSQL LISTEN/NOTIFY прослушиватель
    from listeners.postgres_listener import create_postgres_listener
    
    # Создаем и запускаем PostgreSQL LISTEN/NOTIFY прослушиватель
    postgres_listener = create_postgres_listener()
    asyncio.create_task(postgres_listener.start())
    
    logger.info("PostgreSQL LISTEN/NOTIFY listener started")


async def shutdown_event():
    """Очистка при завершении"""
    logger.info("Shutting down Corporate Messenger...")
    redis_client.disconnect()
    
    # Останавливаем PostgreSQL прослушиватель
    from listeners.postgres_listener import create_postgres_listener
    
    # Создаем экземпляр прослушивателя
    postgres_listener = create_postgres_listener()
    await postgres_listener.stop()
    
    logger.info("Shutdown complete")



async def _update_metrics_periodically():
    """Периодическое обновление метрик"""
    while True:
        try:
            # Обновляем метрику онлайн пользователей
            metrics_service.update_online_users()

            # Обновляем метрики из БД
            await _update_database_metrics()

            # Логируем метрики
            if random.random() < 0.1:
                logger.info(f"Metrics updated: {metrics_service.get_metric('users_online')}")

        except Exception as e:
            logger.error(f"Error updating metrics: {e}")

        await asyncio.sleep(60)


async def _update_database_metrics():
    """Обновление метрик из базы данных"""
    try:
        db = SessionLocal()

        # Общее количество сообщений
        total_messages = db.query(func.count(models.Message.id)).scalar()
        metrics_service.set("messages_total", total_messages)

        # Пользователи и чаты
        total_users = db.query(func.count(models.User.id)).scalar()
        metrics_service.set("users_total", total_users)

        total_chats = db.query(func.count(models.Chat.id)).scalar()
        metrics_service.set("chats_total", total_chats)

        active_chats = db.query(func.count(models.Chat.id)).filter(
            models.Chat.is_active == True
        ).scalar()
        metrics_service.set("chats_active", active_chats)

        db.close()

    except Exception as e:
        logger.error(f"Error updating database metrics: {e}")


async def _cleanup_old_data():
    """Очистка старых данных"""
    while True:
        try:
            # Очищаем старые метрики из Redis
            await _cleanup_old_metrics()

        except Exception as e:
            logger.error(f"Error cleaning up old data: {e}")

        await asyncio.sleep(3600)


async def _cleanup_old_metrics():
    """Очистка старых метрик"""
    try:
        # Проверяем подключение Redis
        if not redis_client.is_connected:
            logger.warning("Redis not connected, skipping metrics cleanup")
            return

        seven_days_ago = int(time.time()) - 7 * 86400

        # Онлайн пользователи
        redis_client._redis.zremrangebyscore(
            "stats:users_online:history",
            "-inf",
            seven_days_ago
        )

        # Время доставки
        pattern = "stats:delivery_time:chat:*"
        keys = redis_client._redis.keys(pattern)
        for key in keys:
            if redis_client._redis.ttl(key) == -1:
                redis_client._redis.expire(key, 7 * 86400)

    except Exception as e:
        logger.error(f"Error cleaning up old metrics: {e}")


async def _process_notification_queue():
    """Фоновая задача для обработки очередей уведомлений"""
    while True:
        try:
            # Проверяем подключение Redis
            if not redis_client.is_connected:
                logger.warning("Redis not connected, skipping notification processing")
                await asyncio.sleep(5)
                continue

            # Проверяем очередь push-уведомлений
            task = redis_client.dequeue_notification()
            if task:
                await _process_notification_task(task)

            await asyncio.sleep(1)

        except Exception as e:
            logger.error(f"Error in notification queue processor: {e}")
            await asyncio.sleep(5)


async def _process_notification_task(task: dict):
    """Обработка задачи из очереди"""
    try:
        task_type = task.get("type")
        task_data = task.get("data", {})

        if task_type == "push":
            logger.info(f"Would send push notification: {task_data}")

    except Exception as e:
        logger.error(f"Error processing notification task: {e}")


# Импортируем и создаем роутер для сообщений
try:
    from api.messages import create_router
    from api.metrics import router as metrics_router
    from api.push import router as push_router

    # Передаем manager в создание роутера сообщений
    messages_router = create_router(manager)

    # Подключаем роуты
    app.include_router(auth.router, prefix="", tags=["auth"])
    app.include_router(users.router, prefix="/api", tags=["users"])
    app.include_router(chats.router, prefix="/api", tags=["chats"])
    app.include_router(messages_router, prefix="/api", tags=["messages"])
    app.include_router(media.router, prefix="/api", tags=["media"])
    app.include_router(metrics_router, prefix="/api", tags=["metrics"])
    app.include_router(push_router, prefix="/api", tags=["push"])
    # admin router подключается позже после users, чтобы избежать конфликтов маршрутов
    


except ImportError as e:
    logger.warning(f"Some routers not imported: {e}")

# Статика
app.mount("/static", StaticFiles(directory="static"), name="static")


# Health-check и метрики
@app.get("/")
def read_root():
    return {
        "message": "Corporate Messenger API с гарантированной доставкой работает",
        "version": "2.0.0",
        "docs": "/docs",
        "health": "/health",
        "metrics": "/metrics"
    }


@app.get("/health")
async def health_check():
    """Проверка здоровья системы"""
    redis_ok = False
    try:
        redis_ok = redis_client.is_connected and redis_client.ping()
    except Exception as e:
        logger.error(f"Redis health check failed: {e}")

    db_ok = False
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db_ok = True
        db.close()
    except Exception as e:
        logger.error(f"Database health check failed: {e}")

    return {
        "status": "healthy" if redis_ok and db_ok else "degraded",
        "timestamp": datetime.utcnow().isoformat(),
        "components": {
            "redis": "connected" if redis_ok else "disconnected",
            "database": "connected" if db_ok else "disconnected",
            "websocket": "active",
            "message_delivery": "active"
        },
        "metrics": {
            "active_connections": len(manager.active_connections),
            "online_users": len(manager.user_connections),
            "active_chats": len(manager.chat_connections)
        }
    }


@app.get("/api/me", response_model=schemas.UserResponse)
def read_current_user(current_user: models.User = Depends(auth.get_current_user)):
    return current_user


@app.get("/api/online-users")
async def get_online_users(
        chat_id: Optional[int] = None,
        current_user: models.User = Depends(auth.get_current_user)
):
    """Получение списка онлайн пользователей"""
    if chat_id:
        online_users = manager.get_online_users_in_chat(chat_id)
    else:
        online_users = list(manager.user_connections.keys())

    if current_user.id in online_users:
        online_users.remove(current_user.id)

    return {"online_users": online_users, "count": len(online_users)}
