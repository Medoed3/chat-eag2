import json
import os

# Получаем путь к директории проекта
PROJECT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATABASE_CONFIG_PATH = os.path.join(PROJECT_DIR, "database_config.json")

# Загружаем конфигурацию из JSON файла
def load_database_config():
    with open(DATABASE_CONFIG_PATH, 'r') as f:
        config = json.load(f)
    
    DATABASE_URL = f"{config['dialect']}://{config['username']}:{config['password']}@{config['host']}:{config['port']}/{config['database']}"
    
    return {
        'DATABASE_URL': DATABASE_URL,
        'DATABASE_POOL_SIZE': config.get('pool_size', 20),
        'DATABASE_MAX_OVERFLOW': config.get('max_overflow', 0),
        'DATABASE_POOL_RECYCLE': config.get('pool_recycle', 3600)
    }

database_config = load_database_config()