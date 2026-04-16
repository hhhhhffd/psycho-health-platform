"""
Модели тестирования — категории тестов, вопросы и результаты.
5 категорий: burnout, stress, emotional, motivation, anxiety.
Вопросы адаптированы под 4 возрастные группы.
"""
import enum
from datetime import datetime

from sqlalchemy import (
    String, Integer, ForeignKey, Enum, DateTime, JSON, Text, func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.user import AgeGroup


class ConditionLevel(str, enum.Enum):
    """Уровень состояния пользователя по результатам теста."""
    normal = "normal"                     # Норма
    elevated_stress = "elevated_stress"   # Повышенный стресс
    burnout_risk = "burnout_risk"         # Риск выгорания
    critical = "critical"                 # Критическое состояние


class TestCategory(Base):
    """
    Категория теста — одна из 5 психологических областей.
    Мультиязычные поля: name и description на 3 языках.
    """
    __tablename__ = "test_categories"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # Уникальный слаг для маршрутизации (burnout, stress, emotional, motivation, anxiety)
    slug: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False
    )

    # Названия на 3 языках
    name_ru: Mapped[str] = mapped_column(String(255), nullable=False)
    name_kk: Mapped[str] = mapped_column(String(255), nullable=False)
    name_en: Mapped[str] = mapped_column(String(255), nullable=False)

    # Описания на 3 языках
    description_ru: Mapped[str] = mapped_column(Text, nullable=False, default="")
    description_kk: Mapped[str] = mapped_column(Text, nullable=False, default="")
    description_en: Mapped[str] = mapped_column(Text, nullable=False, default="")

    # Связи
    questions: Mapped[list["TestQuestion"]] = relationship(
        back_populates="category", lazy="selectin"
    )
    results: Mapped[list["TestResult"]] = relationship(
        back_populates="category", lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<TestCategory id={self.id} slug={self.slug}>"


class TestQuestion(Base):
    """
    Вопрос теста — привязан к категории и возрастной группе.
    Ответы оцениваются по шкале (0–4 или 1–5 в зависимости от теста).
    """
    __tablename__ = "test_questions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # Принадлежность к категории теста
    category_id: Mapped[int] = mapped_column(
        ForeignKey("test_categories.id"), nullable=False
    )

    # Возрастная группа, для которой предназначен вопрос
    age_group: Mapped[AgeGroup] = mapped_column(
        Enum(AgeGroup), nullable=False
    )

    # Текст вопроса на 3 языках
    question_ru: Mapped[str] = mapped_column(Text, nullable=False)
    question_kk: Mapped[str] = mapped_column(Text, nullable=False)
    question_en: Mapped[str] = mapped_column(Text, nullable=False)

    # Порядок вопроса в тесте (для правильной сортировки)
    order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Связь с категорией
    category: Mapped["TestCategory"] = relationship(
        back_populates="questions"
    )

    def __repr__(self) -> str:
        return f"<TestQuestion id={self.id} category_id={self.category_id} order={self.order}>"


class TestResult(Base):
    """
    Результат прохождения теста пользователем.
    Хранит ответы, сырой балл, уровень состояния и полный AI анализ в JSON.
    """
    __tablename__ = "test_results"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # Кто проходил тест
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), index=True, nullable=False
    )

    # Какой тест проходили
    category_id: Mapped[int] = mapped_column(
        ForeignKey("test_categories.id"), nullable=False
    )

    # Ответы пользователя (JSON массив индексов выбранных вариантов)
    answers: Mapped[dict] = mapped_column(JSON, nullable=False)

    # Сырой балл (сумма баллов ответов)
    raw_score: Mapped[int] = mapped_column(Integer, nullable=False)

    # Уровень состояния, определённый AI или по формуле
    condition_level: Mapped[ConditionLevel] = mapped_column(
        Enum(ConditionLevel), nullable=False
    )

    # Полный ответ AI анализа (JSON объект с detailed_analysis, recommendations и т.д.)
    ai_analysis: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Метка времени (индексирована для быстрой сортировки по дате)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(),
        index=True, nullable=False,
    )

    # Связи
    user: Mapped["User"] = relationship(  # noqa: F821
        back_populates="test_results"
    )
    category: Mapped["TestCategory"] = relationship(
        back_populates="results"
    )

    def __repr__(self) -> str:
        return (
            f"<TestResult id={self.id} user_id={self.user_id} "
            f"category={self.category_id} score={self.raw_score}>"
        )
