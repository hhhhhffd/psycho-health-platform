"""
Pydantic схемы для тестов — категории, вопросы, отправка ответов, результаты.
"""
from datetime import datetime

from pydantic import BaseModel

from app.schemas.ai import AIAnalysisResponse


class TestCategoryResponse(BaseModel):
    """Ответ с данными категории теста."""
    id: int
    slug: str
    name_ru: str
    name_kk: str
    name_en: str
    description_ru: str
    description_kk: str
    description_en: str

    model_config = {"from_attributes": True}


class TestQuestionResponse(BaseModel):
    """Ответ с данными вопроса теста."""
    id: int
    category_id: int
    age_group: str
    question_ru: str
    question_kk: str
    question_en: str
    order: int

    model_config = {"from_attributes": True}


class TestSubmitRequest(BaseModel):
    """
    Запрос на отправку ответов теста.
    answers — список индексов выбранных вариантов (0-4) для каждого вопроса.
    """
    answers: list[int]


class TestResultResponse(BaseModel):
    """Полный ответ с результатом теста (включая AI анализ)."""
    id: int
    user_id: int
    category_id: int
    answers: list[int]
    raw_score: int
    condition_level: str
    ai_analysis: AIAnalysisResponse | None
    created_at: datetime

    model_config = {"from_attributes": True}


class TestResultBrief(BaseModel):
    """Краткий результат теста для списков (без полного AI анализа)."""
    id: int
    category_id: int
    category_slug: str
    category_name_ru: str
    category_name_kk: str
    category_name_en: str
    raw_score: int
    condition_level: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ── CRUD схемы для психолога/админа ──────────────────────────────────────────

class TestCategoryCreate(BaseModel):
    """Создание категории теста."""
    slug: str
    name_ru: str
    name_kk: str
    name_en: str
    description_ru: str = ""
    description_kk: str = ""
    description_en: str = ""


class TestCategoryUpdate(BaseModel):
    """Обновление категории теста (все поля опциональны)."""
    slug: str | None = None
    name_ru: str | None = None
    name_kk: str | None = None
    name_en: str | None = None
    description_ru: str | None = None
    description_kk: str | None = None
    description_en: str | None = None


class TestQuestionCreate(BaseModel):
    """Создание вопроса теста."""
    age_group: str  # elementary, middle, high, adult
    question_ru: str
    question_kk: str
    question_en: str
    order: int = 0


class TestQuestionUpdate(BaseModel):
    """Обновление вопроса теста."""
    age_group: str | None = None
    question_ru: str | None = None
    question_kk: str | None = None
    question_en: str | None = None
    order: int | None = None
