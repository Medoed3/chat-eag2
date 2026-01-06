# backend/api/admin.py
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict

# Абсолютные импорты
import models
import schemas
from auth import get_current_user
from database import get_db

router = APIRouter()

def check_admin(user: models.User = Depends(get_current_user)):
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Требуются права администратора"
        )
    return user

@router.get("/admin/stats")
def get_admin_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(check_admin)
) -> Dict:
    total_users = db.query(models.User).count()
    active_users = db.query(models.User).filter(models.User.is_active == True).count()
    total_chats = db.query(models.Chat).count()
    total_messages = db.query(models.Message).count()

    return {
        "total_users": total_users,
        "active_users": active_users,
        "total_chats": total_chats,
        "total_messages": total_messages
    }

@router.get("/admin/users", response_model=List[schemas.UserResponse])
def admin_list_users(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(check_admin)
):
    return db.query(models.User).all()

@router.post("/admin/users/{user_id}/activate")
def admin_activate_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(check_admin)
):
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
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Нельзя деактивировать самого себя")
    user.is_active = False
    db.commit()
    return {"status": "success", "message": f"Пользователь {user.login} деактивирован"}

@router.get("/admin/health")
def health_check():
    return {"status": "healthy"}


@router.patch("/users/{user_id}/toggle-active", response_model=schemas.UserResponse)
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
