/**
 * API функции для курсов — каталог, прогресс.
 */
import apiClient from './client'

export interface CourseWithProgress {
  id: number
  category_id: number
  title_ru: string
  title_kk: string
  title_en: string
  description_ru: string
  description_kk: string
  description_en: string
  video_urls: string[]
  content_ru: string
  content_kk: string
  content_en: string
  order: number
  progress_status: string | null
  started_at: string | null
  completed_at: string | null
}

/** Получить все курсы с прогрессом */
export async function getCourses(): Promise<CourseWithProgress[]> {
  const response = await apiClient.get<CourseWithProgress[]>('/courses/')
  return response.data
}

/** Получить конкретный курс */
export async function getCourseDetail(courseId: number): Promise<CourseWithProgress> {
  const response = await apiClient.get<CourseWithProgress>(`/courses/${courseId}`)
  return response.data
}

/** Обновить прогресс курса */
export async function updateProgress(
  courseId: number,
  status: 'not_started' | 'in_progress' | 'completed',
): Promise<void> {
  await apiClient.put(`/courses/${courseId}/progress`, { status })
}

// ── CRUD для психолога/админа ─────────────────────────────────────────────────

export interface CourseCreate {
  category_id: number
  title_ru: string
  title_kk: string
  title_en: string
  description_ru?: string
  description_kk?: string
  description_en?: string
  video_urls?: string[]
  content_ru?: string
  content_kk?: string
  content_en?: string
  order?: number
}

/** Создать курс */
export async function createCourse(data: CourseCreate): Promise<CourseWithProgress> {
  const response = await apiClient.post<CourseWithProgress>('/courses/', data)
  return response.data
}

/** Обновить курс */
export async function updateCourse(id: number, data: Partial<CourseCreate>): Promise<CourseWithProgress> {
  const response = await apiClient.put<CourseWithProgress>(`/courses/${id}`, data)
  return response.data
}

/** Удалить курс */
export async function deleteCourse(id: number): Promise<void> {
  await apiClient.delete(`/courses/${id}`)
}
