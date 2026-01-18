# backend/services/message_delivery.py - ИСПРАВЛЕННАЯ ВЕРСИЯ
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import uuid
import logging
from enum import Enum
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_

from models import Message, User, Chat, MessageDelivery, UnreadMessage, DeliveryStatus
from utils.redis_client import redis_client
from models import chat_members

logger = logging.getLogger(__name__)


class MessageDeliveryService:
    def __init__(self, db: Session):
        self.db = db

    async def send_message(
            self,
            sender_id: int,
            chat_id: int,
            content: Optional[str] = None,
            file_url: Optional[str] = None,
            file_type: Optional[str] = None,
            client_message_id: Optional[str] = None
    ) -> Tuple[Optional[Message], str]:
        """
        Основной метод отправки сообщения с гарантированной доставкой
        """
        if not client_message_id:
            client_message_id = str(uuid.uuid4())

        # Проверяем дубликаты
        existing_message = self._check_duplicate_message(client_message_id)
        if existing_message:
            logger.info(f"Duplicate message {client_message_id} detected")
            return existing_message, "duplicate"

        try:
            # Сохраняем сообщение в БД
            message = Message(
                client_message_id=client_message_id,
                sender_id=sender_id,
                chat_id=chat_id,
                content=content,
                file_url=file_url,
                file_type=file_type,
                delivery_status=DeliveryStatus.PENDING.value,
                server_timestamp=datetime.utcnow(),
                timestamp=datetime.utcnow()
            )

            self.db.add(message)
            self.db.flush()

            logger.info(f"Message {message.id} saved with client_id {client_message_id}")

        except Exception as e:
            logger.error(f"Failed to save message: {e}")
            self.db.rollback()
            return None, "db_error"

        try:
            # Получаем чат с участниками
            chat = self.db.query(Chat).options(
                joinedload(Chat.members),
                joinedload(Chat.owner)
            ).filter(Chat.id == chat_id).first()

            if not chat:
                logger.error(f"Chat {chat_id} not found")
                self.db.rollback()
                return None, "chat_not_found"

            # Создаем записи доставки для участников
            participants = self._get_chat_participants(chat)
            delivery_entries = []

            for participant in participants:
                if participant.id != sender_id:
                    delivery = MessageDelivery(
                        message_id=message.id,
                        user_id=participant.id,
                        chat_id=chat_id,
                        status=DeliveryStatus.PENDING.value,
                        created_at=datetime.utcnow(),
                        updated_at=datetime.utcnow()
                    )
                    self.db.add(delivery)
                    delivery_entries.append(delivery)

            self.db.commit()
            logger.info(f"Created {len(delivery_entries)} delivery entries")

        except Exception as e:
            logger.error(f"Error creating delivery entries: {e}")
            self.db.rollback()
            return None, "delivery_error"

        try:
            # Уведомляем онлайн пользователей
            participants = self._get_chat_participants(chat)
            online_users_notified = await self._notify_online_users(message, chat, participants)

            # Обрабатываем оффлайн пользователей
            offline_users_queued = await self._handle_offline_users(message, chat, participants, online_users_notified)

            logger.info(
                f"Message {message.id}: {len(online_users_notified)} online, {len(offline_users_queued)} offline")

            # Обновляем статус сообщения
            if online_users_notified:
                message.delivery_status = DeliveryStatus.DELIVERED.value
            else:
                message.delivery_status = DeliveryStatus.PENDING.value

            self.db.commit()
            return message, "sent"

        except Exception as e:
            logger.error(f"Error in delivery pipeline: {e}")
            return message, "partial_error"

    def _check_duplicate_message(self, client_message_id: str) -> Optional[Message]:
        return self.db.query(Message).options(joinedload(Message.sender)) \
            .filter(Message.client_message_id == client_message_id).first()

    def _get_chat_participants(self, chat: Chat) -> List[User]:
        participants = set()

        if chat.is_group:
            for member in chat.members:
                participants.add(member)
        else:
            if chat.owner:
                participants.add(chat.owner)
            for member in chat.members:
                participants.add(member)

        return list(participants)

    async def _notify_online_users(self, message: Message, chat: Chat, participants: List[User]) -> set:
        notified_users = set()

        try:
            online_users = redis_client.get_online_users_in_chat(chat.id)

            notification = {
                "type": "new_message",
                "message_id": message.id,
                "chat_id": chat.id,
                "sender_id": message.sender_id,
                "client_message_id": str(message.client_message_id),
                "timestamp": message.server_timestamp.isoformat() if message.server_timestamp else None,
                "content": message.content
            }

            await redis_client.publish_message(chat.id, notification)
            logger.debug(f"Notification published for message {message.id}")

            # Обновляем статус доставки для онлайн пользователей
            for user in participants:
                if user.id != message.sender_id and user.id in online_users:
                    try:
                        delivery = self.db.query(MessageDelivery).filter(
                            MessageDelivery.message_id == message.id,
                            MessageDelivery.user_id == user.id
                        ).first()

                        if delivery:
                            delivery.status = DeliveryStatus.DELIVERED.value
                            delivery.delivered_at = datetime.utcnow()
                            delivery.updated_at = datetime.utcnow()
                            notified_users.add(user.id)
                            logger.debug(f"Message {message.id} delivered to online user {user.id}")

                    except Exception as e:
                        logger.error(f"Error updating delivery for user {user.id}: {e}")
                        self.db.rollback()

            self.db.commit()
            return notified_users

        except Exception as e:
            logger.error(f"Error notifying online users: {e}")
            return notified_users

    async def _handle_offline_users(self, message: Message, chat: Chat, participants: List[User],
                                    online_users: set) -> set:
        queued_users = set()

        try:
            for user in participants:
                if user.id != message.sender_id and user.id not in online_users:
                    try:
                        # Добавляем в непрочитанные
                        unread = UnreadMessage(
                            message_id=message.id,
                            user_id=user.id,
                            chat_id=chat.id,
                            stored_at=datetime.utcnow()
                        )
                        self.db.add(unread)

                        # Ставим задачу на push-уведомление
                        redis_client.enqueue_notification("push", {
                            "user_id": user.id,
                            "message_id": message.id,
                            "chat_id": chat.id,
                            "sender_id": message.sender_id,
                            "content_preview": message.content[:100] if message.content else "Файл"
                        })

                        queued_users.add(user.id)
                        logger.debug(f"Message {message.id} queued for offline user {user.id}")

                    except Exception as e:
                        logger.error(f"Error queuing for user {user.id}: {e}")

            self.db.commit()
            return queued_users

        except Exception as e:
            logger.error(f"Error handling offline users: {e}")
            self.db.rollback()
            return queued_users

    async def confirm_delivery(
            self,
            message_id: int,
            user_id: int,
            delivered_at: Optional[datetime] = None
    ) -> bool:
        try:
            if not delivered_at:
                delivered_at = datetime.utcnow()

            delivery = self.db.query(MessageDelivery).filter(
                MessageDelivery.message_id == message_id,
                MessageDelivery.user_id == user_id
            ).first()

            if not delivery:
                logger.warning(f"No delivery record for message {message_id}, user {user_id}")
                return False

            delivery.status = DeliveryStatus.DELIVERED.value
            delivery.delivered_at = delivered_at
            delivery.updated_at = datetime.utcnow()

            # Убираем из непрочитанных
            unread = self.db.query(UnreadMessage).filter(
                UnreadMessage.message_id == message_id,
                UnreadMessage.user_id == user_id
            ).first()

            if unread:
                unread.delivered_at = delivered_at

            self.db.commit()

            # Обновляем общий статус сообщения
            self._update_message_status(message_id)

            logger.info(f"Message {message_id} delivered to user {user_id}")
            return True

        except Exception as e:
            logger.error(f"Error confirming delivery: {e}")
            self.db.rollback()
            return False

    async def confirm_read(
            self,
            message_id: int,
            user_id: int,
            read_at: Optional[datetime] = None
    ) -> bool:
        try:
            if not read_at:
                read_at = datetime.utcnow()

            delivery = self.db.query(MessageDelivery).filter(
                MessageDelivery.message_id == message_id,
                MessageDelivery.user_id == user_id
            ).first()

            if not delivery:
                logger.warning(f"No delivery record for message {message_id}, user {user_id}")
                return False

            delivery.status = DeliveryStatus.READ.value
            delivery.read_at = read_at
            delivery.updated_at = datetime.utcnow()

            # Удаляем из непрочитанных
            unread = self.db.query(UnreadMessage).filter(
                UnreadMessage.message_id == message_id,
                UnreadMessage.user_id == user_id
            ).first()

            if unread:
                self.db.delete(unread)

            self.db.commit()

            self._update_message_status(message_id)

            logger.info(f"Message {message_id} read by user {user_id}")
            return True

        except Exception as e:
            logger.error(f"Error confirming read: {e}")
            self.db.rollback()
            return False

    def _update_message_status(self, message_id: int):
        try:
            deliveries = self.db.query(MessageDelivery).filter(
                MessageDelivery.message_id == message_id
            ).all()

            if not deliveries:
                return

            message = self.db.query(Message).filter(Message.id == message_id).first()
            if not message:
                return

            # Проверяем статусы всех доставок
            all_delivered = all(d.status == DeliveryStatus.DELIVERED.value for d in deliveries)
            all_read = all(d.status == DeliveryStatus.READ.value for d in deliveries)

            if all_read:
                message.delivery_status = DeliveryStatus.READ.value
                message.read_at = datetime.utcnow()
            elif all_delivered:
                message.delivery_status = DeliveryStatus.DELIVERED.value
                message.delivered_at = datetime.utcnow()

            self.db.commit()

        except Exception as e:
            logger.error(f"Error updating message status: {e}")

    def get_undelivered_messages(self, user_id: int, since: Optional[datetime] = None) -> List[Message]:
        """Получает НЕПРОЧИТАННЫЕ сообщения для пользователя"""
        try:
            # Используем связь через UnreadMessage
            query = self.db.query(Message).join(UnreadMessage).filter(
                UnreadMessage.user_id == user_id,
                UnreadMessage.delivered_at.is_(None)
            )

            if since:
                query = query.filter(Message.server_timestamp > since)

            # Загружаем отправителя
            messages = query.options(joinedload(Message.sender)) \
                .order_by(Message.server_timestamp.asc()).all()

            logger.debug(f"Found {len(messages)} undelivered messages for user {user_id} from UnreadMessage")
            return messages

        except Exception as e:
            logger.error(f"Error getting undelivered messages: {e}")
            return []

    async def retry_failed_deliveries(self, max_retries: int = 3):
        try:
            failed_deliveries = self.db.query(MessageDelivery).filter(
                MessageDelivery.status == DeliveryStatus.FAILED.value,
                MessageDelivery.retry_count < max_retries,
                MessageDelivery.last_retry_at < datetime.utcnow() - timedelta(minutes=5)
            ).all()

            for delivery in failed_deliveries:
                try:
                    is_online = redis_client.is_user_online(delivery.user_id)

                    if is_online:
                        notification = {
                            "type": "retry_message",
                            "message_id": delivery.message_id,
                            "chat_id": delivery.chat_id,
                            "user_id": delivery.user_id
                        }

                        await redis_client.publish_message(delivery.chat_id, notification)

                        delivery.retry_count += 1
                        delivery.last_retry_at = datetime.utcnow()
                        delivery.updated_at = datetime.utcnow()

                        logger.info(f"Retry {delivery.retry_count} for message {delivery.message_id}")

                except Exception as e:
                    logger.error(f"Error retrying delivery {delivery.id}: {e}")

            self.db.commit()

        except Exception as e:
            logger.error(f"Error retrying failed deliveries: {e}")
            self.db.rollback()

    def get_user_unread_count(self, user_id: int) -> int:
        try:
            unread_count = self.db.query(UnreadMessage).filter(
                UnreadMessage.user_id == user_id,
                UnreadMessage.delivered_at.is_(None)
            ).count()

            pending_count = self.db.query(MessageDelivery).filter(
                MessageDelivery.user_id == user_id,
                MessageDelivery.status == DeliveryStatus.PENDING.value
            ).count()

            return unread_count + pending_count

        except Exception as e:
            logger.error(f"Error getting unread count: {e}")
            return 0


def get_message_delivery_service(db: Session) -> MessageDeliveryService:
    return MessageDeliveryService(db)