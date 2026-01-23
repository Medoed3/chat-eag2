"""
Этот файл нужен для того, чтобы директория backend/api была Python пакетом.
Здесь можно импортировать и регистрировать роутеры из различных модулей.
"""

from fastapi import APIRouter
from . import users, chats, media, metrics, push, admin

# Создаем основной роутер для API
api_router = APIRouter()

# Регистрируем все роутеры
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(chats.router, prefix="/chats", tags=["chats"])
api_router.include_router(media.router, prefix="/media", tags=["media"])
api_router.include_router(metrics.router, prefix="/metrics", tags=["metrics"])
api_router.include_router(push.router, prefix="/push", tags=["push"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
