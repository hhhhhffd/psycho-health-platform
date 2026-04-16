"""
API роутер эмоций — сохранение результатов распознавания с камеры.
Эндпоинты под префиксом /api/emotions.
"""
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.emotion import EmotionRecord
from app.core.security import get_current_user

router = APIRouter()


class EmotionCreate(BaseModel):
    """Запрос на сохранение распознанной эмоции."""
    detected_emotion: str  # happy, sad, angry, surprised, neutral, fearful, disgusted
    confidence: float


class EmotionResponse(BaseModel):
    """Ответ с данными эмоции."""
    id: int
    detected_emotion: str
    confidence: float
    created_at: str

    model_config = {"from_attributes": True}


@router.post("/", response_model=EmotionResponse)
async def save_emotion(
    data: EmotionCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> EmotionResponse:
    """Сохраняет результат распознавания эмоции с камеры."""
    record = EmotionRecord(
        user_id=current_user.id,
        detected_emotion=data.detected_emotion,
        confidence=data.confidence,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    return EmotionResponse(
        id=record.id,
        detected_emotion=record.detected_emotion,
        confidence=record.confidence,
        created_at=record.created_at.isoformat(),
    )


@router.get("/history", response_model=list[EmotionResponse])
async def get_emotion_history(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[EmotionResponse]:
    """Возвращает историю распознанных эмоций текущего пользователя."""
    result = await db.execute(
        select(EmotionRecord)
        .where(EmotionRecord.user_id == current_user.id)
        .order_by(EmotionRecord.created_at.desc())
        .limit(50)
    )
    records = result.scalars().all()

    return [
        EmotionResponse(
            id=r.id,
            detected_emotion=r.detected_emotion,
            confidence=r.confidence,
            created_at=r.created_at.isoformat(),
        )
        for r in records
    ]
