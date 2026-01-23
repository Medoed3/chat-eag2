# backend/api/chats.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from sqlalchemy import or_, and_
from pydantic import BaseModel

from models import Chat, User, chat_members, Message
from schemas import ChatCreate, ChatResponse, BulkUserOperation
from auth import get_current_user
from database import get_db

router = APIRouter()


# Схема для добавления участника в чат
class AddMemberRequest(BaseModel):
    """
    Схема Pydantic для валидации запроса на добавление участника.
    Содержит одно поле: user_id - ID пользователя, которого нужно добавить.
    """
    user_id: int


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
        # Обычный пользователь — только свои групповые чаты
        group_chats = db.query(Chat).filter(
            Chat.is_group == True,
            Chat.members.any(User.id == current_user.id)
        ).all()

        # Личные чаты: где он owner или участник
        private_chats = db.query(Chat).filter(
            Chat.is_group == False
        ).join(
            chat_members,
            chat_members.c.chat_id == Chat.id,
            isouter=True
        ).filter(
            or_(
                Chat.owner_id == current_user.id,
                chat_members.c.user_id == current_user.id
            )
        ).distinct().all()

        chats = group_chats + private_chats

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
# 🔧 НОВЫЕ И ИСПРАВЛЕННЫЕ ЭНДПОИНТЫ
# -------------------------

# backend/api/chats.py - ДОБАВЛЯЕМ НОВЫЙ ЭНДПОИНТ

@router.post("/chats/personal/{user_id}", response_model=ChatResponse)
def get_or_create_personal_chat(
        user_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """
    Получает существующий или создает новый личный чат с указанным пользователем
    """
    # Проверяем существование собеседника
    other_user = db.query(User).filter(
        User.id == user_id,
        User.is_active == True
    ).first()

    if not other_user:
        raise HTTPException(status_code=404, detail="Пользователь не найден или неактивен")

    # Проверяем, существует ли уже личный чат между этими пользователями
    existing_chat = db.query(Chat).filter(
        Chat.is_group == False,
        or_(
            # Вариант 1: current_user - owner, other_user - member
            and_(
                Chat.owner_id == current_user.id,
                db.query(chat_members).filter(
                    chat_members.c.chat_id == Chat.id,
                    chat_members.c.user_id == other_user.id
                ).exists()
            ),
            # Вариант 2: other_user - owner, current_user - member
            and_(
                Chat.owner_id == other_user.id,
                db.query(chat_members).filter(
                    chat_members.c.chat_id == Chat.id,
                    chat_members.c.user_id == current_user.id
                ).exists()
            )
        )
    ).first()

    if existing_chat:
        # Если чат уже существует, возвращаем его
        # Подтягиваем последнее сообщение
        last_msg = db.query(Message).filter(Message.chat_id == existing_chat.id) \
            .order_by(Message.timestamp.desc()).first()
        existing_chat.last_message = last_msg
        return existing_chat

    # Создаем новый личный чат
    chat = Chat(
        is_group=False,
        owner_id=current_user.id,
        name=None  # У личных чатов нет названия
    )
    db.add(chat)
    db.flush()  # Получаем ID чата

    # Добавляем собеседника через chat_members
    db.execute(
        chat_members.insert().values(
            user_id=other_user.id,
            chat_id=chat.id
        )
    )

    # Добавляем создателя в участники
    db.execute(
        chat_members.insert().values(
            user_id=current_user.id,
            chat_id=chat.id
        )
    )

    db.commit()
    db.refresh(chat)

    return chat


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
        request: AddMemberRequest,  # Принимаем данные из тела запроса (JSON)
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """
    Добавить участника в групповой чат.
    ТОЛЬКО для администраторов.

    Принимает JSON в теле запроса:
    {
        "user_id": 123
    }
    """
    user_id = request.user_id  # Получаем user_id из тела запроса

    # 1. Проверяем существование чата
    chat = db.query(Chat).filter(Chat.id == chat_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Чат не найден")

    # 2. Проверяем, что чат активен
    if not chat.is_active:
        raise HTTPException(status_code=400, detail="Чат неактивен")

    # 3. Проверяем, что чат групповой
    if not chat.is_group:
        raise HTTPException(status_code=400, detail="В личный чат нельзя добавлять участников")

    # 4. Проверка прав доступа (только администратор)
    if current_user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Только администратор может добавлять участников в чат"
        )

    # 5. Проверяем существование пользователя
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    # 6. Проверяем активность пользователя
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Пользователь неактивен")

    # 7. Проверяем, не является ли пользователь уже участником чата
    if user in chat.members:
        raise HTTPException(status_code=400, detail="Пользователь уже в чате")

    # 8. Добавляем пользователя в чат
    chat.members.append(user)
    db.commit()

    # 9. Возвращаем успешный ответ
    return {
        "status": "success",
        "message": f"Пользователь {user.full_name} добавлен в чат",
        "chat_id": chat.id,
        "user_id": user.id,
        "user_name": user.full_name
    }


@router.post("/chats/{chat_id}/members/bulk")
def add_chat_members_bulk(
        chat_id: int,
        request: BulkUserOperation,  # Используем существующую схему для массовых операций
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """
    Массовое добавление участников в групповой чат.
    ТОЛЬКО для администраторов.

    Принимает JSON в теле запроса:
    {
        "user_ids": [123, 456, 789]
    }
    """
    # 1. Проверяем существование чата
    chat = db.query(Chat).filter(Chat.id == chat_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Чат не найден")

    # 2. Проверяем, что чат активен
    if not chat.is_active:
        raise HTTPException(status_code=400, detail="Чат неактивен")

    # 3. Проверяем, что чат групповой
    if not chat.is_group:
        raise HTTPException(status_code=400, detail="В личный чат нельзя добавлять участников")

    # 4. Проверка прав доступа (только администратор)
    if current_user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Только администратор может добавлять участников в чат"
        )

    # 5. Проверка максимального количества участников (максимум 100)
    MAX_MEMBERS = 100
    current_member_count = len(chat.members)
    trying_to_add = len(request.user_ids)

    if current_member_count + trying_to_add > MAX_MEMBERS:
        raise HTTPException(
            status_code=400,
            detail=f"Превышено максимальное количество участников ({MAX_MEMBERS}). "
                   f"Сейчас в чате: {current_member_count}, "
                   f"пытаетесь добавить: {trying_to_add}"
        )

    # 6. Получаем всех пользователей из базы данных
    users = db.query(User).filter(User.id.in_(request.user_ids)).all()

    # 7. Проверяем, что все пользователи найдены
    if len(users) != len(request.user_ids):
        found_ids = [user.id for user in users]
        missing_ids = [uid for uid in request.user_ids if uid not in found_ids]
        raise HTTPException(
            status_code=404,
            detail=f"Пользователи с ID {missing_ids} не найдены"
        )

    # 8. Фильтруем активных пользователей
    active_users = [user for user in users if user.is_active]

    # 9. Фильтруем пользователей, которых еще нет в чате
    new_users = [user for user in active_users if user not in chat.members]

    # 10. Если нет новых пользователей для добавления
    if not new_users:
        already_in_chat = [user for user in active_users if user in chat.members]
        if already_in_chat:
            raise HTTPException(
                status_code=400,
                detail=f"Все выбранные пользователи уже в чате"
            )
        else:
            raise HTTPException(
                status_code=400,
                detail="Все выбранные пользователи неактивны"
            )

    # 11. Добавляем пользователей в чат
    chat.members.extend(new_users)
    db.commit()

    # 12. Возвращаем подробный отчет
    return {
        "status": "success",
        "added_count": len(new_users),
        "skipped_count": len(users) - len(new_users),
        "message": f"Успешно добавлено {len(new_users)} пользователей в чат",
        "chat_id": chat.id,
        "added_user_ids": [user.id for user in new_users],
        "added_user_names": [user.full_name for user in new_users]
    }


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

    # Нельзя удалить владельца (админ может удалить любого, кроме себя)
    if user.id == chat.owner_id:
        if current_user.role != "admin":
            raise HTTPException(status_code=403, detail="Нельзя удалить создателя чата")
        elif user.id == current_user.id:
            raise HTTPException(status_code=403, detail="Нельзя удалить себя из чата")

    chat.members.remove(user)
    db.commit()

    return {
        "status": "removed",
        "message": f"Пользователь {user.full_name} удален из чата",
        "chat_id": chat.id,
        "user_id": user.id
    }


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

    status_text = "активирован" if chat.is_active else "деактивирован"
    return {
        "status": "success",
        "message": f"Чат {status_text}",
        "chat_id": chat.id,
        "is_active": chat.is_active
    }


@router.get("/chats/{chat_id}/access")
def check_chat_access(
    chat_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Проверка доступа пользователя к чату
    Возвращает информацию о правах доступа и статусе активности
    """
    chat = db.query(Chat).filter(Chat.id == chat_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Чат не найден")

    # Проверяем участие в чате
    is_member = False
    has_access = False

    if chat.is_group:
        # Для группового чата: проверка через связь many-to-many
        is_member = current_user in chat.members
        has_access = is_member or current_user.role == "admin"
    else:
        # Для личного чата: проверка owner_id или запись в chat_members
        is_member = (chat.owner_id == current_user.id or
                     db.query(chat_members).filter(
                         chat_members.c.chat_id == chat_id,
                         chat_members.c.user_id == current_user.id
                     ).first() is not None)
        has_access = is_member

    return {
        "chat_id": chat.id,
        "chat_name": chat.name if chat.is_group else f"Личный чат",
        "is_group": chat.is_group,
        "is_active": chat.is_active,
        "is_member": is_member,
        "has_access": has_access,
        "is_owner": chat.owner_id == current_user.id,
        "user_role": current_user.role,
        "message": "Доступ разрешен" if has_access else "Доступ запрещен"
    }