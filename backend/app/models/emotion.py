"""
Модель записи эмоций — результаты распознавания эмоций через камеру (face-api.js).
Хранит определённую эмоцию и уровень уверенности детекции.
"""
from datetime import datetime

from sqlalchemy import String, Float, ForeignKey, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class EmotionRecord(Base):
    """
    Запись распознанной эмоции пользователя.
    Создаётся при использовании камеры (face-api.js) на фронтенде.
    """
    __tablename__ = "emotion_records"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # Какой пользователь
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False
    )

    # Распознанная эмоция (happy, sad, angry, surprised, neutral, fearful, disgusted)
    detected_emotion: Mapped[str] = mapped_column(
        String(50), nullable=False
    )

    # Уверенность модели (0.0 — 1.0)
    confidence: Mapped[float] = mapped_column(
        Float, nullable=False
    )

    # Метка времени записи
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Связь с пользователем
    user: Mapped["User"] = relationship(  # noqa: F821
        back_populates="emotion_records"
    )

    def __repr__(self) -> str:
        return (
            f"<EmotionRecord id={self.id} user_id={self.user_id} "
            f"emotion={self.detected_emotion} confidence={self.confidence:.2f}>"
        )
