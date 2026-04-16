"""
Сервис аналитики — агрегирующие запросы для дашбордов психолога и админа.
Все функции принимают AsyncSession и возвращают структурированные данные.
"""
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, func, cast, Date
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, AgeGroup
from app.models.test import TestResult, TestCategory, ConditionLevel


async def get_overview_stats(db: AsyncSession) -> dict:
    """
    Общая статистика: кол-во пользователей, тестов, средний балл,
    тесты за сегодня и за неделю.
    """
    total_users = await db.scalar(select(func.count(User.id))) or 0
    total_tests = await db.scalar(select(func.count(TestResult.id))) or 0
    avg_score = await db.scalar(select(func.avg(TestResult.raw_score))) or 0

    # Тесты за сегодня (UTC)
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    tests_today = await db.scalar(
        select(func.count(TestResult.id)).where(TestResult.created_at >= today_start)
    ) or 0

    # Тесты за последнюю неделю
    week_start = today_start - timedelta(days=7)
    tests_this_week = await db.scalar(
        select(func.count(TestResult.id)).where(TestResult.created_at >= week_start)
    ) or 0

    return {
        "total_users": total_users,
        "total_tests": total_tests,
        "avg_score": round(float(avg_score), 1),
        "tests_today": tests_today,
        "tests_this_week": tests_this_week,
    }


async def get_condition_distribution(db: AsyncSession) -> list[dict]:
    """
    Распределение по уровням состояния — для PieChart / BarChart.
    Возвращает [{condition_level, count}].
    """
    result = []
    for level in ConditionLevel:
        count = await db.scalar(
            select(func.count(TestResult.id)).where(
                TestResult.condition_level == level
            )
        ) or 0
        result.append({"condition_level": level.value, "count": count})
    return result


async def get_category_stats(db: AsyncSession) -> list[dict]:
    """
    Статистика по категориям — средний балл и кол-во тестов.
    Для BarChart сравнения категорий.
    """
    categories = (await db.execute(select(TestCategory))).scalars().all()
    result = []
    for cat in categories:
        count = await db.scalar(
            select(func.count(TestResult.id)).where(
                TestResult.category_id == cat.id
            )
        ) or 0
        avg = await db.scalar(
            select(func.avg(TestResult.raw_score)).where(
                TestResult.category_id == cat.id
            )
        ) or 0
        result.append({
            "category_id": cat.id,
            "slug": cat.slug,
            "name_ru": cat.name_ru,
            "name_en": cat.name_en,
            "name_kk": cat.name_kk,
            "avg_score": round(float(avg), 1),
            "test_count": count,
        })
    return result


async def get_group_heatmap(db: AsyncSession) -> list[dict]:
    """
    Тепловая карта — средний балл по категориям × возрастным группам.
    Строки = возрастные группы, столбцы = категории, значения = средний балл.
    """
    categories = (await db.execute(select(TestCategory))).scalars().all()
    heatmap_data = []

    for cat in categories:
        # Загружаем все результаты для категории
        rows = (
            await db.execute(
                select(TestResult, User)
                .join(User, TestResult.user_id == User.id)
                .where(TestResult.category_id == cat.id)
            )
        ).all()

        # Группируем по возрастным группам
        groups: dict[str, list[int]] = {}
        for test_result, user in rows:
            group = user.age_group.value if user.age_group else "adult"
            groups.setdefault(group, []).append(test_result.raw_score)

        # Генерируем данные для каждой группы (включая пустые)
        for ag in AgeGroup:
            scores = groups.get(ag.value, [])
            avg = sum(scores) / len(scores) if scores else 0
            heatmap_data.append({
                "category_slug": cat.slug,
                "age_group": ag.value,
                "avg_score": round(avg, 1),
                "count": len(scores),
            })

    return heatmap_data


async def get_trend_data(db: AsyncSession, days: int = 90) -> list[dict]:
    """
    Тренд за последние N дней — ежедневный средний балл и кол-во тестов.
    Для LineChart.
    """
    start_date = datetime.now(timezone.utc) - timedelta(days=days)

    # Получаем все результаты за период
    rows = (
        await db.execute(
            select(TestResult)
            .where(TestResult.created_at >= start_date)
            .order_by(TestResult.created_at)
        )
    ).scalars().all()

    # Группируем по дате
    daily: dict[str, list[int]] = {}
    for tr in rows:
        date_str = tr.created_at.strftime("%Y-%m-%d")
        daily.setdefault(date_str, []).append(tr.raw_score)

    result = []
    for date_str in sorted(daily.keys()):
        scores = daily[date_str]
        result.append({
            "date": date_str,
            "avg_score": round(sum(scores) / len(scores), 1),
            "test_count": len(scores),
        })

    return result


async def get_user_results(db: AsyncSession, user_id: int) -> list[dict]:
    """
    Детальные результаты конкретного пользователя — для PDF отчёта.
    """
    rows = (
        await db.execute(
            select(TestResult, TestCategory)
            .join(TestCategory, TestResult.category_id == TestCategory.id)
            .where(TestResult.user_id == user_id)
            .order_by(TestResult.created_at.desc())
        )
    ).all()

    return [
        {
            "id": tr.id,
            "category_slug": cat.slug,
            "category_name_ru": cat.name_ru,
            "category_name_en": cat.name_en,
            "raw_score": tr.raw_score,
            "condition_level": tr.condition_level.value,
            "ai_analysis": tr.ai_analysis,
            "created_at": tr.created_at.isoformat(),
        }
        for tr, cat in rows
    ]


async def get_recent_results(db: AsyncSession, limit: int = 20) -> list[dict]:
    """
    Последние N результатов тестов — с именами пользователей.
    Для таблицы в дашборде админа.
    """
    rows = (
        await db.execute(
            select(TestResult, User, TestCategory)
            .join(User, TestResult.user_id == User.id)
            .join(TestCategory, TestResult.category_id == TestCategory.id)
            .order_by(TestResult.created_at.desc())
            .limit(limit)
        )
    ).all()

    return [
        {
            "id": tr.id,
            "user_name": user.full_name,
            "user_email": user.email,
            "category_slug": cat.slug,
            "category_name_en": cat.name_en,
            "raw_score": tr.raw_score,
            "condition_level": tr.condition_level.value,
            "created_at": tr.created_at.isoformat(),
        }
        for tr, user, cat in rows
    ]
