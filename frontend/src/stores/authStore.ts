/**
 * Zustand стор для аутентификации.
 * Хранит пользователя, токен, предоставляет login/register/logout/loadUser.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UserProfile } from '../api/auth'
import { loginApi, registerApi, getMeApi } from '../api/auth'

interface AuthState {
  user: UserProfile | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null

  /** Логин по email и паролю */
  login: (email: string, password: string) => Promise<void>

  /** Регистрация нового пользователя */
  register: (
    email: string,
    password: string,
    fullName: string,
    ageGroup?: 'elementary' | 'middle' | 'high' | 'adult',
  ) => Promise<void>

  /** Загрузить профиль текущего пользователя из сохранённого токена */
  loadUser: () => Promise<void>

  /** Выйти — очистить стор и localStorage */
  logout: () => void

  /** Сбросить ошибку */
  clearError: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null })
        try {
          const response = await loginApi({ email, password })
          // Сохраняем токен для axios интерсептора
          localStorage.setItem('auth_token', response.access_token)
          set({
            user: response.user,
            token: response.access_token,
            isAuthenticated: true,
            isLoading: false,
          })
        } catch (err: unknown) {
          const message = extractErrorMessage(err, 'Ошибка входа')
          set({ isLoading: false, error: message })
          throw new Error(message)
        }
      },

      register: async (
        email: string,
        password: string,
        fullName: string,
        ageGroup?: 'elementary' | 'middle' | 'high' | 'adult',
      ) => {
        set({ isLoading: true, error: null })
        try {
          const response = await registerApi({
            email,
            password,
            full_name: fullName,
            age_group: ageGroup,
          })
          localStorage.setItem('auth_token', response.access_token)
          set({
            user: response.user,
            token: response.access_token,
            isAuthenticated: true,
            isLoading: false,
          })
        } catch (err: unknown) {
          const message = extractErrorMessage(err, 'Ошибка регистрации')
          set({ isLoading: false, error: message })
          throw new Error(message)
        }
      },

      loadUser: async () => {
        const { token } = get()
        if (!token) return

        set({ isLoading: true })
        try {
          const user = await getMeApi()
          set({ user, isAuthenticated: true, isLoading: false })
        } catch {
          // Токен невалидный — чистим состояние
          localStorage.removeItem('auth_token')
          set({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
          })
        }
      },

      logout: () => {
        localStorage.removeItem('auth_token')
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          error: null,
        })
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
)

/** Извлекает сообщение ошибки из ответа axios */
function extractErrorMessage(err: unknown, fallback: string): string {
  if (
    typeof err === 'object' &&
    err !== null &&
    'response' in err
  ) {
    const response = (err as { response?: { data?: { detail?: string } } }).response
    if (response?.data?.detail) {
      return response.data.detail
    }
  }
  return fallback
}
