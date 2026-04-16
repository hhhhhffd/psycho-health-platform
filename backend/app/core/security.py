"""
Модуль безопасности — хеширование паролей, JWT токены, зависимости авторизации.
Используется bcrypt напрямую для хеширования и python-jose для JWT.
"""
from datetime import datetime, timedelta, timezone
from typing import Annotated

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db

# Схема авторизации — Bearer token в заголовке Authorization
bearer_scheme = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    """Хеширует пароль с помощью bcrypt."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Сверяет введённый пароль с хешем из БД."""
    return bcrypt.checkpw(
        plain_password.encode("utf-8"), hashed_password.encode("utf-8")
    )


def create_access_token(data: dict) -> str:
    """
    Создаёт JWT токен с заданными данными и сроком жизни из конфигурации.
    В payload добавляется поле "exp" (время истечения).
    """
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    """
    Декодирует JWT токен. Возвращает payload.
    Бросает HTTPException 401 если токен невалидный или истёк.
    """
    try:
        payload = jwt.decode(
            token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
        )
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Невалидный или просроченный токен",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> "User":
    """
    Dependency для FastAPI — извлекает текущего пользователя из JWT токена.
    1. Берёт токен из заголовка Authorization: Bearer <token>
    2. Декодирует JWT и получает user_id из payload
    3. Загружает пользователя из БД
    4. Проверяет что пользователь активен
    """
    # Импортируем здесь чтобы избежать циклических зависимостей
    from app.models.user import User

    # Проверяем наличие токена
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Требуется авторизация",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Декодируем токен
    payload = decode_access_token(credentials.credentials)
    user_id: int | None = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Невалидный токен: отсутствует идентификатор пользователя",
        )

    # Загружаем пользователя из БД
    result = await db.execute(select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Пользователь не найден",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Аккаунт деактивирован",
        )

    return user


def require_role(role: str):
    """
    Фабрика зависимостей — проверяет что текущий пользователь имеет нужную роль.
    Использование: Depends(require_role("psychologist"))
    Admin имеет доступ ко всем ролям.
    """
    async def role_checker(
        current_user: Annotated["User", Depends(get_current_user)],
    ) -> "User":
        # Импорт для type-checking
        from app.models.user import UserRole

        # Админ имеет доступ ко всему
        if current_user.role == UserRole.admin:
            return current_user

        if current_user.role.value != role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Требуется роль: {role}",
            )
        return current_user

    return role_checker
