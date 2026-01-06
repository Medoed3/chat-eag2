# backend/main.py - полная исправленная версия
# Основной файл приложения FastAPI

from fastapi import FastAPI, Depends, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import Dict, List
import json

from starlette.staticfiles import StaticFiles
import schemas
import models
import database
from auth import get_current_user, router as auth_router
from utils.security import verify_token

# Инициализация приложения
app = FastAPI(
    title="Corporate Messenger",
    description="Мессенджер для производственной компании",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Настройка CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Импорт роутеров
from api import users, chats, media, admin
from api.messages import create_router


# УЛУЧШЕННЫЙ менеджер WebSocket соединений с группировкой по чатам
class ConnectionManager:
    def __init__(self):
        # Словарь для хранения соединений по chat_id
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, chat_id: int):
        """Подключение WebSocket (accept уже вызван в эндпоинте)"""
        if chat_id not in self.active_connections:
            self.active_connections[chat_id] = []
        self.active_connections[chat_id].append(websocket)
        print(f"Пользователь подключился к чату {chat_id}. Всего соединений: {len(self.active_connections[chat_id])}")

    def disconnect(self, websocket: WebSocket, chat_id: int):
        if chat_id in self.active_connections:
            if websocket in self.active_connections[chat_id]:
                self.active_connections[chat_id].remove(websocket)
                print(
                    f"Пользователь отключился от чата {chat_id}. Осталось соединений: {len(self.active_connections[chat_id])}")

            # Очищаем пустой список
            if not self.active_connections[chat_id]:
                del self.active_connections[chat_id]

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        await websocket.send_json(message)

    async def broadcast_to_chat(self, chat_id: int, message: dict, exclude_websocket: WebSocket = None):
        """Отправляет сообщение всем подключенным к указанному чату"""
        if chat_id in self.active_connections:
            dead_connections = []
            for connection in self.active_connections[chat_id]:
                if exclude_websocket and connection == exclude_websocket:
                    continue
                try:
                    await connection.send_json(message)
                except Exception as e:
                    print(f"Ошибка отправки WebSocket: {e}")
                    dead_connections.append(connection)

            # Удаляем мертвые соединения
            for dead_conn in dead_connections:
                self.disconnect(dead_conn, chat_id)

    async def broadcast(self, message: dict):
        """Отправляет сообщение всем подключенным клиентам (для обратной совместимости)"""
        for chat_id in list(self.active_connections.keys()):
            await self.broadcast_to_chat(chat_id, message)


manager = ConnectionManager()

# Создаём роутер с менеджером
messages_router = create_router(manager)

# Создаём таблицы
models.Base.metadata.create_all(bind=database.engine)

# Подключаем роуты
app.include_router(auth_router, prefix="", tags=["auth"])
app.include_router(users.router, prefix="/api", tags=["users"])
app.include_router(chats.router, prefix="/api", tags=["chats"])
app.include_router(messages_router, prefix="/api", tags=["messages"])
app.include_router(media.router, prefix="/api", tags=["media"])
app.include_router(admin.router, prefix="/api", tags=["admin"])

# Статика
app.mount("/static", StaticFiles(directory="static"), name="static")


# Health-check
@app.get("/")
def read_root():
    return {"message": "Corporate Messenger API работает. Перейдите к /docs для просмотра API."}


@app.get("/api/me", response_model=schemas.UserResponse)
def read_current_user(current_user: models.User = Depends(get_current_user)):
    return current_user