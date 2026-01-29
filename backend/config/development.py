from ..database_config import database_config

DATABASE_URL = database_config['DATABASE_URL']
DATABASE_POOL_SIZE = database_config['DATABASE_POOL_SIZE']
DATABASE_MAX_OVERFLOW = database_config['DATABASE_MAX_OVERFLOW']
DATABASE_POOL_RECYCLE = database_config['DATABASE_POOL_RECYCLE']
CORS_ORIGINS = ["http://localhost:5173", "http://localhost:8000"]
CORS_ALLOW_CREDENTIALS = True
REDIS_HOST = "localhost"
REDIS_PORT = 6379
REDIS_DB = 0