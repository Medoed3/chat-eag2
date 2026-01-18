# backend/schemas.py - ИСПРАВЛЕННАЯ ВЕРСИЯ
from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime
from typing import List, Optional, Any, Dict
from enum import Enum
import uuid


# ========== БАЗОВЫЕ СХЕМЫ ==========

class UserBase(BaseModel):
    login: str
    full_name: str
    role: str = "user"
    avatar_url: Optional[str] = None


class UserCreate(UserBase):
    password: str


class UserResponse(UserBase):
    id: int
    avatar_url: Optional[str] = None
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    avatar_url: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = None


class BulkUserOperation(BaseModel):
    user_ids: List[int]


class ChatBase(BaseModel):
    name: Optional[str] = None
    is_group: bool = False


class ChatCreate(ChatBase):
    member_ids: List[int] = []


# ========== СХЕМЫ СТАТУСОВ ДОСТАВКИ ==========

class DeliveryStatus(str, Enum):
    """Статусы доставки сообщения"""
    SENDING = "SENDING"
    PENDING = "PENDING"
    DELIVERED = "DELIVERED"
    READ = "READ"
    FAILED = "FAILED"


# ========== СХЕМЫ СООБЩЕНИЙ ==========

class MessageBase(BaseModel):
    content: Optional[str] = None
    file_url: Optional[str] = None
    file_type: Optional[str] = None
    chat_id: int


class MessageCreate(MessageBase):
    client_message_id: Optional[str] = None
    client_request_id: Optional[str] = None


# Сначала определяем UserResponse для sender
class MessageResponseSender(BaseModel):
    id: int
    login: str
    full_name: str
    avatar_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class MessageResponse(BaseModel):
    id: int
    client_message_id: str
    content: Optional[str] = None
    file_url: Optional[str] = None
    file_type: Optional[str] = None
    sender_id: int
    chat_id: int
    timestamp: datetime
    server_timestamp: datetime
    delivery_status: DeliveryStatus
    is_read: bool
    delivered_at: Optional[datetime] = None
    read_at: Optional[datetime] = None
    sender: Optional[MessageResponseSender] = None

    model_config = ConfigDict(from_attributes=True)


class ChatResponse(ChatBase):
    id: int
    owner_id: Optional[int] = None
    created_at: datetime
    is_active: bool
    members: List[UserResponse] = []
    last_message: Optional[MessageResponse] = None
    unread_count: int = 0

    model_config = ConfigDict(from_attributes=True)


# ========== СХЕМЫ ДОСТАВКИ И СИНХРОНИЗАЦИИ ==========

class MessageDeliveryResponse(BaseModel):
    message_id: int
    user_id: int
    status: DeliveryStatus
    delivered_at: Optional[datetime] = None
    read_at: Optional[datetime] = None
    retry_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class DeliveryConfirmation(BaseModel):
    user_id: int
    delivered_at: Optional[datetime] = None


class ReadConfirmation(BaseModel):
    user_id: int
    read_at: Optional[datetime] = None


class MessageStatusUpdate(BaseModel):
    message_id: int
    delivery_status: DeliveryStatus
    delivered_at: Optional[datetime] = None
    read_at: Optional[datetime] = None


# ========== СХЕМА ОТВЕТА СИНХРОНИЗАЦИИ ==========

class SyncResponse(BaseModel):
    messages: List[MessageResponse] = []
    unread_messages: List[MessageResponse] = []  # Изменили с UnreadMessageResponse на MessageResponse
    unread_count: int = 0
    last_sync_timestamp: datetime
    has_more: bool = False


# ========== СУЩЕСТВУЮЩИЕ СХЕМЫ ==========

class LoginRequest(BaseModel):
    login: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class AdminStats(BaseModel):
    total_users: int
    active_users: int
    total_chats: int
    active_chats: int
    group_chats: int
    personal_chats: int
    total_messages: int
    new_users_24h: int
    new_messages_24h: int


class AddMemberRequest(BaseModel):
    user_id: int


class BulkChatOperation(BaseModel):
    chat_ids: List[int]


# ========== ДОПОЛНИТЕЛЬНЫЕ СХЕМЫ ==========

class MediaUploadResponse(BaseModel):
    url: str
    type: str
    filename: str


class HealthResponse(BaseModel):
    status: str
    timestamp: datetime
    db_status: str
    redis_status: str


class ErrorResponse(BaseModel):
    detail: str
    error_code: Optional[str] = None


class WebsocketNotification(BaseModel):
    type: str
    message_id: Optional[int] = None
    chat_id: Optional[int] = None
    sender_id: Optional[int] = None
    client_message_id: Optional[str] = None
    timestamp: Optional[datetime] = None
    content: Optional[str] = None
    user_id: Optional[int] = None
    delivered_at: Optional[datetime] = None
    read_at: Optional[datetime] = None


# Схемы для метрик
class MetricData(BaseModel):
    name: str
    value: float
    tags: Dict[str, str] = {}
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class MetricResponse(BaseModel):
    metrics: List[MetricData]
    period: str


# Схема для проверки доступа к чату
class ChatAccessResponse(BaseModel):
    chat_id: int
    chat_name: str
    is_group: bool
    is_active: bool
    is_member: bool
    has_access: bool
    owner_id: Optional[int] = None
    members_count: int = 0
    unread_count: int = 0
    last_activity: Optional[datetime] = None


# Схема для push-уведомлений
class PushSubscriptionCreate(BaseModel):
    endpoint: str
    keys: Dict[str, str]


class PushSubscriptionResponse(BaseModel):
    id: int
    endpoint: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Схема для сериализации сообщений с совместимостью
class MessageResponseCompat(MessageResponse):
    """Схема MessageResponse с обратной совместимостью"""

    @property
    def is_read(self) -> bool:
        return self.delivery_status == DeliveryStatus.READ

    @property
    def timestamp(self) -> datetime:
        return self.server_timestamp