# backend/api/users.py
# Роуты для управления пользователями (только для администраторов)

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
    """Проверяет, является ли пользователь админом"""
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Требуются права администратора"
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
    return db.query(User).all()


@router.get("/users/{user_id}", response_model=UserResponse)
def get_user(
        user_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(check_admin)
):
    """Получает данные пользователя по ID"""
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


@router.get("/users/contacts", response_model=List[UserResponse])
def get_contacts(
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)  # Проверяем авторизацию, но не требуем админку
):
    """Получает список всех активных пользователей (исключая текущего)"""
    users = db.query(User).filter(
        User.is_active == True,
        User.id != current_user.id  # Исключаем текущего пользователя
    ).order_by(User.full_name).all()
    return users
