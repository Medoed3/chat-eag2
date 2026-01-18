# backend/models.py - ИСПРАВЛЕННАЯ ВЕРСИЯ
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, Table, JSON, Enum
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime
import enum
import uuid

# Ассоциативная таблица для связи "многие ко многим" — пользователи и групповые чаты
chat_members = Table(
    "chat_members",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE")),
    Column("chat_id", Integer, ForeignKey("chats.id", ondelete="CASCADE"))
)


class DeliveryStatus(enum.Enum):
    """Статусы доставки сообщения"""
    SENDING = "SENDING"
    PENDING = "PENDING"
    DELIVERED = "DELIVERED"
    READ = "READ"
    FAILED = "FAILED"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    login = Column(String(50), unique=True, index=True, nullable=False)
    full_name = Column(String(100), nullable=False)
    password_hash = Column(String(128), nullable=False)
    role = Column(String(20), default="user")
    avatar_url = Column(String(200), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Связи
    owned_chats = relationship("Chat", foreign_keys="[Chat.owner_id]", back_populates="owner")
    group_chats = relationship("Chat", secondary=chat_members, back_populates="members")
    messages = relationship("Message", back_populates="sender")
    push_subscriptions = relationship("PushSubscription", back_populates="user", cascade="all, delete-orphan")
    message_deliveries = relationship("MessageDelivery", back_populates="user", cascade="all, delete-orphan")
    unread_messages = relationship("UnreadMessage", back_populates="user", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<User(login='{self.login}', full_name='{self.full_name}', role='{self.role}')>"


class Chat(Base):
    __tablename__ = "chats"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=True)
    is_group = Column(Boolean, default=False)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)

    # Связи
    owner = relationship("User", foreign_keys=[owner_id], back_populates="owned_chats")
    members = relationship("User", secondary=chat_members, back_populates="group_chats")
    messages = relationship("Message", back_populates="chat", cascade="all, delete-orphan")
    message_deliveries = relationship("MessageDelivery", back_populates="chat", cascade="all, delete-orphan")
    unread_messages = relationship("UnreadMessage", back_populates="chat", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Chat(name='{self.name}', is_group={self.is_group}, is_active={self.is_active})>"


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    client_message_id = Column(String(36), unique=True, index=True, nullable=False, default=lambda: str(uuid.uuid4()))
    content = Column(Text, nullable=True)
    file_url = Column(String(200), nullable=True)
    file_type = Column(String(20), nullable=True)
    sender_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    chat_id = Column(Integer, ForeignKey("chats.id", ondelete="CASCADE"), nullable=False)
    server_timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    delivery_status = Column(Enum(DeliveryStatus), default=DeliveryStatus.PENDING, nullable=False)
    is_read = Column(Boolean, default=False)
    delivered_at = Column(DateTime, nullable=True)
    read_at = Column(DateTime, nullable=True)

    # Связи
    sender = relationship("User", back_populates="messages")
    chat = relationship("Chat", back_populates="messages")
    deliveries = relationship("MessageDelivery", back_populates="message", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Message(id={self.id}, client_id={self.client_message_id}, status={self.delivery_status})>"

    # ДОБАВЛЕНО: Свойства для совместимости
    @property
    def is_read_compat(self) -> bool:
        """Свойство для обратной совместимости с фронтендом"""
        return self.delivery_status == DeliveryStatus.READ

    @property
    def timestamp_compat(self) -> datetime:
        """Свойство для обратной совместимости с фронтендом"""
        return self.timestamp or self.server_timestamp


class MessageDelivery(Base):
    """Таблица для отслеживания доставки сообщения каждому участнику чата"""
    __tablename__ = "message_deliveries"

    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(Integer, ForeignKey("messages.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    chat_id = Column(Integer, ForeignKey("chats.id", ondelete="CASCADE"), nullable=False)

    status = Column(Enum(DeliveryStatus), default=DeliveryStatus.PENDING, nullable=False)
    delivered_at = Column(DateTime, nullable=True)
    read_at = Column(DateTime, nullable=True)
    retry_count = Column(Integer, default=0)
    last_retry_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Связи
    message = relationship("Message", back_populates="deliveries")
    user = relationship("User", back_populates="message_deliveries")
    chat = relationship("Chat", back_populates="message_deliveries")

    def __repr__(self):
        return f"<MessageDelivery(message={self.message_id}, user={self.user_id}, status={self.status})>"


class UnreadMessage(Base):
    """Таблица для хранения непрочитанных сообщений оффлайн-пользователей"""
    __tablename__ = "unread_messages"

    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(Integer, ForeignKey("messages.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    chat_id = Column(Integer, ForeignKey("chats.id", ondelete="CASCADE"), nullable=False)
    stored_at = Column(DateTime, default=datetime.utcnow)
    delivered_at = Column(DateTime, nullable=True)
    notification_sent = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Связи
    message = relationship("Message")
    user = relationship("User", back_populates="unread_messages")
    chat = relationship("Chat", back_populates="unread_messages")

    def __repr__(self):
        return f"<UnreadMessage(message={self.message_id}, user={self.user_id})>"


class PushSubscription(Base):
    __tablename__ = "push_subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    endpoint = Column(Text, nullable=False)
    keys = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="push_subscriptions")

    def __repr__(self):
        return f"<PushSubscription(user_id={self.user_id}, endpoint={self.endpoint[:50]}...)>"