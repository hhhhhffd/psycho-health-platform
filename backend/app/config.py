"""
Конфигурация приложения — загружает переменные окружения из .env
Использует Pydantic BaseSettings для валидации и типизации.
"""
from pydantic_settings import BaseSettings
from pydantic import field_validator
from functools import lru_cache


class Settings(BaseSettings):
    """Все настройки приложения загружаются из переменных окружения."""

    # Подключение к базе данных
    DATABASE_URL: str = "sqlite+aiosqlite:///./hackathon.db"

    # Groq API (основной AI провайдер)
    GROQ_API_KEY: str = ""

    # Google Gemini API (резервный AI провайдер)
    GEMINI_API_KEY: str = ""

    # JWT настройки
    JWT_SECRET: str = "dev-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 1440  # 24 часа

    # Окружение
    ENVIRONMENT: str = "development"

    # CORS — разрешённые origins для фронтенда
    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
    ]

    @field_validator("DATABASE_URL")
    @classmethod
    def validate_db_url(cls, v: str) -> str:
        """Проверяем что URL базы данных задан."""
        if not v:
            raise ValueError("DATABASE_URL не может быть пустым")
        return v

    model_config = {"env_file": ".env", "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    """Возвращает кешированный экземпляр настроек (синглтон)."""
    return Settings()


# Глобальный экземпляр настроек для импорта в других модулях
settings = get_settings()
