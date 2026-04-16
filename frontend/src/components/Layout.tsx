/**
 * Layout — общая обёртка для всех страниц.
 * Содержит хедер с навигацией (гамбургер-меню на мобильных),
 * переключатель языка, и кнопку выхода.
 */
import { useState } from 'react'
import { Link, Outlet, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/button'
import AIChatWidget from '@/components/AIChatWidget'
import { Menu, X } from 'lucide-react'

/** Переключатель языка — 3 кнопки: KK, RU, EN */
function LanguageSwitcher() {
  const { i18n } = useTranslation()
  const languages = ['kk', 'ru', 'en'] as const

  return (
    <div className="flex gap-1">
      {languages.map((lng) => (
        <button
          key={lng}
          onClick={() => i18n.changeLanguage(lng)}
          className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
            i18n.language === lng
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
          }`}
        >
          {lng.toUpperCase()}
        </button>
      ))}
    </div>
  )
}

/** Бейдж роли пользователя */
function RoleBadge({ role }: { role: string }) {
  const colorMap: Record<string, string> = {
    admin: 'bg-red-100 text-red-700',
    psychologist: 'bg-purple-100 text-purple-700',
    user: 'bg-blue-100 text-blue-700',
  }

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colorMap[role] ?? colorMap.user}`}>
      {role}
    </span>
  )
}

export default function Layout() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user, isAuthenticated, logout } = useAuthStore()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  function handleLogout() {
    logout()
    setMobileMenuOpen(false)
    navigate('/login', { replace: true })
  }

  /** Общие навигационные ссылки */
  function NavLinks({ onClick }: { onClick?: () => void }) {
    return (
      <>
        <Link to="/tests" onClick={onClick} className="text-muted-foreground hover:text-foreground transition-colors">
          {t('nav.tests')}
        </Link>
        <Link to="/courses" onClick={onClick} className="text-muted-foreground hover:text-foreground transition-colors">
          {t('nav.courses')}
        </Link>
        <Link to="/my-results" onClick={onClick} className="text-muted-foreground hover:text-foreground transition-colors">
          {t('nav.results')}
        </Link>

        {/* Психолог: дашборд */}
        {user?.role === 'psychologist' && (
          <Link to="/psychologist" onClick={onClick} className="text-muted-foreground hover:text-foreground transition-colors">
            Dashboard
          </Link>
        )}

        {/* Админ: дашборд + панель */}
        {user?.role === 'admin' && (
          <>
            <Link to="/psychologist" onClick={onClick} className="text-muted-foreground hover:text-foreground transition-colors">
              Dashboard
            </Link>
            <Link to="/admin" onClick={onClick} className="text-muted-foreground hover:text-foreground transition-colors">
              Admin
            </Link>
          </>
        )}
      </>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Хедер */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          {/* Лого */}
          <div className="flex items-center gap-4">
            <Link to="/" className="text-lg font-bold text-primary">
              PsyPlatform
            </Link>

            {/* Десктоп навигация */}
            {isAuthenticated && (
              <nav className="hidden md:flex items-center gap-4 text-sm">
                <NavLinks />
              </nav>
            )}
          </div>

          {/* Правая часть */}
          <div className="flex items-center gap-3">
            <LanguageSwitcher />

            {isAuthenticated && user ? (
              <div className="hidden md:flex items-center gap-3">
                <Link to="/profile" className="flex items-center gap-2 text-sm hover:text-foreground transition-colors">
                  <span className="text-muted-foreground hidden sm:inline">{user.full_name}</span>
                  <RoleBadge role={user.role} />
                </Link>
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                  {t('nav.logout')}
                </Button>
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-2">
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/login">{t('nav.login')}</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link to="/register">{t('nav.register')}</Link>
                </Button>
              </div>
            )}

            {/* Гамбургер-кнопка для мобильных */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              aria-label="Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Мобильное меню */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-background px-4 py-3 space-y-3 text-sm animate-in slide-in-from-top-2">
            {isAuthenticated ? (
              <>
                <nav className="flex flex-col gap-3">
                  <NavLinks onClick={() => setMobileMenuOpen(false)} />
                </nav>
                <div className="border-t border-border pt-3 flex items-center justify-between">
                  <Link
                    to="/profile"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2"
                  >
                    <span className="text-muted-foreground">{user?.full_name}</span>
                    {user && <RoleBadge role={user.role} />}
                  </Link>
                  <Button variant="ghost" size="sm" onClick={handleLogout}>
                    {t('nav.logout')}
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" asChild className="flex-1">
                  <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                    {t('nav.login')}
                  </Link>
                </Button>
                <Button size="sm" asChild className="flex-1">
                  <Link to="/register" onClick={() => setMobileMenuOpen(false)}>
                    {t('nav.register')}
                  </Link>
                </Button>
              </div>
            )}
          </div>
        )}
      </header>

      {/* Основной контент */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Футер */}
      <footer className="border-t border-border py-4">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          PsyPlatform &copy; 2026
        </div>
      </footer>

      {/* AI чат-ассистент — только для авторизованных */}
      <AIChatWidget />
    </div>
  )
}
