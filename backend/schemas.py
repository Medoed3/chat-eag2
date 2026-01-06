# backend/schemas.py
from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import List, Optional, ForwardRef

# Создаем forward reference для MessageResponse
MessageResponseRef = ForwardRef('MessageResponse')


# Базовая схема пользователя
class UserBase(BaseModel):
    login: str
    full_name: str
    role: str = "user"


# Создание пользователя (входные данные)
class UserCreate(UserBase):
    password: str


# Ответ с данными пользователя (без пароля)
class UserResponse(UserBase):
    id: int
    avatar_url: Optional[str] = None
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Обновление пользователя
class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    avatar_url: Optional[str] = None
    is_active: Optional[bool] = None


# Схема чата
class ChatBase(BaseModel):
    name: Optional[str] = None
    is_group: bool = False


class ChatCreate(ChatBase):
    member_ids: List[int] = []  # Для группового чата


class ChatResponse(ChatBase):
    id: int
    owner_id: Optional[int] = None
    created_at: datetime
    is_active: bool
    members: List[UserResponse] = []
    last_message: Optional[MessageResponseRef] = None

    model_config = ConfigDict(from_attributes=True)


# Схема сообщения
class MessageBase(BaseModel):
    content: Optional[str] = None
    chat_id: int
    file_url: Optional[str] = None
    file_type: Optional[str] = None


class MessageCreate(MessageBase):
    pass


class MessageResponse(MessageBase):
    id: int
    sender_id: int
    timestamp: datetime
    is_read: bool
    sender: Optional[UserResponse] = None  # Добавляем информацию об отправителе

    model_config = ConfigDict(from_attributes=True)


# Схема для входа
class LoginRequest(BaseModel):
    login: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# Разрешаем forward reference
ChatResponse.model_rebuild()
MessageResponse.model_rebuild()