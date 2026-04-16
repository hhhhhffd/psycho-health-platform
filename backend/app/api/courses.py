"""
API роутер курсов — каталог, детали, прогресс прохождения.
Все эндпоинты под префиксом /api/courses.
"""
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.course import Course, CourseProgress, CourseStatus
from app.schemas.course import CourseWithProgress, CourseProgressUpdate, CourseCreate, CourseUpdate, CourseResponse
from app.core.security import get_current_user, require_role

router = APIRouter()


@router.get("/", response_model=list[CourseWithProgress])
async def get_courses(
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> list[CourseWithProgress]:
    """
    Возвращает все курсы с прогрессом текущего пользователя.
    """
    # Загружаем все курсы
    result = await db.execute(select(Course).order_by(Course.order))
    courses = result.scalars().all()

    # Загружаем прогресс пользователя
    progress_result = await db.execute(
        select(CourseProgress).where(CourseProgress.user_id == current_user.id)
    )
    progress_map: dict[int, CourseProgress] = {
        p.course_id: p for p in progress_result.scalars().all()
    }

    # Собираем ответ
    items: list[CourseWithProgress] = []
    for course in courses:
        progress = progress_map.get(course.id)
        items.append(CourseWithProgress(
            id=course.id,
            category_id=course.category_id,
            title_ru=course.title_ru,
            title_kk=course.title_kk,
            title_en=course.title_en,
            description_ru=course.description_ru,
            description_kk=course.description_kk,
            description_en=course.description_en,
            video_urls=course.video_urls,
            content_ru=course.content_ru,
            content_kk=course.content_kk,
            content_en=course.content_en,
            order=course.order,
            progress_status=progress.status.value if progress else None,
            started_at=progress.started_at if progress else None,
            completed_at=progress.completed_at if progress else None,
        ))
    return items


@router.get("/{course_id}", response_model=CourseWithProgress)
async def get_course_detail(
    course_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> CourseWithProgress:
    """Возвращает детальную информацию о курсе с прогрессом."""
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Курс не найден",
        )

    # Загружаем прогресс
    progress_result = await db.execute(
        select(CourseProgress).where(
            CourseProgress.user_id == current_user.id,
            CourseProgress.course_id == course_id,
        )
    )
    progress = progress_result.scalar_one_or_none()

    return CourseWithProgress(
        id=course.id,
        category_id=course.category_id,
        title_ru=course.title_ru,
        title_kk=course.title_kk,
        title_en=course.title_en,
        description_ru=course.description_ru,
        description_kk=course.description_kk,
        description_en=course.description_en,
        video_urls=course.video_urls,
        content_ru=course.content_ru,
        content_kk=course.content_kk,
        content_en=course.content_en,
        order=course.order,
        progress_status=progress.status.value if progress else None,
        started_at=progress.started_at if progress else None,
        completed_at=progress.completed_at if progress else None,
    )


@router.put("/{course_id}/progress")
async def update_progress(
    course_id: int,
    data: CourseProgressUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    """Обновляет прогресс пользователя по курсу."""
    # Проверяем курс
    course_result = await db.execute(select(Course).where(Course.id == course_id))
    if not course_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Курс не найден",
        )

    # Ищем или создаём запись прогресса
    progress_result = await db.execute(
        select(CourseProgress).where(
            CourseProgress.user_id == current_user.id,
            CourseProgress.course_id == course_id,
        )
    )
    progress = progress_result.scalar_one_or_none()

    new_status = CourseStatus(data.status)
    now = datetime.now(timezone.utc)

    if progress is None:
        # Создаём новую запись
        progress = CourseProgress(
            user_id=current_user.id,
            course_id=course_id,
            status=new_status,
            started_at=now if new_status != CourseStatus.not_started else None,
            completed_at=now if new_status == CourseStatus.completed else None,
        )
        db.add(progress)
    else:
        # Обновляем существующую
        progress.status = new_status
        if new_status == CourseStatus.in_progress and not progress.started_at:
            progress.started_at = now
        if new_status == CourseStatus.completed:
            progress.completed_at = now

    await db.commit()
    return {"status": "ok", "progress": data.status}


# ── CRUD для психолога/админа ─────────────────────────────────────────────────

@router.post("/", response_model=CourseResponse, status_code=status.HTTP_201_CREATED)
async def create_course(
    data: CourseCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_role("psychologist"))],
) -> CourseResponse:
    """Создаёт новый курс. Доступно психологу и админу."""
    course = Course(**data.model_dump())
    db.add(course)
    await db.commit()
    await db.refresh(course)
    return CourseResponse.model_validate(course)


@router.put("/{course_id}", response_model=CourseResponse)
async def update_course(
    course_id: int,
    data: CourseUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_role("psychologist"))],
) -> CourseResponse:
    """Обновляет курс. Доступно психологу и админу."""
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Курс не найден")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(course, field, value)

    await db.commit()
    await db.refresh(course)
    return CourseResponse.model_validate(course)


@router.delete("/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_course(
    course_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    current_user: Annotated[User, Depends(require_role("psychologist"))],
) -> None:
    """Удаляет курс. Доступно психологу и админу."""
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Курс не найден")

    await db.delete(course)
    await db.commit()
