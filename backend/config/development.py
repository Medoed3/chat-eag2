# backend/config/development.py
import os

# Безопасность
SECRET_KEY = "your-development-secret-key"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 дней для удобства разработки

# База данных
DATABASE_URL = "sqlite:///./messenger.db"

# Redis
REDIS_HOST = "localhost"
REDIS_PORT = 6379
REDIS_PASSWORD = None
REDIS_DB = 0

# Настройки доставки
DELIVERY_RETRY_ATTEMPTS = 3
DELIVERY_RETRY_DELAY = 60  # 1 минута

# Настройки производительности
DATABASE_POOL_SIZE = 5
DATABASE_MAX_OVERFLOW = 10
DATABASE_POOL_RECYCLE = 3600

# CORS настройки для разработки
CORS_ORIGINS = ["http://localhost:5173"]  # Явно указываем фронтенд Vite
CORS_ALLOW_CREDENTIALS = True

# Настройки WebSocket
WEBSOCKET_PING_INTERVAL = 30
WEBSOCKET_PING_TIMEOUT = 10

# Настройки метрик
METRICS_UPDATE_INTERVAL = 60

# Настройки файлов
MAX_FILE_SIZE = 10485760  # 10MB
ALLOWED_FILE_TYPES = ["image/jpeg", "image/png", "image/gif", "video/mp4", "application/pdf"]

# Настройки логирования
LOG_LEVEL = "INFO"
LOG_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"

# Настройки кэширования
CACHE_TTL = 300

# Настройки rate limiting
RATE_LIMIT_REQUESTS = 1000  # Больше лимит для разработки
RATE_LIMIT_PERIOD = 60