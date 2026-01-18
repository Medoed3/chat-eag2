# backend/config/production.py
import os
from typing import Optional

# Безопасность
SECRET_KEY = os.getenv("SECRET_KEY", "your-production-secret-key-change-this")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 часа

# База данных
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./messenger_prod.db")

# Redis
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", None)
REDIS_DB = int(os.getenv("REDIS_DB", "0"))

# Настройки доставки
DELIVERY_RETRY_ATTEMPTS = int(os.getenv("DELIVERY_RETRY_ATTEMPTS", "5"))
DELIVERY_RETRY_DELAY = int(os.getenv("DELIVERY_RETRY_DELAY", "300"))  # 5 минут
UNREAD_MESSAGE_TTL = int(os.getenv("UNREAD_MESSAGE_TTL", "604800"))  # 7 дней

# Настройки производительности
DATABASE_POOL_SIZE = int(os.getenv("DATABASE_POOL_SIZE", "10"))
DATABASE_MAX_OVERFLOW = int(os.getenv("DATABASE_MAX_OVERFLOW", "20"))
DATABASE_POOL_RECYCLE = int(os.getenv("DATABASE_POOL_RECYCLE", "3600"))

# Настройки WebSocket
WEBSOCKET_PING_INTERVAL = int(os.getenv("WEBSOCKET_PING_INTERVAL", "30"))
WEBSOCKET_PING_TIMEOUT = int(os.getenv("WEBSOCKET_PING_TIMEOUT", "10"))
WEBSOCKET_MAX_CONNECTIONS = int(os.getenv("WEBSOCKET_MAX_CONNECTIONS", "1000"))

# Настройки метрик
METRICS_UPDATE_INTERVAL = int(os.getenv("METRICS_UPDATE_INTERVAL", "60"))
METRICS_RETENTION_DAYS = int(os.getenv("METRICS_RETENTION_DAYS", "7"))

# Настройки очередей
QUEUE_MAX_SIZE = int(os.getenv("QUEUE_MAX_SIZE", "10000"))
QUEUE_WORKER_COUNT = int(os.getenv("QUEUE_WORKER_COUNT", "4"))

# Настройки файлов
MAX_FILE_SIZE = int(os.getenv("MAX_FILE_SIZE", "10485760"))  # 10MB
ALLOWED_FILE_TYPES = os.getenv("ALLOWED_FILE_TYPES", "image/jpeg,image/png,image/gif,video/mp4,application/pdf").split(
    ",")

# CORS настройки
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "").split(",") or ["*"]
CORS_ALLOW_CREDENTIALS = os.getenv("CORS_ALLOW_CREDENTIALS", "true").lower() == "true"

# Настройки логирования
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
LOG_FORMAT = os.getenv("LOG_FORMAT", "%(asctime)s - %(name)s - %(levelname)s - %(message)s")

# Настройки кэширования
CACHE_TTL = int(os.getenv("CACHE_TTL", "300"))  # 5 минут
CACHE_MAX_SIZE = int(os.getenv("CACHE_MAX_SIZE", "1000"))

# Настройки rate limiting
RATE_LIMIT_REQUESTS = int(os.getenv("RATE_LIMIT_REQUESTS", "100"))
RATE_LIMIT_PERIOD = int(os.getenv("RATE_LIMIT_PERIOD", "60"))  # 1 минута


def get_database_config():
    """Конфигурация базы данных для SQLAlchemy"""
    return {
        "url": DATABASE_URL,
        "pool_size": DATABASE_POOL_SIZE,
        "max_overflow": DATABASE_MAX_OVERFLOW,
        "pool_recycle": DATABASE_POOL_RECYCLE,
        "pool_pre_ping": True,
        "echo": False  # В продакшне выключаем логирование SQL
    }


def get_redis_config():
    """Конфигурация Redis"""
    config = {
        "host": REDIS_HOST,
        "port": REDIS_PORT,
        "db": REDIS_DB,
        "decode_responses": True,
        "socket_connect_timeout": 5,
        "socket_timeout": 5,
        "retry_on_timeout": True,
        "max_connections": 100
    }

    if REDIS_PASSWORD:
        config["password"] = REDIS_PASSWORD

    return config