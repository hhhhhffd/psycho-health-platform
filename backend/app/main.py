"""
Точка входа FastAPI приложения.
Настраивает CORS, подключает роутеры, инициализирует БД при старте.
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import create_tables, AsyncSessionLocal

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifecycle manager — выполняется при старте и остановке приложения.
    При старте: создаёт таблицы (для SQLite) + засеивает демо-данные.
    """
    # Старт: инициализация
    if "sqlite" in settings.DATABASE_URL:
        await create_tables()

    # Засеиваем БД демо-данными (если пустая)
    try:
        from app.seed.seed_data import seed_all
        async with AsyncSessionLocal() as db:
            await seed_all(db)
    except Exception as e:
        logger.warning(f"Сид не выполнен: {e}")

    yield  # Приложение работает


# Создаём FastAPI приложение
app = FastAPI(
    title="Hackathon Platform API",
    description="Платформа корпоративной культуры и психоэмоционального состояния",
    version="1.0.0",
    lifespan=lifespan,
)

# Настраиваем CORS — разрешаем запросы от фронтенда
# allow_origin_regex покрывает localhost (любой порт) + любой https домен (Cloudflare Tunnel)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_origin_regex=r"(http://(localhost|127\.0\.0\.1)(:\d+)?|https://.*)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Роутеры ──────────────────────────────────────────────────────────────────

from app.api import auth, tests, courses, analytics, ai, emotions, admin, ws  # noqa: E402

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(tests.router, prefix="/api/tests", tags=["tests"])
app.include_router(courses.router, prefix="/api/courses", tags=["courses"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"])
app.include_router(ai.router, prefix="/api/ai", tags=["ai"])
app.include_router(emotions.router, prefix="/api/emotions", tags=["emotions"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(ws.router, prefix="/api/ws", tags=["websocket"])


# ── Health check ─────────────────────────────────────────────────────────────

@app.get("/api/health", tags=["system"])
async def health_check() -> dict[str, str]:
    """
    Проверка работоспособности сервиса.
    Используется Docker healthcheck и мониторингом.
    """
    return {"status": "ok", "version": "1.0.0"}


@app.get("/", tags=["system"])
async def root() -> dict[str, str]:
    """Корневой эндпоинт — редиректит к документации."""
    return {"message": "Hackathon Platform API", "docs": "/docs"}
