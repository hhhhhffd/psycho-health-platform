"""
Pydantic схемы для AI анализа и чата.
Валидация ответов от Groq/Gemini с жёсткими ограничениями по типам.
"""
from typing import Literal

from pydantic import BaseModel, Field, model_validator


# ── Типы ─────────────────────────────────────────────────────────────────────

ConditionLevelLiteral = Literal[
    "normal", "elevated_stress", "burnout_risk", "critical"
]


class DetailedAnalysis(BaseModel):
    """Детальный анализ по 5 осям — каждая от 0 до 100."""
    stress: int = Field(ge=0, le=100)
    burnout: int = Field(ge=0, le=100)
    motivation: int = Field(ge=0, le=100)
    anxiety: int = Field(ge=0, le=100)
    emotional_state: int = Field(ge=0, le=100)


# ── Запрос на AI анализ ──────────────────────────────────────────────────────

class AIAnalysisRequest(BaseModel):
    """
    Входные данные для AI анализа результатов теста.
    Передаётся в AIService.analyze().
    """
    category_slug: str
    raw_score: int = Field(ge=0)
    max_score: int = Field(ge=1)
    answers: list[int]
    age_group: str = "adult"
    user_language: str = "ru"


# ── Ответ AI анализа (валидация выхода Groq/Gemini) ─────────────────────────

class AIAnalysisResponse(BaseModel):
    """
    Результат AI анализа теста — строго типизированная модель.
    Используется для валидации JSON от Groq/Gemini.
    Если валидация не проходит — откат к дефолтному ответу.
    """
    condition_level: ConditionLevelLiteral
    score: int = Field(ge=0, le=100)
    summary: str = Field(min_length=1)
    recommendations: list[str] = Field(min_length=1, max_length=5)
    recommended_course_id: int = Field(ge=1, le=5)
    detailed_analysis: DetailedAnalysis

    @model_validator(mode="before")
    @classmethod
    def normalize_detailed_analysis(cls, values: dict) -> dict:
        """
        Нормализует detailed_analysis — если пришёл как dict, оставляем.
        Ограничиваем числовые значения диапазоном 0-100.
        """
        da = values.get("detailed_analysis")
        if isinstance(da, dict):
            # Обрезаем значения до 0-100
            for key in ("stress", "burnout", "motivation", "anxiety", "emotional_state"):
                if key in da:
                    da[key] = max(0, min(100, int(da[key])))
        return values


# ── Чат ──────────────────────────────────────────────────────────────────────

class AIChatRequest(BaseModel):
    """Запрос к AI чату — сообщение + опциональный контекст."""
    message: str = Field(min_length=1, max_length=2000)


class AIChatResponse(BaseModel):
    """Ответ AI чата."""
    response: str
