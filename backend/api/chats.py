# backend/api/chats.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from sqlalchemy import or_, and_

from models import Chat, User, chat_members, Message
from schemas import ChatCreate, ChatResponse
from auth import get_current_user
from database import get_db

router = APIRouter()


# Получение списка чатов
@router.get("/chats", response_model=List[ChatResponse])
def get_chats(
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """
    Возвращает все чаты, в которых состоит пользователь.
    Админ видит все чаты в системе.
    """
    if current_user.role == "admin":
        # Админ видит все чаты
        chats = db.query(Chat).all()
    else:
        # Обычный пользователь — только свои
        chats = db.query(Chat).filter(
            Chat.is_group == True,
            Chat.members.any(User.id == current_user.id)
        ).all()

        # Личные чаты: где он owner или участник
        private_chats = db.query(Chat).filter(
            Chat.is_group == False,
            or_(
                Chat.owner_id == current_user.id,
                chat_members.c.user_id == current_user.id
            )
        ).all()

        chats += private_chats

    # Убедимся, что нет дублей
    chat_dict = {chat.id: chat for chat in chats}
    chats = list(chat_dict.values())

    # Сортировка: по последнему сообщению
    for chat in chats:
        last_msg = db.query(Message).filter(Message.chat_id == chat.id) \
            .order_by(Message.timestamp.desc()).first()
        chat.last_message = last_msg

    return chats


# Получение одного чата по ID
@router.get("/chats/{chat_id}", response_model=ChatResponse)
def get_chat(
        chat_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """
    Возвращает данные чата по ID.
    Пользователь должен быть участником чата или админом.
    """
    chat = db.query(Chat).filter(Chat.id == chat_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Чат не найден")

    # Админ видит любой чат
    if current_user.role == "admin":
        # Подтягиваем последнее сообщение
        last_msg = db.query(Message).filter(Message.chat_id == chat_id) \
            .order_by(Message.timestamp.desc()).first()
        chat.last_message = last_msg
        return chat

    # Проверка участия пользователя
    is_member = False

    if chat.is_group:
        # Для группового чата: проверка через связь many-to-many
        is_member = current_user in chat.members
    else:
        # Для личного чата: проверка owner_id или запись в chat_members
        is_member = (chat.owner_id == current_user.id or
                     db.query(chat_members).filter(
                         chat_members.c.chat_id == chat_id,
                         chat_members.c.user_id == current_user.id
                     ).first() is not None)

    if not is_member:
        raise HTTPException(status_code=403, detail="Доступ к чату запрещён")

    # Подтягиваем последнее сообщение
    last_msg = db.query(Message).filter(Message.chat_id == chat_id) \
        .order_by(Message.timestamp.desc()).first()
    chat.last_message = last_msg

    return chat


@router.post("/chats", response_model=ChatResponse, status_code=status.HTTP_201_CREATED)
def create_chat(
        chat_data: ChatCreate,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """
    Создаёт чат:
    - Если is_group=True → групповой, name обязательно, member_ids — участники
    - Если is_group=False → личный, member_ids должен содержать ровно одного собеседника
    """
    if chat_data.is_group:
        # Проверка: name обязательно для группового чата
        if not chat_data.name or chat_data.name.strip() == "":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Название обязательно для группового чата"
            )

        # Проверка: есть ли участники
        if not chat_data.member_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Групповой чат должен иметь хотя бы одного участника"
            )

        # Проверка: все пользователи существуют
        members = db.query(User).filter(User.id.in_(chat_data.member_ids)).all()
        if len(members) != len(chat_data.member_ids):
            raise HTTPException(status_code=404, detail="Один или несколько пользователей не найдены")

        # Создаём групповой чат
        chat = Chat(
            name=chat_data.name.strip(),
            is_group=True,
            owner_id=current_user.id
        )
        db.add(chat)
        db.flush()

        # Добавляем участников (включая создателя)
        all_members = members + [current_user]
        chat.members.extend(all_members)

        db.commit()
        db.refresh(chat)
        return chat

    else:
        # ЛИЧНЫЙ ЧАТ: проверка входных данных
        if len(chat_data.member_ids) != 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Личный чат должен иметь ровно одного собеседника"
            )

        other_user_id = chat_data.member_ids[0]
        if other_user_id == current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Нельзя создать чат с самим собой"
            )

        other_user = db.query(User).filter(User.id == other_user_id).first()
        if not other_user:
            raise HTTPException(status_code=404, detail="Пользователь не найден")

        # Проверка: существует ли уже личный чат между этими пользователями?
        existing_chat = db.query(Chat).filter(
            Chat.is_group == False,
            or_(
                # Вариант 1: current_user - owner, other_user - member
                and_(
                    Chat.owner_id == current_user.id,
                    db.query(chat_members).filter(
                        chat_members.c.chat_id == Chat.id,
                        chat_members.c.user_id == other_user_id
                    ).exists()
                ),
                # Вариант 2: other_user - owner, current_user - member
                and_(
                    Chat.owner_id == other_user_id,
                    db.query(chat_members).filter(
                        chat_members.c.chat_id == Chat.id,
                        chat_members.c.user_id == current_user.id
                    ).exists()
                )
            )
        ).first()

        if existing_chat:
            return existing_chat

        # Создаём новый личный чат
        chat = Chat(
            is_group=False,
            owner_id=current_user.id
        )
        db.add(chat)
        db.flush()

        # Добавляем второго участника через chat_members
        db.execute(
            chat_members.insert().values(
                user_id=other_user_id,
                chat_id=chat.id
            )
        )

        db.commit()
        db.refresh(chat)
        return chat


# -------------------------
# 🔧 НОВЫЕ ЭНДПОИНТЫ
# -------------------------

@router.patch("/chats/{chat_id}")
def update_chat(
        chat_id: int,
        name: str,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """
    Редактирование названия группового чата
    """
    chat = db.query(Chat).filter(Chat.id == chat_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Чат не найден")

    if not chat.is_group:
        raise HTTPException(status_code=400, detail="Название личного чата нельзя изменить")

    if not name.strip():
        raise HTTPException(status_code=400, detail="Название не может быть пустым")

    chat.name = name.strip()
    db.commit()
    db.refresh(chat)
    return chat


@router.delete("/chats/{chat_id}")
def delete_chat(
        chat_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """
    Полное удаление чата (только для админов)
    """
    # Проверка прав
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Только администратор может удалять чаты")

    chat = db.query(Chat).filter(Chat.id == chat_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Чат не найден")

    db.delete(chat)
    db.commit()
    return {"status": "deleted"}


@router.post("/chats/{chat_id}/members")
def add_chat_member(
        chat_id: int,
        user_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """
    Добавить участника в групповой чат
    """
    chat = db.query(Chat).filter(Chat.id == chat_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Чат не найден")

    if not chat.is_group:
        raise HTTPException(status_code=400, detail="В личный чат нельзя добавлять участников")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    # Проверка, уже ли участник
    if user in chat.members:
        raise HTTPException(status_code=400, detail="Пользователь уже в чате")

    chat.members.append(user)
    db.commit()
    return {"status": "success"}


@router.delete("/chats/{chat_id}/members/{user_id}")
def remove_chat_member(
        chat_id: int,
        user_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """
    Удалить участника из группового чата
    """
    chat = db.query(Chat).filter(Chat.id == chat_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Чат не найден")

    if not chat.is_group:
        raise HTTPException(status_code=400, detail="Из личного чата нельзя удалять участников")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    if user not in chat.members:
        raise HTTPException(status_code=400, detail="Пользователь не является участником чата")

    # Нельзя удалить владельца (админ может, но не себя)
    if user.id == chat.owner_id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Нельзя удалить создателя чата")

    chat.members.remove(user)
    db.commit()
    return {"status": "removed"}


@router.patch("/chats/{chat_id}/toggle-active")
def toggle_chat_active(
        chat_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """
    Переключает статус is_active чата (только для админов)
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Только администратор может деактивировать чаты")

    chat = db.query(Chat).filter(Chat.id == chat_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Чат не найден")

    chat.is_active = not chat.is_active
    db.commit()
    db.refresh(chat)
    return chat