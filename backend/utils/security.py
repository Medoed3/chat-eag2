from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
import models

# Для хеширования паролей
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

# Настройки JWT — срок 7 дней
SECRET_KEY = "your-super-secret-key-change-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7  # 7 дней вместо минут
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7  # 7 дней вместо минут

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_days: int = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=expires_days or ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def verify_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None