# backend/api/metrics.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from datetime import datetime, timedelta
from typing import Dict, Any, List

from database import get_db
import models
from services.metrics import metrics_service
from utils.redis_client import redis_client
import schemas

router = APIRouter()


@router.get("/metrics", response_model=Dict[str, Any])
async def get_metrics():
    """
    Получение метрик в формате Prometheus
    """
    return {"metrics": metrics_service.export_prometheus()}


@router.get("/metrics/json", response_model=Dict[str, Any])
async def get_metrics_json():
    """
    Получение метрик в формате JSON
    """
    return metrics_service.get_all_metrics()


@router.get("/metrics/stats", response_model=Dict[str, Any])
async def get_system_stats(
        db: Session = Depends(get_db)
):
    """
    Получение статистики системы
    """
    try:
        # Базовые метрики из БД
        total_users = db.query(func.count(models.User.id)).scalar()
        active_users = db.query(func.count(models.User.id)).filter(models.User.is_active == True).scalar()

        total_chats = db.query(func.count(models.Chat.id)).scalar()
        active_chats = db.query(func.count(models.Chat.id)).filter(models.Chat.is_active == True).scalar()

        total_messages = db.query(func.count(models.Message.id)).scalar()

        # Новые пользователи за 24 часа
        yesterday = datetime.utcnow() - timedelta(days=1)
        new_users_24h = db.query(func.count(models.User.id)).filter(
            models.User.created_at >= yesterday
        ).scalar()

        # Новые сообщения за 24 часа
        new_messages_24h = db.query(func.count(models.Message.id)).filter(
            models.Message.server_timestamp >= yesterday
        ).scalar()

        # Онлайн пользователи из Redis
        online_users = 0
        try:
            if redis_client.is_connected:
                pattern = "user:*:connections"
                keys = redis_client._redis.keys(pattern)
                for key in keys:
                    connections = redis_client._redis.smembers(key)
                    if connections:
                        online_users += 1
            else:
                online_users = -2  # Redis не подключен
        except Exception as e:
            online_users = -1  # Ошибка получения
            logger.error(f"Error getting online users: {e}")

        # Статистика доставки
        delivery_stats = {}
        try:
            for chat in db.query(models.Chat).limit(10).all():
                stats = metrics_service.get_delivery_stats(chat.id)
                if stats:
                    delivery_stats[chat.id] = stats
        except Exception as e:
            logger.error(f"Error getting delivery stats: {e}")

        return {
            "users": {
                "total": total_users or 0,
                "active": active_users or 0,
                "online": online_users,
                "new_24h": new_users_24h or 0
            },
            "chats": {
                "total": total_chats or 0,
                "active": active_chats or 0,
                "group": db.query(func.count(models.Chat.id)).filter(models.Chat.is_group == True).scalar() or 0,
                "personal": db.query(func.count(models.Chat.id)).filter(models.Chat.is_group == False).scalar() or 0
            },
            "messages": {
                "total": total_messages or 0,
                "new_24h": new_messages_24h or 0,
                "delivered": db.query(func.count(models.Message.id)).filter(
                    models.Message.delivery_status == "delivered"
                ).scalar() or 0,
                "read": db.query(func.count(models.Message.id)).filter(
                    models.Message.delivery_status == "read"
                ).scalar() or 0,
                "pending": db.query(func.count(models.Message.id)).filter(
                    models.Message.delivery_status == "pending"
                ).scalar() or 0,
                "failed": db.query(func.count(models.Message.id)).filter(
                    models.Message.delivery_status == "failed"
                ).scalar() or 0
            },
            "delivery_stats": delivery_stats,
            "timestamp": datetime.utcnow().isoformat()
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting stats: {str(e)}")


@router.get("/metrics/chats/{chat_id}/delivery")
async def get_chat_delivery_metrics(
        chat_id: int,
        db: Session = Depends(get_db)
):
    """
    Получение метрик доставки для конкретного чата
    """
    # Проверяем существование чата
    chat = db.query(models.Chat).filter(models.Chat.id == chat_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    # Получаем статистику из Redis
    stats = metrics_service.get_delivery_stats(chat_id)

    # Получаем статистику из БД
    messages_stats = db.query(
        func.count(models.Message.id).label("total"),
        func.count(models.Message.id).filter(models.Message.delivery_status == "delivered").label("delivered"),
        func.count(models.Message.id).filter(models.Message.delivery_status == "read").label("read"),
        func.count(models.Message.id).filter(models.Message.delivery_status == "pending").label("pending"),
        func.count(models.Message.id).filter(models.Message.delivery_status == "failed").label("failed")
    ).filter(models.Message.chat_id == chat_id).first()

    # Онлайн пользователи в чате
    online_users = []
    try:
        if redis_client.is_connected:
            online_users = redis_client.get_online_users_in_chat(chat_id)
    except Exception as e:
        logger.error(f"Error getting online users in chat: {e}")

    total = messages_stats.total or 0
    delivered = messages_stats.delivered or 0
    read = messages_stats.read or 0

    return {
        "chat_id": chat_id,
        "chat_name": chat.name,
        "is_group": chat.is_group,
        "messages": {
            "total": total,
            "delivered": delivered,
            "read": read,
            "pending": messages_stats.pending or 0,
            "failed": messages_stats.failed or 0,
            "delivery_rate": (delivered / total * 100) if total > 0 else 0,
            "read_rate": (read / total * 100) if total > 0 else 0
        },
        "delivery_times": stats,
        "online_users": len(online_users),
        "participants": len(chat.members) if chat.is_group else 2
    }


@router.get("/metrics/users/{user_id}/activity")
async def get_user_activity_metrics(
        user_id: int,
        db: Session = Depends(get_db),
        period: str = "24h"  # 24h, 7d, 30d
):
    """
    Получение метрик активности пользователя
    """
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Определяем период
    now = datetime.utcnow()
    if period == "24h":
        start_date = now - timedelta(hours=24)
    elif period == "7d":
        start_date = now - timedelta(days=7)
    else:  # 30d
        start_date = now - timedelta(days=30)

    # Сообщения пользователя
    messages_sent = db.query(func.count(models.Message.id)).filter(
        models.Message.sender_id == user_id,
        models.Message.server_timestamp >= start_date
    ).scalar() or 0

    # Чаты пользователя
    user_chats = db.query(models.Chat).filter(
        models.Chat.is_active == True,
        models.Chat.is_group == True,
        models.Chat.members.any(id=user_id)
    ).count() or 0

    # Время последней активности
    last_message = db.query(models.Message).filter(
        models.Message.sender_id == user_id
    ).order_by(models.Message.server_timestamp.desc()).first()

    last_activity = last_message.server_timestamp if last_message else user.created_at

    # Онлайн статус
    is_online = False
    try:
        if redis_client.is_connected:
            is_online = redis_client.is_user_online(user_id)
    except Exception as e:
        logger.error(f"Error checking user online status: {e}")

    # Подключения пользователя
    user_connections = []
    try:
        if redis_client.is_connected:
            user_connections = redis_client.get_user_connections(user_id)
    except Exception as e:
        logger.error(f"Error getting user connections: {e}")

    return {
        "user_id": user_id,
        "user_name": user.full_name,
        "period": period,
        "messages_sent": messages_sent,
        "active_chats": user_chats,
        "last_activity": last_activity.isoformat() if last_activity else None,
        "is_online": is_online,
        "online_sessions": len(user_connections),
        "account_age_days": (now - user.created_at).days if user.created_at else 0
    }


@router.get("/metrics/system/health")
async def get_system_health():
    """
    Получение здоровья системы
    """
    health_status = {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "components": {}
    }

    # Проверка Redis
    try:
        redis_ok = redis_client.ping()
        health_status["components"]["redis"] = {
            "status": "healthy" if redis_ok else "unhealthy",
            "latency": None
        }
        if not redis_ok:
            health_status["status"] = "degraded"
    except Exception as e:
        health_status["components"]["redis"] = {
            "status": "unhealthy",
            "error": str(e)
        }
        health_status["status"] = "degraded"

    # Проверка базы данных
    try:
        from database import SessionLocal
        db = SessionLocal()
        db.execute("SELECT 1")
        db.close()
        health_status["components"]["database"] = {
            "status": "healthy"
        }
    except Exception as e:
        health_status["components"]["database"] = {
            "status": "unhealthy",
            "error": str(e)
        }
        health_status["status"] = "unhealthy"

    # Проверка WebSocket соединений
    try:
        # Получаем количество активных соединений
        from main import manager
        active_connections = len(manager.active_connections)
        health_status["components"]["websocket"] = {
            "status": "healthy",
            "active_connections": active_connections
        }
    except Exception as e:
        health_status["components"]["websocket"] = {
            "status": "unhealthy",
            "error": str(e)
        }
        health_status["status"] = "degraded"

    # Метрики производительности
    try:
        # Получаем метрики из локального хранилища
        request_duration = metrics_service.get_metric("request_duration_seconds")
        if request_duration and "_default" in request_duration["value"]:
            data = request_duration["value"]["_default"]
            if data["count"] > 0:
                avg_duration = data["sum"] / data["count"]
                health_status["performance"] = {
                    "avg_request_duration_seconds": avg_duration,
                    "total_requests": data["count"]
                }
    except Exception as e:
        logger.error(f"Error getting performance metrics: {e}")

    return health_status