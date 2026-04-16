"""
API роутер тестов — категории, вопросы, отправка ответов и AI анализ.
Все эндпоинты под префиксом /api/tests.
"""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User, AgeGroup
from app.models.test import TestCategory, TestQuestion, TestResult, ConditionLevel
from app.schemas.test import (
    TestCategoryResponse,
    TestQuestionResponse,
    TestSubmitRequest,
    TestResultResponse,
    TestResultBrief,
    TestCategoryCreate,
    TestCategoryUpdate,
    TestQuestionCreate,
    TestQuestionUpdate,
)
from app.schemas.ai import AIAnalysisRequest, AIAnalysisResponse
from app.core.security import get_current_user, require_role
from app.services.ai_service import AIService, get_ai_service

router = APIRouter()


@router.get("/categories", response_model=list[TestCategoryResponse])
async def get_categories(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[TestCategoryResponse]:
    """
    Возвращает все категории тестов (5 штук).
    Не требует авторизации — для отображения на главной.
    """
    result = await db.execute(
        select(TestCategory).order_by(TestCategory.id)
    )
    categories = result.scalars().all()
    return [TestCategoryResponse.model_validate(c) for c in categories]


@router.get("/categories/{category_id}/questions", response_model=list[TestQuestionResponse])
async def get_questions(
    category_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    age_group: str | None = None,
) -> list[TestQuestionResponse]:
    """
    Возвращает вопросы для конкретной категории теста.
    Фильтрует по возрастной группе (из параметра или профиля пользователя).
    """
    # Определяем возрастную группу: из параметра или из профиля
    group = age_group or (current_user.age_group.value if current_user.age_group else "adult")

    # Проверяем что категория существует
    cat_result = await db.execute(
        select(TestCategory).where(TestCategory.id == category_id)
    )
    if not cat_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Категория теста не найдена",
        )

    # Загружаем вопросы с фильтром по возрастной группе
    result = await db.execute(
        select(TestQuestion)
        .where(
            TestQuestion.category_id == category_id,
            TestQuestion.age_group == AgeGroup(group),
        )
        .order_by(TestQuestion.order)
    )
    questions = result.scalars().all()
    return [TestQuestionResponse.model_validate(q) for q in questions]


@router.post("/categories/{category_id}/submit", response_model=TestResultResponse)
async def submit_test(
    category_id: int,
    data: TestSubmitRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    ai_service: Annotated[AIService, Depends(get_ai_service)],
) -> TestResultResponse:
    """
    Отправка ответов теста — подсчёт баллов + AI анализ.
    Каждый ответ — индекс варианта (0-4), балл = индекс.
    AI анализируется через AIService (Groq → Gemini → дефолт).
    """
    # Проверяем категорию
    cat_result = await db.execute(
        select(TestCategory).where(TestCategory.id == category_id)
    )
    category = cat_result.scalar_one_or_none()
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Категория теста не найдена",
        )

    # Считаем сырой балл (сумма индексов ответов)
    raw_score = sum(data.answers)
    max_score = len(data.answers) * 4  # Максимум 4 балла за вопрос

    # Определяем уровень состояния по проценту
    pct = (raw_score / max_score * 100) if max_score > 0 else 0
    if pct < 25:
        condition_level = ConditionLevel.normal
    elif pct < 50:
        condition_level = ConditionLevel.elevated_stress
    elif pct < 75:
        condition_level = ConditionLevel.burnout_risk
    else:
        condition_level = ConditionLevel.critical

    # Формируем запрос на AI анализ
    ai_request = AIAnalysisRequest(
        category_slug=category.slug,
        raw_score=raw_score,
        max_score=max_score,
        answers=data.answers,
        age_group=(
            current_user.age_group.value if current_user.age_group else "adult"
        ),
        user_language=current_user.language or "ru",
    )

    # Запрашиваем AI анализ через AIService (Groq → Gemini → дефолт)
    ai_result = await ai_service.analyze(ai_request)

    # Сохраняем результат в БД
    test_result = TestResult(
        user_id=current_user.id,
        category_id=category_id,
        answers=data.answers,
        raw_score=raw_score,
        condition_level=condition_level,
        ai_analysis=ai_result,
    )
    db.add(test_result)
    await db.commit()
    await db.refresh(test_result)

    # Формируем ответ
    return TestResultResponse(
        id=test_result.id,
        user_id=test_result.user_id,
        category_id=test_result.category_id,
        answers=test_result.answers,
        raw_score=test_result.raw_score,
        condition_level=test_result.condition_level.value,
        ai_analysis=AIAnalysisResponse.model_validate(ai_result) if ai_result else None,
        created_at=test_result.created_at,
    )


@router.get("/results", response_model=list[TestResultBrief])
async def get_my_results(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[TestResultBrief]:
    """
    Возвращает все результаты тестов текущего пользователя.
    Сортировка: новые первые.
    """
    result = await db.execute(
        select(TestResult)
        .where(TestResult.user_id == current_user.id)
        .order_by(TestResult.created_at.desc())
    )
    results = result.scalars().all()

    # Загружаем категории для каждого результата
    briefs: list[TestResultBrief] = []
    for r in results:
        cat_result = await db.execute(
            select(TestCategory).where(TestCategory.id == r.category_id)
        )
        cat = cat_result.scalar_one()
        briefs.append(TestResultBrief(
            id=r.id,
            category_id=r.category_id,
            category_slug=cat.slug,
            category_name_ru=cat.name_ru,
            category_name_kk=cat.name_kk,
            category_name_en=cat.name_en,
            raw_score=r.raw_score,
            condition_level=r.condition_level.value,
            created_at=r.created_at,
        ))
    return briefs


@router.get("/results/{result_id}", response_model=TestResultResponse)
async def get_result_detail(
    result_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> TestResultResponse:
    """Возвращает полный результат теста по ID (только свои результаты)."""
    result = await db.execute(
        select(TestResult).where(
            TestResult.id == result_id,
            TestResult.user_id == current_user.id,
        )
    )
    test_result = result.scalar_one_or_none()
    if not test_result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Результат не найден",
        )

    return TestResultResponse(
        id=test_result.id,
        user_id=test_result.user_id,
        category_id=test_result.category_id,
        answers=test_result.answers,
        raw_score=test_result.raw_score,
        condition_level=test_result.condition_level.value,
        ai_analysis=AIAnalysisResponse.model_validate(test_result.ai_analysis) if test_result.ai_analysis else None,
        created_at=test_result.created_at,
    )


# ── CRUD для психолога/админа ─────────────────────────────────────────────────

@router.post("/categories", response_model=TestCategoryResponse, status_code=status.HTTP_201_CREATED)
async def create_category(
    data: TestCategoryCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_role("psychologist"))],
) -> TestCategoryResponse:
    """Создаёт новую категорию теста. Доступно психологу и админу."""
    # Проверяем уникальность slug
    existing = await db.execute(select(TestCategory).where(TestCategory.slug == data.slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Slug уже занят")

    category = TestCategory(**data.model_dump())
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return TestCategoryResponse.model_validate(category)


@router.put("/categories/{category_id}", response_model=TestCategoryResponse)
async def update_category(
    category_id: int,
    data: TestCategoryUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_role("psychologist"))],
) -> TestCategoryResponse:
    """Обновляет категорию теста. Доступно психологу и админу."""
    result = await db.execute(select(TestCategory).where(TestCategory.id == category_id))
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Категория не найдена")

    # Обновляем только переданные поля
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(category, field, value)

    await db.commit()
    await db.refresh(category)
    return TestCategoryResponse.model_validate(category)


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_category(
    category_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_role("psychologist"))],
) -> None:
    """Удаляет категорию теста. Доступно психологу и админу."""
    result = await db.execute(select(TestCategory).where(TestCategory.id == category_id))
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Категория не найдена")

    await db.delete(category)
    await db.commit()


@router.post("/categories/{category_id}/questions", response_model=TestQuestionResponse, status_code=status.HTTP_201_CREATED)
async def create_question(
    category_id: int,
    data: TestQuestionCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_role("psychologist"))],
) -> TestQuestionResponse:
    """Создаёт вопрос для категории теста. Доступно психологу и админу."""
    # Проверяем что категория существует
    cat_result = await db.execute(select(TestCategory).where(TestCategory.id == category_id))
    if not cat_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Категория не найдена")

    question = TestQuestion(
        category_id=category_id,
        age_group=AgeGroup(data.age_group),
        question_ru=data.question_ru,
        question_kk=data.question_kk,
        question_en=data.question_en,
        order=data.order,
    )
    db.add(question)
    await db.commit()
    await db.refresh(question)
    return TestQuestionResponse.model_validate(question)


@router.put("/questions/{question_id}", response_model=TestQuestionResponse)
async def update_question(
    question_id: int,
    data: TestQuestionUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_role("psychologist"))],
) -> TestQuestionResponse:
    """Обновляет вопрос теста. Доступно психологу и админу."""
    result = await db.execute(select(TestQuestion).where(TestQuestion.id == question_id))
    question = result.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Вопрос не найден")

    update_data = data.model_dump(exclude_none=True)
    if "age_group" in update_data:
        update_data["age_group"] = AgeGroup(update_data["age_group"])
    for field, value in update_data.items():
        setattr(question, field, value)

    await db.commit()
    await db.refresh(question)
    return TestQuestionResponse.model_validate(question)


@router.delete("/questions/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_question(
    question_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_role("psychologist"))],
) -> None:
    """Удаляет вопрос теста. Доступно психологу и админу."""
    result = await db.execute(select(TestQuestion).where(TestQuestion.id == question_id))
    question = result.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Вопрос не найден")

    await db.delete(question)
    await db.commit()
