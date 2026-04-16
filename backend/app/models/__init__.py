"""
Экспортируем все модели для Alembic автодискавери.
Импорт Base + всех моделей гарантирует что metadata содержит все таблицы.
"""
from app.database import Base  # noqa: F401

# Все модели должны быть импортированы чтобы Alembic их видел при автогенерации
from app.models.user import User, UserRole, AgeGroup  # noqa: F401
from app.models.test import (  # noqa: F401
    TestCategory,
    TestQuestion,
    TestResult,
    ConditionLevel,
)
from app.models.course import Course, CourseProgress, CourseStatus  # noqa: F401
from app.models.emotion import EmotionRecord  # noqa: F401
from app.models.chat import ChatEscalation, EscalationStatus  # noqa: F401
