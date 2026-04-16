/**
 * Базовый axios клиент с JWT интерсептором.
 * Автоматически добавляет Authorization заголовок к каждому запросу.
 * При 401 ответе — чистит токен и перенаправляет на /login.
 */
import axios from 'axios'

// Базовый URL API бэкенда
// В dev через localhost — явный URL, в tunnel/prod — относительный путь через nginx
const BASE_URL = import.meta.env.VITE_API_URL ?? '/api'

const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 секунд таймаут
})

// Интерсептор запросов — добавляет JWT токен
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error: unknown) => {
    return Promise.reject(error)
  }
)

// Интерсептор ответов — обрабатывает ошибки аутентификации
apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      // Токен истёк или невалидный — чистим и перенаправляем
      localStorage.removeItem('auth_token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default apiClient
