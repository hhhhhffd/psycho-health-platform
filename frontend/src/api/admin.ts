/**
 * API функции для панели администратора — управление пользователями.
 */
import apiClient from './client'

export interface AdminUser {
  id: number
  email: string
  full_name: string
  role: 'user' | 'psychologist' | 'admin'
  age_group: string | null
  language: string
  is_active: boolean
  test_count: number
}

/** Получить список всех пользователей */
export async function getUsers(params?: {
  search?: string
  role_filter?: string
}): Promise<AdminUser[]> {
  const response = await apiClient.get<AdminUser[]>('/admin/users', { params })
  return response.data
}

/** Получить одного пользователя по ID */
export async function getUser(id: number): Promise<AdminUser> {
  const response = await apiClient.get<AdminUser>(`/admin/users/${id}`)
  return response.data
}

/** Изменить роль пользователя */
export async function updateUserRole(
  id: number,
  role: 'user' | 'psychologist' | 'admin',
): Promise<AdminUser> {
  const response = await apiClient.put<AdminUser>(`/admin/users/${id}/role`, { role })
  return response.data
}

/** Активировать / деактивировать аккаунт */
export async function toggleUserActive(id: number): Promise<AdminUser> {
  const response = await apiClient.put<AdminUser>(`/admin/users/${id}/toggle-active`)
  return response.data
}
