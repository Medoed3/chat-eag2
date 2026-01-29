# backend/database.py
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
import logging
import sys
import json
from typing import Dict, Any

logger = logging.getLogger(__name__)

# Удаляем добавление пути в sys.path, так как backend является пакетом
    
# Функция для загрузки конфигурации из JSON файла
def load_database_config(config_file: str) -> Dict[str, Any]:
    """Загружает конфигурацию базы данных из JSON файла"""
    try:
        with open(config_file, 'r') as f:
            config = json.load(f)
            
        # Формируем DATABASE_URL из параметров
        dialect = config.get('dialect', 'postgresql')
        username = config['username']
        password = config['password']
        host = config['host']
        port = config.get('port', 5432)
        database = config['database']
        
        DATABASE_URL = f"{dialect}://{username}:{password}@{host}:{port}/{database}"
        
        # Получаем параметры пула, используя значения из файла или значения по умолчанию
        DATABASE_POOL_SIZE = config.get('pool_size', 20)
        DATABASE_MAX_OVERFLOW = config.get('max_overflow', 0)
        DATABASE_POOL_RECYCLE = config.get('pool_recycle', 3600)
        
        return {
            'DATABASE_URL': DATABASE_URL,
            'DATABASE_POOL_SIZE': DATABASE_POOL_SIZE,
            'DATABASE_MAX_OVERFLOW': DATABASE_MAX_OVERFLOW,
            'DATABASE_POOL_RECYCLE': DATABASE_POOL_RECYCLE
        }
    except Exception as e:
        print(f"Error loading database config from {config_file}: {e}")
        raise

# Пытаемся загрузить конфигурацию из разных источников
DATABASE_URL = None
DATABASE_POOL_SIZE = 20
DATABASE_MAX_OVERFLOW = 0
DATABASE_POOL_RECYCLE = 3600

# Удаляем CONFIG_DIR, так как config находится в пакете backend

# 1. Загружаем из config.development (разработка)
try:
    from config.development import DATABASE_URL as dev_db_url
    from config.development import DATABASE_POOL_SIZE as dev_pool_size
    from config.development import DATABASE_MAX_OVERFLOW as dev_max_overflow
    from config.development import DATABASE_POOL_RECYCLE as dev_pool_recycle

    DATABASE_URL = dev_db_url
    DATABASE_POOL_SIZE = dev_pool_size
    DATABASE_MAX_OVERFLOW = dev_max_overflow
    DATABASE_POOL_RECYCLE = dev_pool_recycle
    print("Используется конфигурация из config.development")
except ImportError as e:
    print(f"Конфигурация config.development не найдена: {e}")
except Exception as e:
    print(f"Ошибка загрузки config.development: {e}")

# 2. Если не загрузилось, попробуем из config.production (продакшен)
if DATABASE_URL is None:
    try:
        from config.production import DATABASE_URL as prod_db_url
        from config.production import DATABASE_POOL_SIZE as prod_pool_size
        from config.production import DATABASE_MAX_OVERFLOW as prod_max_overflow
        from config.production import DATABASE_POOL_RECYCLE as prod_pool_recycle

        DATABASE_URL = prod_db_url
        DATABASE_POOL_SIZE = prod_pool_size
        DATABASE_MAX_OVERFLOW = prod_max_overflow
        DATABASE_POOL_RECYCLE = prod_pool_recycle
        print("Используется конфигурация из config.production")
    except ImportError as e:
        print(f"Конфигурация config.production не найдена: {e}")
    except Exception as e:
        print(f"Ошибка загрузки config.production: {e}")

# 3. Если не загрузилось, попробуем из .env переменных
if DATABASE_URL is None:
    try:
        from dotenv import load_dotenv
        load_dotenv()
        
        db_url = os.getenv('DATABASE_URL')
        if db_url:
            DATABASE_URL = db_url
            DATABASE_POOL_SIZE = int(os.getenv('DATABASE_POOL_SIZE', '20'))
            DATABASE_MAX_OVERFLOW = int(os.getenv('DATABASE_MAX_OVERFLOW', '0'))
            DATABASE_POOL_RECYCLE = int(os.getenv('DATABASE_POOL_RECYCLE', '3600'))
            print("Используется конфигурация из .env переменных")
    except ImportError as e:
        print(f"dotenv не установлен: {e}")

# 4. Если не загрузилось, используем значения по умолчанию (для миграций)
if DATABASE_URL is None:
    try:
        from database_config import database_config
        DATABASE_URL = database_config['DATABASE_URL']
        DATABASE_POOL_SIZE = database_config['DATABASE_POOL_SIZE']
        DATABASE_MAX_OVERFLOW = database_config['DATABASE_MAX_OVERFLOW']
        DATABASE_POOL_RECYCLE = database_config['DATABASE_POOL_RECYCLE']
        print("Используется конфигурация из database_config.py")
    except Exception as e:
        print(f"Ошибка загрузки database_config: {e}")
        # Резервные значения
        DATABASE_URL = "postgresql://chat_user:your_secure_password@localhost/eag-messenger"
        DATABASE_POOL_SIZE = 20
        DATABASE_MAX_OVERFLOW = 0
        DATABASE_POOL_RECYCLE = 3600
        print("Используется конфигурация по умолчанию (для миграций)")

# 5. Если ничего не сработало, используем значения по умолчанию (на всякий случай)
if DATABASE_URL is None:
    DATABASE_URL = "postgresql://chat_user:your_secure_password@localhost/eag-messenger"
    DATABASE_POOL_SIZE = 20
    DATABASE_MAX_OVERFLOW = 0
    DATABASE_POOL_RECYCLE = 3600
    print("Используется конфигурация по умолчанию (на всякий случай)")

# Создаем engine с правильными настройками
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
    pool_size=DATABASE_POOL_SIZE,
    max_overflow=DATABASE_MAX_OVERFLOW,
    pool_recycle=DATABASE_POOL_RECYCLE,
    pool_pre_ping=True,
    echo=True  # Включаем вывод SQL-запросов для отладки
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


# Эта функция ДОЛЖНА быть здесь
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()