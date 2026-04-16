/**
 * Страница выбора теста — 5 карточек категорий + селектор возрастной группы.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getCategories, type TestCategory } from '@/api/tests'
import { useAuthStore } from '@/stores/authStore'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const CATEGORY_ICONS: Record<string, string> = {
  burnout: '🔥', stress: '😰', emotional: '💚', motivation: '🚀', anxiety: '😟',
}

const AGE_GROUPS = [
  { value: 'elementary', label_ru: 'Начальная школа', label_kk: 'Бастауыш мектеп', label_en: 'Elementary' },
  { value: 'middle', label_ru: 'Средняя школа', label_kk: 'Орта мектеп', label_en: 'Middle School' },
  { value: 'high', label_ru: 'Старшая школа', label_kk: 'Жоғары мектеп', label_en: 'High School' },
  { value: 'adult', label_ru: 'Взрослый', label_kk: 'Ересек', label_en: 'Adult' },
] as const

export default function TestSelect() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [categories, setCategories] = useState<TestCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [ageGroup, setAgeGroup] = useState(user?.age_group || 'adult')

  const lang = (i18n.language || 'ru') as 'ru' | 'en' | 'kk'

  useEffect(() => {
    getCategories().then(setCategories).catch(console.error).finally(() => setLoading(false))
  }, [])

  /** Получить локализованное поле по текущему языку */
  function loc(obj: Record<string, unknown>, field: string): string {
    return (obj[`${field}_${lang}`] as string) || (obj[`${field}_ru`] as string) || ''
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold">{t('tests.select_title')}</h1>
        <p className="mt-2 text-muted-foreground">{t('tests.select_subtitle')}</p>
      </div>

      {/* Селектор возрастной группы */}
      <div className="flex justify-center mb-8">
        <div className="flex flex-wrap gap-2 p-1 bg-secondary rounded-lg">
          {AGE_GROUPS.map((g) => (
            <button
              key={g.value}
              onClick={() => setAgeGroup(g.value)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                ageGroup === g.value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {g[`label_${lang}`] || g.label_ru}
            </button>
          ))}
        </div>
      </div>

      {/* Карточки категорий */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {categories.map((cat) => (
          <Card
            key={cat.id}
            className="hover:shadow-lg transition-shadow cursor-pointer group"
            onClick={() => navigate(`/tests/${cat.id}?age_group=${ageGroup}`)}
          >
            <CardHeader>
              <div className="text-4xl mb-2">{CATEGORY_ICONS[cat.slug] || '📋'}</div>
              <CardTitle className="group-hover:text-primary transition-colors">
                {loc(cat, 'name')}
              </CardTitle>
              <CardDescription>{loc(cat, 'description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="outline">{t('tests.start_test')}</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
