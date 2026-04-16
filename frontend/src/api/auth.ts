/**
 * API функции для аутентификации — логин, регистрация, получение профиля.
 */
import apiClient from './client'

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  email: string
  password: string
  full_name: string
  age_group?: 'elementary' | 'middle' | 'high' | 'adult'
}

export interface AuthResponse {
  access_token: string
  token_type: string
  user: UserProfile
}

export interface UserProfile {
  id: number
  email: string
  full_name: string
  role: 'user' | 'psychologist' | 'admin'
  age_group: 'elementary' | 'middle' | 'high' | 'adult' | null
  language: string
  is_active: boolean
  created_at: string
}

/** Логин — возвращает JWT токен и профиль пользователя */
export async function loginApi(data: LoginRequest): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>('/auth/login', data)
  return response.data
}

/** Регистрация нового пользователя */
export async function registerApi(data: RegisterRequest): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>('/auth/register', data)
  return response.data
}

/** Получить профиль текущего пользователя (из JWT) */
export async function getMeApi(): Promise<UserProfile> {
  const response = await apiClient.get<UserProfile>('/auth/me')
  return response.data
}
