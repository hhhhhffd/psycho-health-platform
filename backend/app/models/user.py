"""
Модель пользователя — хранит учётные данные, роль и возрастную группу.
Поддерживает 3 роли: user, psychologist, admin.
"""
import enum
from datetime import datetime

from sqlalchemy import String, Boolean, Enum, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class UserRole(str, enum.Enum):
    """Роли пользователей в системе."""
    user = "user"
    psychologist = "psychologist"
    admin = "admin"


class AgeGroup(str, enum.Enum):
    """Возрастные группы для подбора вопросов тестов."""
    elementary = "elementary"   # Начальная школа
    middle = "middle"           # Средняя школа
    high = "high"               # Старшая школа
    adult = "adult"             # Взрослые


class User(Base):
    """Модель пользователя платформы."""
    __tablename__ = "users"

    # Первичный ключ
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # Учётные данные
    email: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)

    # Профиль
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole), default=UserRole.user, nullable=False
    )
    age_group: Mapped[AgeGroup | None] = mapped_column(
        Enum(AgeGroup), nullable=True
    )
    language: Mapped[str] = mapped_column(
        String(5), default="ru", nullable=False
    )

    # Статус аккаунта (soft delete)
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )

    # Метка времени создания
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Связи с другими моделями (lazy="selectin" для асинхронной загрузки)
    test_results: Mapped[list["TestResult"]] = relationship(  # noqa: F821
        back_populates="user", lazy="selectin"
    )
    course_progress: Mapped[list["CourseProgress"]] = relationship(  # noqa: F821
        back_populates="user", lazy="selectin"
    )
    emotion_records: Mapped[list["EmotionRecord"]] = relationship(  # noqa: F821
        back_populates="user", lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email} role={self.role}>"
