"""
API роутер аналитики — дашборды для психологов и админов.
Эндпоинты под префиксом /api/analytics.
Все запросы требуют роль psychologist (или admin через require_role).
"""
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.core.security import require_role
from app.services.analytics_service import (
    get_overview_stats,
    get_condition_distribution,
    get_category_stats,
    get_group_heatmap,
    get_trend_data,
    get_user_results,
    get_recent_results,
)

router = APIRouter()


@router.get("/overview")
async def overview(
    db: Annotated[AsyncSession, Depends(get_db)],
    _current_user: Annotated[User, Depends(require_role("psychologist"))],
) -> dict:
    """
    Общая статистика: пользователи, тесты, средний балл,
    тесты сегодня/за неделю.
    """
    return await get_overview_stats(db)


@router.get("/conditions")
async def conditions(
    db: Annotated[AsyncSession, Depends(get_db)],
    _current_user: Annotated[User, Depends(require_role("psychologist"))],
) -> list[dict]:
    """
    Распределение по уровням состояния — данные для PieChart.
    [{condition_level, count}]
    """
    return await get_condition_distribution(db)


@router.get("/categories")
async def categories(
    db: Annotated[AsyncSession, Depends(get_db)],
    _current_user: Annotated[User, Depends(require_role("psychologist"))],
) -> list[dict]:
    """
    Статистика по категориям — средний балл, кол-во тестов.
    Для BarChart сравнения.
    """
    return await get_category_stats(db)


@router.get("/heatmap")
async def heatmap(
    db: Annotated[AsyncSession, Depends(get_db)],
    _current_user: Annotated[User, Depends(require_role("psychologist"))],
) -> list[dict]:
    """
    Тепловая карта: средний балл по категориям × возрастным группам.
    """
    return await get_group_heatmap(db)


@router.get("/trends")
async def trends(
    db: Annotated[AsyncSession, Depends(get_db)],
    _current_user: Annotated[User, Depends(require_role("psychologist"))],
    days: int = Query(default=90, ge=7, le=365),
) -> list[dict]:
    """
    Тренд за последние N дней — ежедневный средний балл.
    Для LineChart.
    """
    return await get_trend_data(db, days)


@router.get("/user/{user_id}/results")
async def user_results(
    user_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    _current_user: Annotated[User, Depends(require_role("psychologist"))],
) -> list[dict]:
    """
    Детальные результаты конкретного пользователя — для PDF отчёта.
    """
    return await get_user_results(db, user_id)


@router.get("/recent")
async def recent(
    db: Annotated[AsyncSession, Depends(get_db)],
    _current_user: Annotated[User, Depends(require_role("psychologist"))],
    limit: int = Query(default=20, ge=1, le=100),
) -> list[dict]:
    """
    Последние N результатов тестов — с именами пользователей.
    Для таблицы в дашборде.
    """
    return await get_recent_results(db, limit)
