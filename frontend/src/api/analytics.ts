/**
 * API функции для аналитики — дашборды психолога и админа.
 * Все эндпоинты требуют роль psychologist или admin.
 */
import apiClient from './client'

/** Общая статистика */
export interface OverviewStats {
  total_users: number
  total_tests: number
  avg_score: number
  tests_today: number
  tests_this_week: number
}

/** Распределение по уровням состояния */
export interface ConditionItem {
  condition_level: string
  count: number
}

/** Статистика по категории */
export interface CategoryStat {
  category_id: number
  slug: string
  name_ru: string
  name_en: string
  name_kk: string
  avg_score: number
  test_count: number
}

/** Элемент тепловой карты */
export interface HeatmapItem {
  category_slug: string
  age_group: string
  avg_score: number
  count: number
}

/** Точка тренда */
export interface TrendPoint {
  date: string
  avg_score: number
  test_count: number
}

/** Результат пользователя (для PDF) */
export interface UserResult {
  id: number
  category_slug: string
  category_name_ru: string
  category_name_en: string
  raw_score: number
  condition_level: string
  ai_analysis: Record<string, unknown> | null
  created_at: string
}

/** Недавний результат (для таблицы админа) */
export interface RecentResult {
  id: number
  user_name: string
  user_email: string
  category_slug: string
  category_name_en: string
  raw_score: number
  condition_level: string
  created_at: string
}

/** Получить общую статистику */
export async function getOverview(): Promise<OverviewStats> {
  const response = await apiClient.get<OverviewStats>('/analytics/overview')
  return response.data
}

/** Получить распределение по уровням */
export async function getConditions(): Promise<ConditionItem[]> {
  const response = await apiClient.get<ConditionItem[]>('/analytics/conditions')
  return response.data
}

/** Получить статистику по категориям */
export async function getCategories(): Promise<CategoryStat[]> {
  const response = await apiClient.get<CategoryStat[]>('/analytics/categories')
  return response.data
}

/** Получить данные тепловой карты */
export async function getHeatmap(): Promise<HeatmapItem[]> {
  const response = await apiClient.get<HeatmapItem[]>('/analytics/heatmap')
  return response.data
}

/** Получить данные тренда за N дней */
export async function getTrends(days: number = 90): Promise<TrendPoint[]> {
  const response = await apiClient.get<TrendPoint[]>('/analytics/trends', {
    params: { days },
  })
  return response.data
}

/** Получить результаты конкретного пользователя */
export async function getUserResults(userId: number): Promise<UserResult[]> {
  const response = await apiClient.get<UserResult[]>(`/analytics/user/${userId}/results`)
  return response.data
}

/** Получить последние результаты тестов */
export async function getRecentResults(limit: number = 20): Promise<RecentResult[]> {
  const response = await apiClient.get<RecentResult[]>('/analytics/recent', {
    params: { limit },
  })
  return response.data
}
