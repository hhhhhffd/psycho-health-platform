/**
 * API функции для тестов — категории, вопросы, отправка, результаты.
 */
import apiClient from './client'

export interface TestCategory {
  id: number
  slug: string
  name_ru: string
  name_kk: string
  name_en: string
  description_ru: string
  description_kk: string
  description_en: string
}

export interface TestQuestion {
  id: number
  category_id: number
  age_group: string
  question_ru: string
  question_kk: string
  question_en: string
  order: number
}

export interface AIAnalysis {
  condition_level: string
  score: number
  summary: string
  recommendations: string[]
  recommended_course_id: number
  detailed_analysis: {
    stress: number
    burnout: number
    motivation: number
    anxiety: number
    emotional_state: number
  }
}

export interface TestResult {
  id: number
  user_id: number
  category_id: number
  answers: number[]
  raw_score: number
  condition_level: string
  ai_analysis: AIAnalysis | null
  created_at: string
}

export interface TestResultBrief {
  id: number
  category_id: number
  category_slug: string
  category_name_ru: string
  category_name_kk: string
  category_name_en: string
  raw_score: number
  condition_level: string
  created_at: string
}

/** Получить все категории тестов */
export async function getCategories(): Promise<TestCategory[]> {
  const response = await apiClient.get<TestCategory[]>('/tests/categories')
  return response.data
}

/** Получить вопросы для категории + возрастной группы */
export async function getQuestions(
  categoryId: number,
  ageGroup?: string,
): Promise<TestQuestion[]> {
  const params = ageGroup ? { age_group: ageGroup } : {}
  const response = await apiClient.get<TestQuestion[]>(
    `/tests/categories/${categoryId}/questions`,
    { params },
  )
  return response.data
}

/** Отправить ответы теста */
export async function submitTest(
  categoryId: number,
  answers: number[],
): Promise<TestResult> {
  const response = await apiClient.post<TestResult>(
    `/tests/categories/${categoryId}/submit`,
    { answers },
  )
  return response.data
}

/** Получить все результаты текущего пользователя */
export async function getMyResults(): Promise<TestResultBrief[]> {
  const response = await apiClient.get<TestResultBrief[]>('/tests/results')
  return response.data
}

/** Получить конкретный результат по ID */
export async function getResultDetail(resultId: number): Promise<TestResult> {
  const response = await apiClient.get<TestResult>(`/tests/results/${resultId}`)
  return response.data
}

// ── CRUD для психолога/админа ─────────────────────────────────────────────────

export interface TestCategoryCreate {
  slug: string
  name_ru: string
  name_kk: string
  name_en: string
  description_ru?: string
  description_kk?: string
  description_en?: string
}

export interface TestQuestionCreate {
  age_group: string
  question_ru: string
  question_kk: string
  question_en: string
  order?: number
}

/** Создать категорию теста */
export async function createCategory(data: TestCategoryCreate): Promise<TestCategory> {
  const response = await apiClient.post<TestCategory>('/tests/categories', data)
  return response.data
}

/** Обновить категорию */
export async function updateCategory(id: number, data: Partial<TestCategoryCreate>): Promise<TestCategory> {
  const response = await apiClient.put<TestCategory>(`/tests/categories/${id}`, data)
  return response.data
}

/** Удалить категорию */
export async function deleteCategory(id: number): Promise<void> {
  await apiClient.delete(`/tests/categories/${id}`)
}

/** Создать вопрос */
export async function createQuestion(categoryId: number, data: TestQuestionCreate): Promise<TestQuestion> {
  const response = await apiClient.post<TestQuestion>(`/tests/categories/${categoryId}/questions`, data)
  return response.data
}

/** Обновить вопрос */
export async function updateQuestion(id: number, data: Partial<TestQuestionCreate>): Promise<TestQuestion> {
  const response = await apiClient.put<TestQuestion>(`/tests/questions/${id}`, data)
  return response.data
}

/** Удалить вопрос */
export async function deleteQuestion(id: number): Promise<void> {
  await apiClient.delete(`/tests/questions/${id}`)
}
