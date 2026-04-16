/**
 * Компонент защищённого маршрута.
 * Если пользователь не авторизован — редирект на /login.
 * Если указана роль — проверяет что пользователь имеет нужную роль (или admin).
 */
import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'

interface ProtectedRouteProps {
  /** Требуемая роль (опционально). Admin имеет доступ ко всем ролям. */
  role?: 'user' | 'psychologist' | 'admin'
}

export default function ProtectedRoute({ role }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuthStore()

  // Не авторизован — на страницу входа
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />
  }

  // Проверка роли (admin имеет доступ ко всему)
  if (role && user.role !== role && user.role !== 'admin') {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
