# backend/api/admin.py - ОБНОВЛЯЕМ импорты
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Dict, Optional
from sqlalchemy import or_, and_

# Абсолютные импорты
import models
import schemas
from auth import get_current_user
from database import get_db

router = APIRouter()


def check_admin(user: models.User = Depends(get_current_user)):
    """Проверяет, является ли пользователь администратором"""
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Требуются права администратора"
        )
    return user


@router.get("/admin/stats", response_model=schemas.AdminStats)
def get_admin_stats(
        db: Session = Depends(get_db),
        current_user: models.User = Depends(check_admin)
) -> Dict:
    """
    Возвращает статистику системы для администратора
    """
    total_users = db.query(models.User).count()
    active_users = db.query(models.User).filter(models.User.is_active == True).count()
    total_chats = db.query(models.Chat).count()
    active_chats = db.query(models.Chat).filter(models.Chat.is_active == True).count()
    total_messages = db.query(models.Message).count()

    # Статистика по типам чатов
    group_chats = db.query(models.Chat).filter(models.Chat.is_group == True).count()
    personal_chats = db.query(models.Chat).filter(models.Chat.is_group == False).count()

    # Последние 24 часа
    from datetime import datetime, timedelta
    last_24h = datetime.utcnow() - timedelta(days=1)
    new_users_24h = db.query(models.User).filter(models.User.created_at >= last_24h).count()
    new_messages_24h = db.query(models.Message).filter(models.Message.timestamp >= last_24h).count()

    return {
        "total_users": total_users,
        "active_users": active_users,
        "total_chats": total_chats,
        "active_chats": active_chats,
        "group_chats": group_chats,
        "personal_chats": personal_chats,
        "total_messages": total_messages,
        "new_users_24h": new_users_24h,
        "new_messages_24h": new_messages_24h
    }


@router.get("/admin/users", response_model=List[schemas.UserResponse])
def admin_list_users(
        db: Session = Depends(get_db),
        current_user: models.User = Depends(check_admin),
        is_active: Optional[bool] = Query(None, description="Фильтр по активности"),
        role: Optional[str] = Query(None, description="Фильтр по роли"),
        skip: int = Query(0, ge=0),
        limit: int = Query(100, ge=1, le=500)
):
    """
    Возвращает список всех пользователей с фильтрацией (только для админов)
    """
    query = db.query(models.User)

    # Применяем фильтры
    if is_active is not None:
        query = query.filter(models.User.is_active == is_active)
    if role:
        query = query.filter(models.User.role == role)

    # Сортировка по дате создания (сначала новые)
    query = query.order_by(models.User.created_at.desc())

    # Пагинация
    users = query.offset(skip).limit(limit).all()
    return users


@router.post("/admin/users/{user_id}/activate")
def admin_activate_user(
        user_id: int,
        db: Session = Depends(get_db),
        current_user: models.User = Depends(check_admin)
):
    """Активирует пользователя (админ)"""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    user.is_active = True
    db.commit()
    return {"status": "success", "message": f"Пользователь {user.login} активирован"}


@router.post("/admin/users/{user_id}/deactivate")
def admin_deactivate_user(
        user_id: int,
        db: Session = Depends(get_db),
        current_user: models.User = Depends(check_admin)
):
    """Деактивирует пользователя (админ)"""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Нельзя деактивировать самого себя")

    user.is_active = False
    db.commit()
    return {"status": "success", "message": f"Пользователь {user.login} деактивирован"}


@router.post("/admin/users/bulk-activate")
def admin_bulk_activate_users(
        data: schemas.BulkUserOperation,
        db: Session = Depends(get_db),
        current_user: models.User = Depends(check_admin)
):
    """Массовая активация пользователей"""
    users = db.query(models.User).filter(models.User.id.in_(data.user_ids)).all()

    if len(users) != len(data.user_ids):
        raise HTTPException(status_code=404, detail="Некоторые пользователи не найдены")

    for user in users:
        if user.id != current_user.id:  # Не трогаем себя
            user.is_active = True

    db.commit()
    return {"status": "success", "message": f"Активировано {len(users)} пользователей"}


@router.post("/admin/users/bulk-deactivate")
def admin_bulk_deactivate_users(
        data: schemas.BulkUserOperation,
        db: Session = Depends(get_db),
        current_user: models.User = Depends(check_admin)
):
    """Массовая деактивация пользователей"""
    users = db.query(models.User).filter(models.User.id.in_(data.user_ids)).all()

    if len(users) != len(data.user_ids):
        raise HTTPException(status_code=404, detail="Некоторые пользователи не найдены")

    # Фильтруем себя из списка
    users_to_deactivate = [u for u in users if u.id != current_user.id]

    for user in users_to_deactivate:
        user.is_active = False

    db.commit()
    return {"status": "success", "message": f"Деактивировано {len(users_to_deactivate)} пользователей"}


@router.get("/admin/chats", response_model=List[schemas.ChatResponse])
def admin_list_chats(
        db: Session = Depends(get_db),
        current_user: models.User = Depends(check_admin),
        is_group: Optional[bool] = Query(None, description="Фильтр по типу чата"),
        is_active: Optional[bool] = Query(None, description="Фильтр по активности"),
        search: Optional[str] = Query(None, description="Поиск по названию"),
        skip: int = Query(0, ge=0),
        limit: int = Query(100, ge=1, le=500)
):
    """
    Возвращает список всех чатов с фильтрацией (только для админов)
    """
    query = db.query(models.Chat)

    # Применяем фильтры
    if is_group is not None:
        query = query.filter(models.Chat.is_group == is_group)
    if is_active is not None:
        query = query.filter(models.Chat.is_active == is_active)
    if search:
        query = query.filter(models.Chat.name.ilike(f"%{search}%"))

    # Сортировка: сначала активные, потом по дате создания
    query = query.order_by(
        models.Chat.is_active.desc(),
        models.Chat.created_at.desc()
    )

    # Пагинация
    chats = query.offset(skip).limit(limit).all()

    # Загружаем последние сообщения для каждого чата
    for chat in chats:
        last_msg = db.query(models.Message).filter(models.Message.chat_id == chat.id) \
            .order_by(models.Message.timestamp.desc()).first()
        chat.last_message = last_msg

    return chats


@router.get("/admin/chats/{chat_id}", response_model=schemas.ChatResponse)
def admin_get_chat(
        chat_id: int,
        db: Session = Depends(get_db),
        current_user: models.User = Depends(check_admin)
):
    """Получает информацию о чате (админ)"""
    chat = db.query(models.Chat).filter(models.Chat.id == chat_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Чат не найден")

    # Загружаем последнее сообщение
    last_msg = db.query(models.Message).filter(models.Message.chat_id == chat_id) \
        .order_by(models.Message.timestamp.desc()).first()
    chat.last_message = last_msg

    return chat


@router.post("/admin/chats/{chat_id}/activate")
def admin_activate_chat(
        chat_id: int,
        db: Session = Depends(get_db),
        current_user: models.User = Depends(check_admin)
):
    """Активирует чат (админ)"""
    chat = db.query(models.Chat).filter(models.Chat.id == chat_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Чат не найден")

    chat.is_active = True
    db.commit()
    return {"status": "success", "message": f"Чат активирован"}


@router.post("/admin/chats/{chat_id}/deactivate")
def admin_deactivate_chat(
        chat_id: int,
        db: Session = Depends(get_db),
        current_user: models.User = Depends(check_admin)
):
    """Деактивирует чат (админ)"""
    chat = db.query(models.Chat).filter(models.Chat.id == chat_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Чат не найден")

    chat.is_active = False
    db.commit()
    return {"status": "success", "message": f"Чат деактивирован"}


@router.post("/admin/chats/bulk-activate")
def admin_bulk_activate_chats(
        data: schemas.BulkChatOperation,
        db: Session = Depends(get_db),
        current_user: models.User = Depends(check_admin)
):
    """Массовая активация чатов"""
    chats = db.query(models.Chat).filter(models.Chat.id.in_(data.chat_ids)).all()

    if len(chats) != len(data.chat_ids):
        raise HTTPException(status_code=404, detail="Некоторые чаты не найдены")

    for chat in chats:
        chat.is_active = True

    db.commit()
    return {"status": "success", "message": f"Активировано {len(chats)} чатов"}


@router.post("/admin/chats/bulk-deactivate")
def admin_bulk_deactivate_chats(
        data: schemas.BulkChatOperation,
        db: Session = Depends(get_db),
        current_user: models.User = Depends(check_admin)
):
    """Массовая деактивация чатов"""
    chats = db.query(models.Chat).filter(models.Chat.id.in_(data.chat_ids)).all()

    if len(chats) != len(data.chat_ids):
        raise HTTPException(status_code=404, detail="Некоторые чаты не найдены")

    for chat in chats:
        chat.is_active = False

    db.commit()
    return {"status": "success", "message": f"Деактивировано {len(chats)} чатов"}


@router.get("/admin/health")
def health_check():
    """Проверка здоровья сервера"""
    return {"status": "healthy"}


@router.patch("/admin/users/{user_id}/toggle-active", response_model=schemas.UserResponse)
def toggle_user_active(
        user_id: int,
        db: Session = Depends(get_db),
        current_user: models.User = Depends(check_admin)
):
    """
    Переключает статус is_active пользователя.
    Админ не может деактивировать себя.
    """
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Нельзя деактивировать самого себя")

    user.is_active = not user.is_active
    db.commit()
    db.refresh(user)
    return user