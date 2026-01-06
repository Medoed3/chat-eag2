# backend/main.py
# Основной файл приложения FastAPI

from fastapi import FastAPI, Depends, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
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

# ЕДИНСТВЕННЫЙ менеджер
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            await connection.send_json(message)

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