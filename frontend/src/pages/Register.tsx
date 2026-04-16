/**
 * Страница регистрации — форма с email, паролем, именем и возрастной группой.
 * При успешной регистрации — редирект на /tests.
 */
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'

/** Допустимые возрастные группы */
const AGE_GROUPS = [
  { value: 'elementary', label: { ru: 'Начальная школа', en: 'Elementary School', kk: 'Бастауыш мектеп' } },
  { value: 'middle', label: { ru: 'Средняя школа', en: 'Middle School', kk: 'Орта мектеп' } },
  { value: 'high', label: { ru: 'Старшая школа', en: 'High School', kk: 'Жоғары мектеп' } },
  { value: 'adult', label: { ru: 'Взрослый', en: 'Adult', kk: 'Ересек' } },
] as const

type AgeGroupValue = 'elementary' | 'middle' | 'high' | 'adult'

export default function Register() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { register, isLoading, error, clearError } = useAuthStore()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [ageGroup, setAgeGroup] = useState<AgeGroupValue>('adult')

  // Определяем текущий язык для лейблов возрастных групп
  const lang = (i18n.language || 'ru') as 'ru' | 'en' | 'kk'

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    clearError()

    try {
      await register(email, password, fullName, ageGroup)
      navigate('/tests', { replace: true })
    } catch {
      // Ошибка уже записана в стор
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{t('auth.register')}</CardTitle>
          <CardDescription>
            {t('home.hero_subtitle')}
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {/* Сообщение об ошибке */}
            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Имя */}
            <div className="space-y-2">
              <Label htmlFor="fullName">{t('auth.name')}</Label>
              <Input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">{t('auth.email')}</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            {/* Пароль */}
            <div className="space-y-2">
              <Label htmlFor="password">{t('auth.password')}</Label>
              <Input
                id="password"
                type="password"
                placeholder="******"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>

            {/* Возрастная группа */}
            <div className="space-y-2">
              <Label htmlFor="ageGroup">{t('tests.age_group')}</Label>
              <select
                id="ageGroup"
                value={ageGroup}
                onChange={(e) => setAgeGroup(e.target.value as AgeGroupValue)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {AGE_GROUPS.map((group) => (
                  <option key={group.value} value={group.value}>
                    {group.label[lang] || group.label.ru}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? t('common.loading') : t('auth.register')}
            </Button>

            <p className="text-sm text-muted-foreground">
              {t('auth.have_account')}{' '}
              <Link to="/login" className="text-primary hover:underline font-medium">
                {t('auth.login')}
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
