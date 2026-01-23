# backend/api/users.py
# Роуты для управления пользователями и контактами

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from models import User
from schemas import UserResponse, UserCreate, UserUpdate
from auth import get_current_user
from database import get_db
from utils.security import get_password_hash

router = APIRouter()


def check_admin(user: User = Depends(get_current_user)):
    """Проверяет, является ли пользователь админом и активен"""
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Требуются права администратора"
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Невозможно выполнить действие: пользователь деактивирован"
        )
    return user


@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
        user_data: UserCreate,
        db: Session = Depends(get_db),
        current_user: User = Depends(check_admin)
):
    """Создаёт нового пользователя (только админ)"""
    # Проверяем, существует ли уже логин
    if db.query(User).filter(User.login == user_data.login).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пользователь с таким логином уже существует"
        )

    # Хешируем пароль
    hashed_password = get_password_hash(user_data.password)

    # Создаём пользователя
    db_user = User(
        login=user_data.login,
        full_name=user_data.full_name,
        password_hash=hashed_password,
        role=user_data.role,
        is_active=True
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


@router.get("/users", response_model=List[UserResponse])
def get_users(
        db: Session = Depends(get_db),
        current_user: User = Depends(check_admin)
):
    """Получает список всех пользователей (только админ)"""
    users = db.query(User).all()
    return users


@router.get("/users/contacts", response_model=List[UserResponse])
def get_contacts(
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Получает список всех активных пользователей (исключая текущего) для всех пользователей"""
    try:
        # Проверяем, активен ли текущий пользователь
        if not current_user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Невозможно получить контакты: пользователь деактивирован"
            )
            
        # Получаем всех активных пользователей, кроме текущего
        users = db.query(User).filter(
            User.is_active == True,
            User.id != current_user.id
        ).order_by(User.full_name).all()

        # Добавляем дополнительную информацию к каждому контакту
        for user in users:
            user.department = _get_user_department(user.id)
            user.position = _get_user_position(user.id)
            user.email = f"{user.login}@company.com"
            user.phone = _get_user_phone(user.id)
            user.is_online = _is_user_online(user.id)
            user.last_seen = _get_user_last_seen(user.id)

        return users if users is not None else []
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in get_contacts: {str(e)}")
        raise HTTPException(status_code=500, detail="Ошибка при получении списка контактов")


@router.get("/users/{user_id}", response_model=UserResponse)
def get_user(
        user_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Получает данные пользователя по ID"""
    # Админ видит всех, обычный пользователь только себя
    if current_user.role != "admin" and current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Доступ к данным пользователя запрещён"
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    return user


@router.patch("/users/{user_id}", response_model=UserResponse)
def update_user(
        user_id: int,
        user_data: UserUpdate,
        db: Session = Depends(get_db),
        current_user: User = Depends(check_admin)
):
    """Обновляет данные пользователя (кроме пароля)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    # Обновляем поля
    for key, value in user_data.dict(exclude_unset=True).items():
        setattr(user, key, value)

    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
        user_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(check_admin)
):
    """Деактивирует пользователя (не удаляет физически)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    user.is_active = False
    db.commit()
    return




def _get_user_department(user_id: int) -> str:
    """Возвращает отдел пользователя. В реальной системе - из базы данных."""
    # Временная реализация с маппингом
    departments = {
        1: "IT",
        2: "HR",
        3: "Продажи",
        4: "Поддержка",
        5: "Финансы",
        6: "Маркетинг"
    }
    return departments.get(user_id, "Без отдела")

def _get_user_position(user_id: int) -> str:
    """Возвращает должность пользователя. В реальной системе - из базы данных."""
    positions = {
        1: "Разработчик",
        2: "HR-специалист",
        3: "Менеджер по продажам",
        4: "Специалист поддержки",
        5: "Бухгалтер",
        6: "Маркетолог"
    }
    return positions.get(user_id, "Сотрудник")

def _get_user_phone(user_id: int) -> str:
    """Возвращает телефон пользователя. В реальной системе - из базы данных."""
    # Форматируем телефон как +7 (XXX) XXX-XX-XX
    phone_numbers = {
        1: "+7 (916) 123-45-67",
        2: "+7 (916) 123-45-68",
        3: "+7 (916) 123-45-69",
        4: "+7 (916) 123-45-70",
        5: "+7 (916) 123-45-71",
        6: "+7 (916) 123-45-72"
    }
    return phone_numbers.get(user_id, "")

def _is_user_online(user_id: int) -> bool:
    """Проверяет, находится ли пользователь онлайн. В реальной системе - по активности в WebSocket."""
    # Временная реализация: каждый второй пользователь онлайн
    return user_id % 2 == 1

def _get_user_last_seen(user_id: int) -> str:
    """Возвращает время последнего посещения. В реальной системе - из базы данных."""
    from datetime import datetime, timedelta
    import random
    
    # Генерируем случайное время в пределах последних 24 часов
    now = datetime.utcnow()
    random_minutes = random.randint(0, 1440)  # 0-1440 минут (24 часа)
    last_seen = now - timedelta(minutes=random_minutes)
    return last_seen.isoformat()
