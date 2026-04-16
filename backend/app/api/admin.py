"""
API роутер администратора — управление пользователями, назначение ролей.
Все эндпоинты требуют роль admin.
Префикс /api/admin.
"""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User, UserRole
from app.schemas.user import UserResponse
from app.core.security import require_role

router = APIRouter()


class RoleUpdateRequest(BaseModel):
    """Запрос на изменение роли пользователя."""
    role: str  # user, psychologist, admin


class UserAdminResponse(BaseModel):
    """Расширенные данные пользователя для панели админа."""
    id: int
    email: str
    full_name: str
    role: str
    age_group: str | None
    language: str
    is_active: bool
    test_count: int = 0

    model_config = {"from_attributes": True}


@router.get("/users", response_model=list[UserAdminResponse])
async def list_users(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_role("admin"))],
    search: str | None = None,
    role_filter: str | None = None,
) -> list[UserAdminResponse]:
    """
    Список всех пользователей. Только для администратора.
    Поддерживает фильтрацию: ?search=имя/email, ?role_filter=psychologist
    """
    query = select(User).order_by(User.created_at.desc())

    # Фильтр по роли
    if role_filter:
        try:
            query = query.where(User.role == UserRole(role_filter))
        except ValueError:
            pass

    result = await db.execute(query)
    users = result.scalars().all()

    # Поиск по имени или email
    if search:
        search_lower = search.lower()
        users = [u for u in users if search_lower in u.full_name.lower() or search_lower in u.email.lower()]

    # Считаем количество тестов для каждого пользователя
    from app.models.test import TestResult
    test_counts: dict[int, int] = {}
    for user in users:
        count_result = await db.execute(
            select(TestResult).where(TestResult.user_id == user.id)
        )
        test_counts[user.id] = len(count_result.scalars().all())

    return [
        UserAdminResponse(
            id=u.id,
            email=u.email,
            full_name=u.full_name,
            role=u.role.value,
            age_group=u.age_group.value if u.age_group else None,
            language=u.language,
            is_active=u.is_active,
            test_count=test_counts.get(u.id, 0),
        )
        for u in users
    ]


@router.put("/users/{user_id}/role", response_model=UserResponse)
async def update_user_role(
    user_id: int,
    data: RoleUpdateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_role("admin"))],
) -> UserResponse:
    """
    Изменяет роль пользователя. Только для администратора.
    Нельзя изменить роль самому себе во избежание потери доступа.
    """
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя изменить роль самому себе",
        )

    # Проверяем валидность роли
    try:
        new_role = UserRole(data.role)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Недопустимая роль. Доступны: user, psychologist, admin",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")

    user.role = new_role
    await db.commit()
    await db.refresh(user)
    return UserResponse.model_validate(user)


@router.put("/users/{user_id}/toggle-active", response_model=UserResponse)
async def toggle_user_active(
    user_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_role("admin"))],
) -> UserResponse:
    """
    Активирует или деактивирует аккаунт пользователя.
    Нельзя деактивировать себя.
    """
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя деактивировать себя",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")

    user.is_active = not user.is_active
    await db.commit()
    await db.refresh(user)
    return UserResponse.model_validate(user)


@router.get("/users/{user_id}", response_model=UserAdminResponse)
async def get_user_detail(
    user_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_role("admin"))],
) -> UserAdminResponse:
    """Возвращает детальную информацию о конкретном пользователе."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")

    from app.models.test import TestResult
    count_result = await db.execute(select(TestResult).where(TestResult.user_id == user_id))
    test_count = len(count_result.scalars().all())

    return UserAdminResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role.value,
        age_group=user.age_group.value if user.age_group else None,
        language=user.language,
        is_active=user.is_active,
        test_count=test_count,
    )
