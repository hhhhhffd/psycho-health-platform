"""
Модели курсов — обучающий контент и прогресс прохождения.
Каждый курс привязан к категории теста (1 курс = 1 категория).
"""
import enum
from datetime import datetime

from sqlalchemy import (
    String, Integer, ForeignKey, Enum, DateTime, JSON, Text, func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class CourseStatus(str, enum.Enum):
    """Статус прохождения курса пользователем."""
    not_started = "not_started"   # Не начат
    in_progress = "in_progress"   # В процессе
    completed = "completed"       # Завершён


class Course(Base):
    """
    Обучающий курс — привязан к одной категории теста.
    Содержит видеоматериалы (YouTube) и текстовый контент (Markdown).
    """
    __tablename__ = "courses"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # Привязка к категории теста (один курс на категорию)
    category_id: Mapped[int] = mapped_column(
        ForeignKey("test_categories.id"), nullable=False
    )

    # Названия на 3 языках
    title_ru: Mapped[str] = mapped_column(String(255), nullable=False)
    title_kk: Mapped[str] = mapped_column(String(255), nullable=False)
    title_en: Mapped[str] = mapped_column(String(255), nullable=False)

    # Описания на 3 языках
    description_ru: Mapped[str] = mapped_column(Text, nullable=False, default="")
    description_kk: Mapped[str] = mapped_column(Text, nullable=False, default="")
    description_en: Mapped[str] = mapped_column(Text, nullable=False, default="")

    # Список YouTube URL (JSON массив строк)
    video_urls: Mapped[list] = mapped_column(JSON, nullable=False, default=list)

    # Текстовый контент (Markdown) на 3 языках
    content_ru: Mapped[str] = mapped_column(Text, nullable=False, default="")
    content_kk: Mapped[str] = mapped_column(Text, nullable=False, default="")
    content_en: Mapped[str] = mapped_column(Text, nullable=False, default="")

    # Порядок отображения в каталоге
    order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Связи
    category: Mapped["TestCategory"] = relationship(lazy="selectin")  # noqa: F821
    progress: Mapped[list["CourseProgress"]] = relationship(
        back_populates="course", lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<Course id={self.id} category_id={self.category_id}>"


class CourseProgress(Base):
    """
    Прогресс пользователя по курсу — отслеживает статус и даты начала/завершения.
    """
    __tablename__ = "course_progress"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # Какой пользователь проходит курс
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False
    )

    # Какой курс проходится
    course_id: Mapped[int] = mapped_column(
        ForeignKey("courses.id"), nullable=False
    )

    # Текущий статус прохождения
    status: Mapped[CourseStatus] = mapped_column(
        Enum(CourseStatus), default=CourseStatus.not_started, nullable=False
    )

    # Даты начала и завершения (nullable — может быть ещё не начат)
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Связи
    user: Mapped["User"] = relationship(  # noqa: F821
        back_populates="course_progress"
    )
    course: Mapped["Course"] = relationship(
        back_populates="progress"
    )

    def __repr__(self) -> str:
        return (
            f"<CourseProgress id={self.id} user_id={self.user_id} "
            f"course_id={self.course_id} status={self.status}>"
        )
