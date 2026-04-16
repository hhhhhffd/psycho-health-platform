"""
API роутер AI — чат-ассистент для объяснения результатов и рекомендаций.
Эндпоинты под префиксом /api/ai.
Включает: чат с AI, эскалация к психологу, управление запросами.
"""
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.test import TestResult, TestCategory
from app.models.chat import ChatEscalation, EscalationStatus
from app.schemas.ai import AIChatRequest, AIChatResponse
from app.schemas.chat import (
    EscalationCreateRequest,
    EscalationResponse,
    EscalationReplyRequest,
    UserEscalationStatus,
)
from app.core.security import get_current_user, require_role
from app.services.ai_service import AIService, get_ai_service
from app.api.ws import ws_manager

router = APIRouter()


@router.post("/chat", response_model=AIChatResponse)
async def ai_chat(
    data: AIChatRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    ai_service: Annotated[AIService, Depends(get_ai_service)],
) -> AIChatResponse:
    """
    Чат с AI ассистентом — учитывает результаты тестов пользователя.
    Собирает контекст из последних 5 результатов тестов и передаёт в AIService.
    """
    # Собираем контекст из последних результатов тестов
    results = await db.execute(
        select(TestResult)
        .where(TestResult.user_id == current_user.id)
        .order_by(TestResult.created_at.desc())
        .limit(5)
    )
    test_results = results.scalars().all()

    # Конвертируем enum в строку, чтобы не попало "AgeGroup.high" в промпт
    age_group_str = current_user.age_group.value if current_user.age_group else "adult"
    context_parts: list[str] = [
        f"User: {current_user.full_name}, age group: {age_group_str}",
    ]
    for tr in test_results:
        cat_result = await db.execute(
            select(TestCategory).where(TestCategory.id == tr.category_id)
        )
        cat = cat_result.scalar_one_or_none()
        cat_name = cat.name_en if cat else "unknown"
        context_parts.append(
            f"Test '{cat_name}': score={tr.raw_score}, level={tr.condition_level.value}"
        )

    context = "\n".join(context_parts)

    # Вызываем AI через AIService
    response_text = await ai_service.chat(
        message=data.message,
        context=context,
        language=current_user.language or "ru",
    )

    return AIChatResponse(response=response_text)


# ── Эскалация: пользователь → психолог ───────────────────────────────────────

@router.post("/escalate", response_model=UserEscalationStatus, status_code=status.HTTP_201_CREATED)
async def create_escalation(
    data: EscalationCreateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> UserEscalationStatus:
    """
    Пользователь запрашивает живой чат с психологом.
    Создаёт запрос со статусом pending — психолог увидит его в дашборде.
    """
    escalation = ChatEscalation(
        user_id=current_user.id,
        user_message=data.user_message,
        auto_escalated=data.auto_escalated,
        status=EscalationStatus.pending,
    )
    db.add(escalation)
    await db.commit()
    await db.refresh(escalation)

    # Уведомляем психологов через WebSocket о новом запросе
    await ws_manager.notify_psychologists({
        "type": "new_escalation",
        "id": escalation.id,
        "user_name": current_user.full_name,
        "message": escalation.user_message[:120],
        "auto": escalation.auto_escalated,
    })

    return UserEscalationStatus(
        id=escalation.id,
        status=escalation.status.value,
        psychologist_reply=escalation.psychologist_reply,
        created_at=escalation.created_at,
        responded_at=escalation.responded_at,
    )


@router.get("/escalations/my", response_model=list[UserEscalationStatus])
async def get_my_escalations(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[UserEscalationStatus]:
    """Возвращает список запросов текущего пользователя к психологу."""
    result = await db.execute(
        select(ChatEscalation)
        .where(ChatEscalation.user_id == current_user.id)
        .order_by(ChatEscalation.created_at.desc())
    )
    escalations = result.scalars().all()
    return [
        UserEscalationStatus(
            id=e.id,
            status=e.status.value,
            psychologist_reply=e.psychologist_reply,
            created_at=e.created_at,
            responded_at=e.responded_at,
        )
        for e in escalations
    ]


# ── Панель психолога: управление эскалациями ──────────────────────────────────

@router.get("/escalations", response_model=list[EscalationResponse])
async def get_all_escalations(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_role("psychologist"))],
    status_filter: str | None = None,
) -> list[EscalationResponse]:
    """
    Список всех запросов к психологу. Только для психолога и админа.
    Опциональный фильтр: ?status_filter=pending
    """
    query = select(ChatEscalation).order_by(ChatEscalation.created_at.desc())
    if status_filter:
        query = query.where(ChatEscalation.status == EscalationStatus(status_filter))
    result = await db.execute(query)
    escalations = result.scalars().all()

    return [
        EscalationResponse(
            id=e.id,
            user_id=e.user_id,
            user_name=e.user.full_name if e.user else "Неизвестно",
            user_email=e.user.email if e.user else "",
            user_message=e.user_message,
            auto_escalated=e.auto_escalated,
            status=e.status.value,
            psychologist_id=e.psychologist_id,
            psychologist_reply=e.psychologist_reply,
            created_at=e.created_at,
            responded_at=e.responded_at,
        )
        for e in escalations
    ]


@router.post("/escalations/{escalation_id}/reply")
async def reply_to_escalation(
    escalation_id: int,
    data: EscalationReplyRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_role("psychologist"))],
) -> dict:
    """
    Психолог отвечает на запрос пользователя.
    Статус меняется на responded, сохраняется ответ и время.
    """
    result = await db.execute(
        select(ChatEscalation).where(ChatEscalation.id == escalation_id)
    )
    escalation = result.scalar_one_or_none()
    if not escalation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Запрос не найден")

    escalation.psychologist_id = current_user.id
    escalation.psychologist_reply = data.reply
    escalation.status = EscalationStatus.responded
    escalation.responded_at = datetime.now(timezone.utc)

    await db.commit()

    # Уведомляем пользователя через WebSocket что психолог ответил
    await ws_manager.notify_user(escalation.user_id, {
        "type": "escalation_update",
        "id": escalation_id,
        "status": "responded",
        "reply": data.reply,
    })

    return {"status": "ok", "escalation_id": escalation_id}


@router.patch("/escalations/{escalation_id}/close")
async def close_escalation(
    escalation_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    """Закрывает запрос — доступно и пользователю (своё), и психологу."""
    result = await db.execute(
        select(ChatEscalation).where(ChatEscalation.id == escalation_id)
    )
    escalation = result.scalar_one_or_none()
    if not escalation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Запрос не найден")

    # Пользователь может закрыть только свой запрос; психолог/админ — любой
    from app.models.user import UserRole
    is_psych = current_user.role in (UserRole.psychologist, UserRole.admin)
    if not is_psych and escalation.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Нет доступа")

    escalation.status = EscalationStatus.closed
    await db.commit()

    # Уведомляем пользователя о закрытии (если закрыл психолог)
    await ws_manager.notify_user(escalation.user_id, {
        "type": "escalation_update",
        "id": escalation_id,
        "status": "closed",
        "reply": None,
    })

    return {"status": "ok"}
