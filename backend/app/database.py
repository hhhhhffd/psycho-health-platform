"""
Настройка базы данных — асинхронный движок SQLAlchemy 2.0.
Поддерживает PostgreSQL (asyncpg) и SQLite (aiosqlite) как fallback.
"""
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.config import settings


# Создаём асинхронный движок
# echo=True в dev режиме — выводит все SQL запросы в лог
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.ENVIRONMENT == "development",
    # Для SQLite нужны дополнительные параметры
    connect_args={"check_same_thread": False}
    if "sqlite" in settings.DATABASE_URL
    else {},
)

# Фабрика асинхронных сессий
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,  # Не инвалидируем объекты после commit
    autocommit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    """Базовый класс для всех SQLAlchemy моделей."""
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency для FastAPI — предоставляет сессию БД в эндпоинты.
    Автоматически закрывает сессию после завершения запроса.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def create_tables() -> None:
    """
    Создаёт все таблицы в БД (используется при старте для SQLite).
    В продакшене используем Alembic миграции.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
