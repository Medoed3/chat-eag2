# backend/api/messages.py - ИСПРАВЛЕННАЯ ВЕРСИЯ
from fastapi import APIRouter, Depends, HTTPException, status, Query, BackgroundTasks
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc, select
from typing import List, Optional, Dict, Any
import json
import asyncio
import uuid
from datetime import datetime, timedelta

import schemas
import models
from auth import get_current_user
from database import get_db
from utils.redis_client import redis_client
from services.message_delivery import MessageDeliveryService, get_message_delivery_service, DeliveryStatus
from api.push import VAPID_CLAIMS, VAPID_PRIVATE_KEY
from pywebpush import webpush, WebPushException

import logging

logger = logging.getLogger(__name__)


def create_router(manager):
    router = APIRouter()

    @router.get("/messages/chat/{chat_id}", response_model=List[schemas.MessageResponse])
    def get_messages_deprecated(
            chat_id: int,
            limit: int = Query(100, ge=1, le=1000),
            before_timestamp: Optional[datetime] = Query(None),
            db: Session = Depends(get_db),
            current_user: models.User = Depends(get_current_user)
    ):
        """
        Старый эндпоинт для обратной совместимости с фронтендом
        """
        # Проверка доступа к чату
        chat = db.query(models.Chat).filter(models.Chat.id == chat_id).first()
        if not chat:
            raise HTTPException(status_code=404, detail="Чат не найден")

        if not _has_chat_access(db, chat, current_user):
            raise HTTPException(status_code=403, detail="Доступ к чату запрещён")

        query = db.query(models.Message).filter(models.Message.chat_id == chat_id)

        if before_timestamp:
            query = query.filter(models.Message.server_timestamp < before_timestamp)

        messages = query.options(joinedload(models.Message.sender)) \
            .order_by(desc(models.Message.server_timestamp)) \
            .limit(limit) \
            .all()

        messages.reverse()
        return messages

    @router.get("/chats/{chat_id}/messages", response_model=List[schemas.MessageResponse])
    def get_messages(
            chat_id: int,
            limit: int = Query(100, ge=1, le=1000),
            offset: int = Query(0, ge=0),
            since: Optional[datetime] = Query(None, description="Получить сообщения начиная с этой даты"),
            db: Session = Depends(get_db),
            current_user: models.User = Depends(get_current_user)
    ):
        """
        Получение сообщений из чата с пагинацией и фильтрацией по времени
        """
        chat = db.query(models.Chat).filter(models.Chat.id == chat_id).first()
        if not chat:
            raise HTTPException(status_code=404, detail="Чат не найден")

        if not _has_chat_access(db, chat, current_user):
            raise HTTPException(status_code=403, detail="Доступ к чату запрещён")

        query = db.query(models.Message).filter(models.Message.chat_id == chat_id)

        if since:
            query = query.filter(models.Message.server_timestamp > since)

        messages = query.options(joinedload(models.Message.sender)) \
            .order_by(desc(models.Message.server_timestamp)) \
            .offset(offset) \
            .limit(limit) \
            .all()

        messages.reverse()
        return messages

    @router.get("/chats/{chat_id}/sync", response_model=schemas.SyncResponse)
    async def sync_chat(
            chat_id: int,
            last_sync_timestamp: Optional[datetime] = Query(None),
            limit: int = Query(100, ge=1, le=500),
            db: Session = Depends(get_db),
            current_user: models.User = Depends(get_current_user)
    ):
        """
        Синхронизация чата - получение новых сообщений
        """
        # logger.info(f"Sync request: chat_id={chat_id}, user_id={current_user.id}, "
        #             f"last_sync={last_sync_timestamp}, limit={limit}")

        try:
            # Проверка доступа к чату
            chat = db.query(models.Chat).filter(models.Chat.id == chat_id).first()
            if not chat:
                logger.warning(f"Chat {chat_id} not found")
                raise HTTPException(status_code=404, detail="Чат не найден")

            if not _has_chat_access(db, chat, current_user):
                logger.warning(f"User {current_user.id} has no access to chat {chat_id}")
                raise HTTPException(status_code=403, detail="Доступ к чату запрещён")

            # Получаем новые сообщения
            query = db.query(models.Message).filter(models.Message.chat_id == chat_id)

            if last_sync_timestamp:
                query = query.filter(models.Message.server_timestamp > last_sync_timestamp)
                logger.debug(f"Filtering messages after {last_sync_timestamp}")

            messages = query.options(joinedload(models.Message.sender)) \
                .order_by(models.Message.server_timestamp.asc()) \
                .limit(limit) \
                .all()

            # logger.info(f"Found {len(messages)} new messages in chat {chat_id}")

            # Получаем непрочитанные сообщения (Message объекты, а не UnreadMessage)
            delivery_service = MessageDeliveryService(db)
            undelivered_messages = delivery_service.get_undelivered_messages(current_user.id, since=last_sync_timestamp)

            # Фильтруем только для текущего чата
            chat_undelivered_messages = [
                msg for msg in undelivered_messages
                if msg.chat_id == chat_id and msg.sender_id != current_user.id
            ]

            # Загружаем отправителей для непрочитанных сообщений
            for msg in chat_undelivered_messages:
                if not hasattr(msg, 'sender') or msg.sender is None:
                    msg.sender = db.query(models.User).filter(models.User.id == msg.sender_id).first()

            # Объединяем все сообщения, убирая дубликаты
            all_message_ids = set()
            all_messages = []

            # Добавляем новые сообщения
            for msg in messages:
                if msg.id not in all_message_ids:
                    all_message_ids.add(msg.id)
                    all_messages.append(msg)

            # Добавляем непрочитанные сообщения
            for msg in chat_undelivered_messages:
                if msg.id not in all_message_ids:
                    all_message_ids.add(msg.id)
                    all_messages.append(msg)

            # Сортируем по времени
            all_messages.sort(key=lambda x: x.server_timestamp)

            # logger.info(f"Total messages for sync: {len(all_messages)}")
            # logger.info(f"Undelivered in chat {chat_id}: {len(chat_undelivered_messages)}")

            # Определяем, есть ли еще сообщения
            has_more = len(messages) == limit

            # Создаем ответ
            response = schemas.SyncResponse(
                messages=all_messages,
                unread_messages=[],  # Оставляем пустым, так как непрочитанные уже в messages
                unread_count=len(chat_undelivered_messages),
                last_sync_timestamp=datetime.utcnow(),
                has_more=has_more
            )

            # Логируем структуру ответа для отладки
            # logger.info(f"Sync response for chat {chat_id}:")
            # logger.info(f"  - messages count: {len(response.messages)}")
            # logger.info(f"  - unread count: {response.unread_count}")
            # logger.info(f"  - has_more: {response.has_more}")
            # logger.info(f"  - last_sync_timestamp: {response.last_sync_timestamp}")

            # if response.messages:
            #     first_msg = response.messages[0]
            #     last_msg = response.messages[-1]
            #     logger.info(f"  - message range: {first_msg.id} - {last_msg.id}")
            #     logger.info(f"  - first message: id={first_msg.id}, "
            #                 f"status={first_msg.delivery_status}, "
            #                 f"sender={first_msg.sender.login if first_msg.sender else 'unknown'}")

            return response

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error in sync_chat for chat {chat_id}, user {current_user.id}: {e}",
                         exc_info=True)
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise HTTPException(status_code=500, detail="Internal server error during sync")

    @router.post("/messages", response_model=schemas.MessageResponse, status_code=status.HTTP_201_CREATED)
    async def send_message(
            message_data: schemas.MessageCreate,
            background_tasks: BackgroundTasks,
            db: Session = Depends(get_db),
            current_user: models.User = Depends(get_current_user)
    ):
        """
        Отправка нового сообщения
        """
        chat = db.query(models.Chat).filter(models.Chat.id == message_data.chat_id).first()
        if not chat:
            raise HTTPException(status_code=404, detail="Чат не найден")

        if not chat.is_active:
            raise HTTPException(status_code=400, detail="Чат деактивирован")

        if not _has_chat_access(db, chat, current_user):
            raise HTTPException(status_code=403, detail="Нет доступа к чату")

        if not message_data.content and not message_data.file_url:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Сообщение должно содержать текст или файл"
            )

        delivery_service = MessageDeliveryService(db)

        message, result = await delivery_service.send_message(
            sender_id=current_user.id,
            chat_id=message_data.chat_id,
            content=message_data.content,
            file_url=message_data.file_url,
            file_type=message_data.file_type,
            client_message_id=message_data.client_message_id
        )

        if not message:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Не удалось отправить сообщение: {result}"
            )

        if result == "duplicate":
            return message

        # Загружаем отправителя
        db.refresh(message)
        message.sender = current_user

        # Отправляем уведомление через WebSocket
        await manager.broadcast_notification(chat.id, {
            "type": "new_message",
            "message_id": message.id,
            "chat_id": chat.id,
            "sender_id": current_user.id,
            "client_message_id": message.client_message_id,
            "timestamp": message.server_timestamp.isoformat(),
            "content": message.content
        })

        # Фоновая задача для push-уведомлений
        background_tasks.add_task(
            send_push_notifications_background,
            chat, current_user, message, db
        )

        logger.info(f"Message {message.id} sent successfully")
        return message

    @router.get("/messages/{message_id}", response_model=schemas.MessageResponse)
    def get_message(
            message_id: int,
            db: Session = Depends(get_db),
            current_user: models.User = Depends(get_current_user)
    ):
        message = db.query(models.Message).options(joinedload(models.Message.sender)) \
            .filter(models.Message.id == message_id).first()
        if not message:
            raise HTTPException(status_code=404, detail="Сообщение не найдено")

        chat = db.query(models.Chat).filter(models.Chat.id == message.chat_id).first()
        if not chat or not _has_chat_access(db, chat, current_user):
            raise HTTPException(status_code=403, detail="Доступ к сообщению запрещён")

        return message

    @router.post("/messages/{message_id}/delivered", status_code=status.HTTP_200_OK)
    async def confirm_delivery(
            message_id: int,
            confirmation: schemas.DeliveryConfirmation,
            db: Session = Depends(get_db),
            current_user: models.User = Depends(get_current_user)
    ):
        message = db.query(models.Message).filter(models.Message.id == message_id).first()
        if not message:
            raise HTTPException(status_code=404, detail="Сообщение не найдено")

        chat = db.query(models.Chat).filter(models.Chat.id == message.chat_id).first()
        if not chat or not _has_chat_access(db, chat, current_user):
            raise HTTPException(status_code=403, detail="Доступ запрещён")

        if confirmation.user_id != current_user.id and current_user.role != "admin":
            raise HTTPException(status_code=403, detail="Можно подтверждать только свою доставку")

        delivery_service = MessageDeliveryService(db)
        success = await delivery_service.confirm_delivery(
            message_id=message_id,
            user_id=confirmation.user_id,
            delivered_at=confirmation.delivered_at
        )

        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Не удалось подтвердить доставку"
            )

        notification = {
            "type": "delivery_confirmed",
            "message_id": message_id,
            "user_id": confirmation.user_id,
            "delivered_at": confirmation.delivered_at.isoformat() if confirmation.delivered_at else None,
            "chat_id": message.chat_id
        }

        await manager.broadcast_notification(message.chat_id, notification)

        return {"status": "confirmed", "message_id": message_id, "user_id": confirmation.user_id}

    @router.post("/messages/{message_id}/read", status_code=status.HTTP_200_OK)
    async def confirm_read(
            message_id: int,
            confirmation: schemas.ReadConfirmation,
            db: Session = Depends(get_db),
            current_user: models.User = Depends(get_current_user)
    ):
        message = db.query(models.Message).filter(models.Message.id == message_id).first()
        if not message:
            raise HTTPException(status_code=404, detail="Сообщение не найдено")

        chat = db.query(models.Chat).filter(models.Chat.id == message.chat_id).first()
        if not chat or not _has_chat_access(db, chat, current_user):
            raise HTTPException(status_code=403, detail="Доступ запрещён")

        if confirmation.user_id != current_user.id and current_user.role != "admin":
            raise HTTPException(status_code=403, detail="Можно подтверждать только свое прочтение")

        delivery_service = MessageDeliveryService(db)
        success = await delivery_service.confirm_read(
            message_id=message_id,
            user_id=confirmation.user_id,
            read_at=confirmation.read_at
        )

        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Не удалось подтвердить прочтение"
            )

        notification = {
            "type": "read_confirmed",
            "message_id": message_id,
            "user_id": confirmation.user_id,
            "read_at": confirmation.read_at.isoformat() if confirmation.read_at else None,
            "chat_id": message.chat_id
        }

        await manager.broadcast_notification(message.chat_id, notification)

        return {"status": "read", "message_id": message_id, "user_id": confirmation.user_id}

    @router.get("/users/{user_id}/undelivered", response_model=List[schemas.MessageResponse])
    def get_undelivered_messages(
            user_id: int,
            db: Session = Depends(get_db),
            current_user: models.User = Depends(get_current_user)
    ):
        if user_id != current_user.id and current_user.role != "admin":
            raise HTTPException(status_code=403, detail="Доступ запрещён")

        delivery_service = MessageDeliveryService(db)
        messages = delivery_service.get_undelivered_messages(user_id)

        # Загружаем отправителей
        for msg in messages:
            if not hasattr(msg, 'sender') or msg.sender is None:
                msg.sender = db.query(models.User).filter(models.User.id == msg.sender_id).first()

        return messages

    @router.post("/messages/batch/status", status_code=status.HTTP_200_OK)
    async def update_message_status_batch(
            updates: List[schemas.MessageStatusUpdate],
            db: Session = Depends(get_db),
            current_user: models.User = Depends(get_current_user)
    ):
        if not updates:
            return {"updated": 0, "failed": 0}

        updated_count = 0
        failed_count = 0

        for update in updates:
            try:
                message = db.query(models.Message).filter(models.Message.id == update.message_id).first()
                if not message:
                    failed_count += 1
                    continue

                chat = db.query(models.Chat).filter(models.Chat.id == message.chat_id).first()
                if not chat or not _has_chat_access(db, chat, current_user):
                    failed_count += 1
                    continue

                # Конвертируем строковый статус в enum
                if isinstance(update.delivery_status, str):
                    try:
                        update.delivery_status = DeliveryStatus(update.delivery_status)
                    except ValueError:
                        update.delivery_status = DeliveryStatus.PENDING

                message.delivery_status = update.delivery_status
                if update.delivered_at:
                    message.delivered_at = update.delivered_at
                if update.read_at:
                    message.read_at = update.read_at

                updated_count += 1

            except Exception as e:
                logger.error(f"Error updating message {update.message_id}: {e}")
                failed_count += 1

        db.commit()

        return {
            "updated": updated_count,
            "failed": failed_count,
            "total": len(updates)
        }

    @router.get("/chats/{chat_id}/delivery-stats")
    async def get_delivery_stats(
            chat_id: int,
            db: Session = Depends(get_db),
            current_user: models.User = Depends(get_current_user)
    ):
        chat = db.query(models.Chat).filter(models.Chat.id == chat_id).first()
        if not chat or not _has_chat_access(db, chat, current_user):
            raise HTTPException(status_code=403, detail="Доступ запрещён")

        stats = {
            "total_messages": db.query(models.Message).filter(models.Message.chat_id == chat_id).count(),
            "delivered": db.query(models.Message).filter(
                models.Message.chat_id == chat_id,
                models.Message.delivery_status == DeliveryStatus.DELIVERED.value
            ).count(),
            "read": db.query(models.Message).filter(
                models.Message.chat_id == chat_id,
                models.Message.delivery_status == DeliveryStatus.READ.value
            ).count(),
            "pending": db.query(models.Message).filter(
                models.Message.chat_id == chat_id,
                models.Message.delivery_status.in_([DeliveryStatus.PENDING.value, DeliveryStatus.SENDING.value])
            ).count(),
            "failed": db.query(models.Message).filter(
                models.Message.chat_id == chat_id,
                models.Message.delivery_status == DeliveryStatus.FAILED.value
            ).count(),
            "online_users": len(manager.get_online_users_in_chat(chat_id))
        }

        if stats["total_messages"] > 0:
            stats["delivery_rate"] = (stats["delivered"] / stats["total_messages"]) * 100
            stats["read_rate"] = (stats["read"] / stats["total_messages"]) * 100
        else:
            stats["delivery_rate"] = 0
            stats["read_rate"] = 0

        return stats

    def _has_chat_access(db: Session, chat: models.Chat, user: models.User) -> bool:
        if chat.is_group:
            return user in chat.members or user.role == "admin"
        else:
            return (chat.owner_id == user.id or
                    db.query(models.chat_members).filter_by(chat_id=chat.id, user_id=user.id).first())

    async def send_push_notifications_background(chat, sender, message, db):
        try:
            recipients = []
            if chat.is_group:
                recipients = [user for user in chat.members if user.id != sender.id]
            else:
                if chat.owner_id == sender.id:
                    result = db.execute(
                        select(models.chat_members.c.user_id)
                        .where(models.chat_members.c.chat_id == chat.id)
                    ).first()
                    if result:
                        other_user_id = result[0]
                        other_user = db.query(models.User).filter(models.User.id == other_user_id).first()
                        if other_user:
                            recipients.append(other_user)
                else:
                    owner = db.query(models.User).filter(models.User.id == chat.owner_id).first()
                    if owner and owner.id != sender.id:
                        recipients.append(owner)

            for recipient in recipients:
                is_online = redis_client.is_user_online(recipient.id)

                if not is_online and recipient.push_subscriptions:
                    for subscription in recipient.push_subscriptions:
                        try:
                            webpush(
                                subscription_info={
                                    "endpoint": subscription.endpoint,
                                    "keys": json.loads(subscription.keys)
                                },
                                data=json.dumps({
                                    "title": f"Новое сообщение от {sender.full_name}",
                                    "body": message.content[:100] if message.content else "📎 Фото, видео или файл",
                                    "icon": "/icons/icon-192x192.png",
                                    "badge": "/icons/icon-72x72.png",
                                    "tag": f"chat_{chat.id}",
                                    "data": {
                                        "chat_id": chat.id,
                                        "message_id": message.id,
                                        "message_client_id": str(message.client_message_id),
                                        "url": f"/chat/{chat.id}"
                                    }
                                }),
                                vapid_private_key=VAPID_PRIVATE_KEY,
                                vapid_claims=VAPID_CLAIMS
                            )
                            logger.info(f"Push sent to offline user {recipient.id}")
                        except WebPushException as e:
                            logger.error(f"Push failed for user {recipient.id}: {e}")
                            if e.response and e.response.status_code == 410:
                                db.delete(subscription)
                                db.commit()
                else:
                    logger.debug(f"User {recipient.id} is online, push not needed")

        except Exception as e:
            logger.error(f"Error sending push notifications: {e}")

    return router