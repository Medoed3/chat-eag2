# backend/api/messages.py
from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from sqlalchemy import select
from typing import List, Dict
import json
import asyncio

import schemas
import models
from auth import get_current_user
from database import get_db
from api.push import VAPID_CLAIMS, VAPID_PRIVATE_KEY
from pywebpush import webpush, WebPushException


def create_router(manager):
    router = APIRouter()

    @router.get("/chats/{chat_id}/messages", response_model=List[schemas.MessageResponse])
    def get_messages(
            chat_id: int,
            limit: int = 100,
            offset: int = 0,
            db: Session = Depends(get_db),
            current_user: models.User = Depends(get_current_user)
    ):
        """
        Получение сообщений из чата с пагинацией
        """
        chat = db.query(models.Chat).filter(models.Chat.id == chat_id).first()
        if not chat:
            raise HTTPException(status_code=404, detail="Чат не найден")

        # Проверка доступа для группового чата
        if chat.is_group:
            if current_user not in chat.members and current_user.role != "admin":
                raise HTTPException(status_code=403, detail="Доступ к чату запрещён")
        else:
            # Для личного чата
            if not (chat.owner_id == current_user.id or
                    db.query(models.chat_members).filter_by(chat_id=chat.id, user_id=current_user.id).first()):
                raise HTTPException(status_code=403, detail="Доступ к чату запрещён")

        # Получаем сообщения с пагинацией
        messages = db.query(models.Message) \
            .filter(models.Message.chat_id == chat_id) \
            .order_by(models.Message.timestamp.desc()) \
            .offset(offset) \
            .limit(limit) \
            .all()

        # Возвращаем в правильном порядке (от старых к новым)
        messages.reverse()

        return messages

    @router.post("/messages", response_model=schemas.MessageResponse, status_code=status.HTTP_201_CREATED)
    async def send_message(
            message_data: schemas.MessageCreate,
            db: Session = Depends(get_db),
            current_user: models.User = Depends(get_current_user)
    ):
        """
        Отправка нового сообщения с мгновенной доставкой через WebSocket
        """
        chat = db.query(models.Chat).filter(models.Chat.id == message_data.chat_id).first()
        if not chat:
            raise HTTPException(status_code=404, detail="Чат не найден")

        # Проверка активности чата
        if not chat.is_active:
            raise HTTPException(status_code=400, detail="Чат деактивирован")

        # Проверка доступа
        if chat.is_group:
            if current_user not in chat.members and current_user.role != "admin":
                raise HTTPException(status_code=403, detail="Нет доступа к чату")
        else:
            if not (chat.owner_id == current_user.id or
                    db.query(models.chat_members).filter_by(chat_id=chat.id, user_id=current_user.id).first()):
                raise HTTPException(status_code=403, detail="Нет доступа к чату")

        # Проверка, что есть контент
        if not message_data.content and not message_data.file_url:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Сообщение должно содержать текст или файл"
            )

        # Создаём сообщение
        db_message = models.Message(
            sender_id=current_user.id,
            chat_id=message_data.chat_id,
            content=message_data.content,
            file_url=message_data.file_url,
            file_type=message_data.file_type
        )
        db.add(db_message)
        db.commit()
        db.refresh(db_message)

        # Подгружаем отправителя для ответа
        db_message.sender = current_user

        # Формируем данные для WebSocket рассылки
        message_response = {
            "type": "new_message",
            "message": {
                "id": db_message.id,
                "content": db_message.content,
                "file_url": db_message.file_url,
                "file_type": db_message.file_type,
                "sender_id": db_message.sender_id,
                "sender_name": current_user.full_name,
                "sender_avatar": current_user.avatar_url,
                "chat_id": db_message.chat_id,
                "timestamp": db_message.timestamp.isoformat(),
                "is_read": False
            }
        }

        # ОТПРАВКА ВСЕМ ПОДКЛЮЧЕННЫМ К ЧАТУ через WebSocket
        await manager.broadcast_to_chat(chat.id, message_response)

        # Асинхронная отправка push-уведомлений (не блокирует ответ)
        asyncio.create_task(send_push_notifications(chat, current_user, db_message, db))

        return db_message

    async def send_push_notifications(chat, sender, message, db):
        """
        Асинхронная отправка push-уведомлений участникам чата
        """
        try:
            # Получаем всех участников чата, кроме отправителя
            recipients = []
            if chat.is_group:
                recipients = [user for user in chat.members if user.id != sender.id]
            else:
                # Для личного чата: получаем второго участника
                if chat.owner_id == sender.id:
                    # Ищем участника в chat_members
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
                    # Отправитель не владелец, значит владелец - получатель
                    owner = db.query(models.User).filter(models.User.id == chat.owner_id).first()
                    if owner and owner.id != sender.id:
                        recipients.append(owner)

            # Отправляем уведомления
            for recipient in recipients:
                if recipient.push_subscriptions:
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
                                        "url": f"/chat/{chat.id}"
                                    }
                                }),
                                vapid_private_key=VAPID_PRIVATE_KEY,
                                vapid_claims=VAPID_CLAIMS
                            )
                        except WebPushException as e:
                            print(f"Push failed for user {recipient.id}: {e}")
                            # Удаляем нерабочую подписку
                            if e.response and e.response.status_code == 410:
                                db.delete(subscription)
                                db.commit()
        except Exception as e:
            print(f"Error sending push notifications: {e}")

    @router.websocket("/ws/{chat_id}")
    async def websocket_endpoint(websocket: WebSocket, chat_id: int):
        """
        WebSocket endpoint для реального времени в конкретном чате
        """
        try:
            # Получаем токен из query параметров
            token = websocket.query_params.get("token")
            if not token:
                await websocket.close(code=1008)
                return

            # Верифицируем токен
            from utils.security import verify_token
            payload = verify_token(token)
            if not payload:
                await websocket.close(code=1008)
                return

            user_login = payload.get("sub")
            if not user_login:
                await websocket.close(code=1008)
                return

            # Получаем пользователя из БД
            db = next(get_db())
            current_user = db.query(models.User).filter(models.User.login == user_login).first()
            if not current_user:
                await websocket.close(code=1008)
                return

            # Проверяем существование чата
            chat = db.query(models.Chat).filter(models.Chat.id == chat_id).first()
            if not chat:
                await websocket.close(code=1008)
                return

            # Проверяем доступ к чату
            has_access = False
            if chat.is_group:
                has_access = current_user in chat.members or current_user.role == "admin"
            else:
                has_access = (chat.owner_id == current_user.id or
                              db.query(models.chat_members).filter_by(chat_id=chat.id, user_id=current_user.id).first())

            if not has_access:
                await websocket.close(code=1008)
                return

            # Принимаем WebSocket соединение (один раз!)
            await websocket.accept()

            # Подключаем к менеджеру
            await manager.connect(websocket, chat_id)

            # Отправляем подтверждение подключения
            await websocket.send_json({
                "type": "connection_established",
                "message": f"Connected to chat {chat_id}",
                "chat_id": chat_id,
                "user_id": current_user.id
            })

            # Слушаем входящие сообщения от клиента
            try:
                while True:
                    data = await websocket.receive_text()

                    try:
                        message_data = json.loads(data)

                        # Обработка индикатора набора текста
                        if message_data.get("type") == "typing":
                            typing_data = {
                                "type": "user_typing",
                                "user_id": current_user.id,
                                "user_name": current_user.full_name,
                                "chat_id": chat_id,
                                "is_typing": message_data.get("is_typing", True)
                            }
                            # Рассылаем информацию о наборе текста всем кроме отправителя
                            await manager.broadcast_to_chat(chat_id, typing_data, exclude_websocket=websocket)

                        # Обработка отметок о прочтении
                        elif message_data.get("type") == "read_receipt":
                            # Обновляем статус прочтения в БД
                            message_id = message_data.get("message_id")
                            if message_id:
                                msg = db.query(models.Message).filter(models.Message.id == message_id).first()
                                if msg and msg.chat_id == chat_id:
                                    msg.is_read = True
                                    db.commit()

                                    # Рассылаем подтверждение прочтения
                                    receipt_data = {
                                        "type": "message_read",
                                        "message_id": message_id,
                                        "chat_id": chat_id,
                                        "user_id": current_user.id
                                    }
                                    await manager.broadcast_to_chat(chat_id, receipt_data, exclude_websocket=websocket)

                    except json.JSONDecodeError:
                        await websocket.send_json({"type": "error", "error": "Invalid JSON format"})

            except WebSocketDisconnect:
                print(f"WebSocket отключен для чата {chat_id}")

            except Exception as e:
                print(f"Ошибка в WebSocket цикле: {e}")

            finally:
                # Отключаем при разрыве соединения
                manager.disconnect(websocket, chat_id)
                if 'db' in locals():
                    db.close()

        except Exception as e:
            print(f"WebSocket connection error: {e}")
            try:
                await websocket.close(code=1011)
            except:
                pass

    return router