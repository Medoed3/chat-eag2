# backend/models.py
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, Table, JSON
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime

# Ассоциативная таблица для связи "многие ко многим" — пользователи и групповые чаты
chat_members = Table(
    "chat_members",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE")),
    Column("chat_id", Integer, ForeignKey("chats.id", ondelete="CASCADE"))
)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    login = Column(String(50), unique=True, index=True, nullable=False)
    full_name = Column(String(100), nullable=False)
    password_hash = Column(String(128), nullable=False)
    role = Column(String(20), default="user")  # "user" или "admin"
    avatar_url = Column(String(200), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Связь: пользователь — личные чаты (владелец)
    owned_chats = relationship("Chat", foreign_keys="[Chat.owner_id]", back_populates="owner")
    # Связь: пользователь — групповые чаты (через ассоциативную таблицу)
    group_chats = relationship("Chat", secondary=chat_members, back_populates="members")
    # Связь: сообщения, отправленные пользователем
    messages = relationship("Message", back_populates="sender")
    # Связь: push-подписки
    push_subscriptions = relationship("PushSubscription", back_populates="user", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<User(login='{self.login}', full_name='{self.full_name}', role='{self.role}')>"


class Chat(Base):
    __tablename__ = "chats"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=True)  # Для группового чата
    is_group = Column(Boolean, default=False)  # False = личный чат
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Владелец (для личного чата)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)  # Добавлено

    # Связи
    owner = relationship("User", foreign_keys=[owner_id], back_populates="owned_chats")
    members = relationship("User", secondary=chat_members, back_populates="group_chats")
    messages = relationship("Message", back_populates="chat", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Chat(name='{self.name}', is_group={self.is_group}, is_active={self.is_active})>"


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text, nullable=True)  # Текст сообщения
    file_url = Column(String(200), nullable=True)  # Путь к файлу: фото, видео, документ
    file_type = Column(String(20), nullable=True)  # 'image', 'video', 'document'
    sender_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    chat_id = Column(Integer, ForeignKey("chats.id", ondelete="CASCADE"), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    is_read = Column(Boolean, default=False)

    # Связи
    sender = relationship("User", back_populates="messages")
    chat = relationship("Chat", back_populates="messages")

    def __repr__(self):
        return f"<Message(sender_id={self.sender_id}, chat_id={self.chat_id}, timestamp={self.timestamp})>"


class PushSubscription(Base):
    __tablename__ = "push_subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    endpoint = Column(Text, nullable=False)
    keys = Column(Text, nullable=False)  # JSON строка с p256dh и auth
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="push_subscriptions")

    def __repr__(self):
        return f"<PushSubscription(user_id={self.user_id}, endpoint={self.endpoint[:50]}...)>"