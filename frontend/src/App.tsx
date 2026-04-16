/**
 * Корневой компонент приложения.
 * Настраивает React Router с Layout обёрткой и защищёнными маршрутами.
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, lazy, useEffect } from 'react'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import { useAuthStore } from './stores/authStore'

// Lazy loading страниц
const Home = lazy(() => import('./pages/Home'))
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const TestSelect = lazy(() => import('./pages/TestSelect'))
const TestPass = lazy(() => import('./pages/TestPass'))
const TestResult = lazy(() => import('./pages/TestResult'))
const Courses = lazy(() => import('./pages/Courses'))
const CourseDetail = lazy(() => import('./pages/CourseDetail'))
const MyResults = lazy(() => import('./pages/MyResults'))
const Profile = lazy(() => import('./pages/Profile'))
const PsychDashboard = lazy(() => import('./pages/PsychDashboard'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const About = lazy(() => import('./pages/About'))

/** Индикатор загрузки для lazy страниц */
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  )
}

export default function App() {
  const { loadUser, token } = useAuthStore()

  // При монтировании — загружаем профиль если есть сохранённый токен
  useEffect(() => {
    if (token) {
      loadUser()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Страницы внутри Layout (с хедером и навигацией) */}
          <Route element={<Layout />}>
            {/* Публичные маршруты */}
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />

            {/* Защищённые маршруты (любой авторизованный пользователь) */}
            <Route element={<ProtectedRoute />}>
              <Route path="/tests" element={<TestSelect />} />
              <Route path="/tests/:id" element={<TestPass />} />
              <Route path="/tests/:id/result" element={<TestResult />} />
              <Route path="/courses" element={<Courses />} />
              <Route path="/courses/:id" element={<CourseDetail />} />
              <Route path="/my-results" element={<MyResults />} />
              <Route path="/profile" element={<Profile />} />
            </Route>

            {/* Маршруты психолога */}
            <Route element={<ProtectedRoute role="psychologist" />}>
              <Route path="/psychologist" element={<PsychDashboard />} />
            </Route>

            {/* Маршруты администратора */}
            <Route element={<ProtectedRoute role="admin" />}>
              <Route path="/admin" element={<AdminDashboard />} />
            </Route>
          </Route>

          {/* Страницы без Layout (полноэкранные формы) */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Фолбэк */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
