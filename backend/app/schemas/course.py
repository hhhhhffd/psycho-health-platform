"""
Pydantic схемы для курсов — каталог, детальная информация, прогресс.
"""
from datetime import datetime

from pydantic import BaseModel


class CourseResponse(BaseModel):
    """Ответ с данными курса (для каталога)."""
    id: int
    category_id: int
    title_ru: str
    title_kk: str
    title_en: str
    description_ru: str
    description_kk: str
    description_en: str
    video_urls: list[str]
    content_ru: str
    content_kk: str
    content_en: str
    order: int

    model_config = {"from_attributes": True}


class CourseWithProgress(BaseModel):
    """Курс с информацией о прогрессе текущего пользователя."""
    id: int
    category_id: int
    title_ru: str
    title_kk: str
    title_en: str
    description_ru: str
    description_kk: str
    description_en: str
    video_urls: list[str]
    content_ru: str
    content_kk: str
    content_en: str
    order: int
    progress_status: str | None = None  # not_started / in_progress / completed
    started_at: datetime | None = None
    completed_at: datetime | None = None

    model_config = {"from_attributes": True}


class CourseProgressUpdate(BaseModel):
    """Запрос на обновление прогресса курса."""
    status: str  # not_started, in_progress, completed


# ── CRUD схемы для психолога/админа ──────────────────────────────────────────

class CourseCreate(BaseModel):
    """Создание нового курса."""
    category_id: int
    title_ru: str
    title_kk: str
    title_en: str
    description_ru: str = ""
    description_kk: str = ""
    description_en: str = ""
    video_urls: list[str] = []
    content_ru: str = ""
    content_kk: str = ""
    content_en: str = ""
    order: int = 0


class CourseUpdate(BaseModel):
    """Обновление курса (все поля опциональны)."""
    category_id: int | None = None
    title_ru: str | None = None
    title_kk: str | None = None
    title_en: str | None = None
    description_ru: str | None = None
    description_kk: str | None = None
    description_en: str | None = None
    video_urls: list[str] | None = None
    content_ru: str | None = None
    content_kk: str | None = None
    content_en: str | None = None
    order: int | None = None
