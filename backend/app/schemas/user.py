"""
Pydantic схемы для аутентификации и управления пользователями.
Валидируют входные данные (register/login) и форматируют ответы (UserResponse/TokenResponse).
"""
from datetime import datetime

from pydantic import BaseModel, EmailStr, field_validator


class UserRegister(BaseModel):
    """Схема регистрации нового пользователя."""
    email: EmailStr
    password: str
    full_name: str
    age_group: str | None = None  # elementary, middle, high, adult

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        """Пароль должен быть минимум 6 символов."""
        if len(v) < 6:
            raise ValueError("Пароль должен содержать минимум 6 символов")
        return v

    @field_validator("full_name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        """Имя не может быть пустым."""
        if not v.strip():
            raise ValueError("Имя не может быть пустым")
        return v.strip()

    @field_validator("age_group")
    @classmethod
    def validate_age_group(cls, v: str | None) -> str | None:
        """Возрастная группа должна быть из допустимого списка."""
        if v is not None and v not in ("elementary", "middle", "high", "adult"):
            raise ValueError("Допустимые возрастные группы: elementary, middle, high, adult")
        return v


class UserLogin(BaseModel):
    """Схема входа пользователя."""
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    """Ответ с данными пользователя (без пароля)."""
    id: int
    email: str
    full_name: str
    role: str
    age_group: str | None
    language: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    """Ответ с JWT токеном и данными пользователя."""
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
