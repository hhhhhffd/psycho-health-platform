"""
Модель эскалации чата — запрос пользователя на подключение психолога.
Создаётся когда пользователь нажимает "Позвать психолога" или AI определяет
что тема требует профессиональной помощи.
"""
import enum
from datetime import datetime

from sqlalchemy import String, Integer, ForeignKey, Enum, DateTime, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class EscalationStatus(str, enum.Enum):
    """Статус запроса на подключение психолога."""
    pending = "pending"       # Ожидает ответа психолога
    responded = "responded"   # Психолог ответил
    closed = "closed"         # Закрыто пользователем или психологом


class ChatEscalation(Base):
    """
    Запрос пользователя на живой чат с психологом.
    Психолог видит список таких запросов в своём дашборде и может ответить.
    """
    __tablename__ = "chat_escalations"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # Кто запросил помощь
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"), nullable=False, index=True
    )

    # Сообщение пользователя (контекст для психолога)
    user_message: Mapped[str] = mapped_column(Text, nullable=False)

    # Флаг: автоматически вызвано AI (True) или пользователем вручную (False)
    auto_escalated: Mapped[bool] = mapped_column(default=False, nullable=False)

    # Статус запроса
    status: Mapped[EscalationStatus] = mapped_column(
        Enum(EscalationStatus), default=EscalationStatus.pending, nullable=False
    )

    # Кто из психологов взял запрос
    psychologist_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )

    # Ответ психолога
    psychologist_reply: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Временные метки
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    responded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Связи
    user: Mapped["User"] = relationship(  # noqa: F821
        foreign_keys=[user_id], lazy="selectin"
    )
    psychologist: Mapped["User | None"] = relationship(  # noqa: F821
        foreign_keys=[psychologist_id], lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<ChatEscalation id={self.id} user_id={self.user_id} status={self.status}>"
