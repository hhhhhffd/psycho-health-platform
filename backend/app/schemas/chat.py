"""
Pydantic схемы для эскалации чата — запрос/ответ психолога.
"""
from datetime import datetime

from pydantic import BaseModel


class EscalationCreateRequest(BaseModel):
    """Запрос пользователя на подключение психолога."""
    user_message: str   # Сообщение/контекст для психолога
    auto_escalated: bool = False  # True если AI сам вызвал психолога


class EscalationResponse(BaseModel):
    """Ответ с данными запроса на психолога."""
    id: int
    user_id: int
    user_name: str
    user_email: str
    user_message: str
    auto_escalated: bool
    status: str
    psychologist_id: int | None
    psychologist_reply: str | None
    created_at: datetime
    responded_at: datetime | None

    model_config = {"from_attributes": True}


class EscalationReplyRequest(BaseModel):
    """Ответ психолога на запрос пользователя."""
    reply: str


class UserEscalationStatus(BaseModel):
    """Статус своего запроса для пользователя."""
    id: int
    status: str
    psychologist_reply: str | None
    created_at: datetime
    responded_at: datetime | None

    model_config = {"from_attributes": True}
