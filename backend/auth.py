# backend/auth.py
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from jose import jwt, JWTError

import schemas
from database import get_db
import models
from utils.security import verify_password, create_access_token, SECRET_KEY, ALGORITHM

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login")

router = APIRouter()


def get_current_user(
        token: str = Depends(oauth2_scheme),
        db: Session = Depends(get_db)  # Используем импортированную функцию get_db
):
    """
    Получение текущего пользователя из JWT токена
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Не удалось авторизовать",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        login: str = payload.get("sub")
        if login is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(models.User).filter(models.User.login == login).first()
    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Пользователь деактивирован")

    return user


@router.post("/login", response_model=schemas.TokenResponse)
def login(
        request: schemas.LoginRequest,
        db: Session = Depends(get_db)  # Используем импортированную функцию get_db
):
    """
    Аутентификация пользователя
    """
    user = db.query(models.User).filter(models.User.login == request.login).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Неверный логин или пароль")
    if not verify_password(request.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Неверный логин или пароль")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Аккаунт отключён")

    access_token = create_access_token(data={"sub": user.login})
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": schemas.UserResponse.model_validate(user)
    }


@router.post("/logout")
async def logout():
    """
    Выход из системы
    Примечание: JWT токены являются stateless, поэтому этот endpoint
    в основном для клиента, чтобы очистить локальные данные.
    В будущем можно реализовать черный список токенов.
    """
    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={"message": "Успешный выход из системы"}
    )


@router.get("/me", response_model=schemas.UserResponse)
async def get_current_user_info(
    current_user: models.User = Depends(get_current_user)
):
    """
    Получение информации о текущем пользователе
    """
    return current_user