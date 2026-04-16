/**
 * Каталог курсов — карточки с прогрессом, иконками категорий и прогресс-баром.
 * Дизайн: согласован с Home.tsx — цветные карточки, hover-анимации, бейджи статуса.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getCourses, type CourseWithProgress } from '@/api/courses'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

/** Стили для статусов прогресса */
const STATUS_CONFIG: Record<string, {
  label_key: string
  color: string
  icon: string
}> = {
  not_started: {
    label_key: 'courses.not_started',
    color: 'bg-gray-100 text-gray-700',
    icon: '○',
  },
  in_progress: {
    label_key: 'courses.in_progress',
    color: 'bg-blue-100 text-blue-700',
    icon: '◐',
  },
  completed: {
    label_key: 'courses.completed',
    color: 'bg-green-100 text-green-700',
    icon: '✓',
  },
}

/** Стили для категорий курсов — иконка, цвет */
const CATEGORY_STYLES: Record<string, {
  icon: string
  color: string
  iconBg: string
  borderColor: string
}> = {
  burnout: {
    icon: '🔥',
    color: 'bg-orange-50',
    iconBg: 'bg-orange-100',
    borderColor: 'border-orange-200',
  },
  stress: {
    icon: '⚡',
    color: 'bg-red-50',
    iconBg: 'bg-red-100',
    borderColor: 'border-red-200',
  },
  emotional: {
    icon: '💙',
    color: 'bg-blue-50',
    iconBg: 'bg-blue-100',
    borderColor: 'border-blue-200',
  },
  motivation: {
    icon: '🚀',
    color: 'bg-purple-50',
    iconBg: 'bg-purple-100',
    borderColor: 'border-purple-200',
  },
  anxiety: {
    icon: '🧘',
    color: 'bg-teal-50',
    iconBg: 'bg-teal-100',
    borderColor: 'border-teal-200',
  },
}

/** Маппинг category_id → slug (курсы идут в порядке: burnout=1, stress=2, emotional=3, motivation=4, anxiety=5) */
const CATEGORY_SLUG_MAP: Record<number, string> = {
  1: 'burnout',
  2: 'stress',
  3: 'emotional',
  4: 'motivation',
  5: 'anxiety',
}

export default function Courses() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const lang = (i18n.language || 'ru') as 'ru' | 'en' | 'kk'

  const [courses, setCourses] = useState<CourseWithProgress[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getCourses().then(setCourses).catch(console.error).finally(() => setLoading(false))
  }, [])

  /** Локализованное поле — ищет по текущему языку, фоллбэк на ru */
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
      {/* Заголовок секции */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary mb-4">
          <span className="mr-2">📚</span>
          {t('courses.title')}
        </div>
        <h1 className="text-3xl font-bold">{t('courses.title')}</h1>
        <p className="mt-2 text-muted-foreground max-w-xl mx-auto">
          {t('courses.subtitle')}
        </p>
      </div>

      {/* Сетка курсов */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {courses.map((course) => {
          const slug = CATEGORY_SLUG_MAP[course.category_id] || 'burnout'
          const style = CATEGORY_STYLES[slug] || CATEGORY_STYLES.burnout
          const statusCfg = course.progress_status ? STATUS_CONFIG[course.progress_status] : null
          const isCompleted = course.progress_status === 'completed'

          return (
            <Card
              key={course.id}
              className={`border ${style.borderColor} ${style.color} hover:shadow-lg transition-all duration-300 hover:-translate-y-1 cursor-pointer`}
              onClick={() => navigate(`/courses/${course.id}`)}
            >
              <CardContent className="p-6">
                {/* Иконка категории + бейдж статуса */}
                <div className="flex items-start justify-between mb-4">
                  <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${style.iconBg} text-2xl`}>
                    {style.icon}
                  </div>
                  {statusCfg && (
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusCfg.color}`}>
                      {statusCfg.icon} {t(statusCfg.label_key)}
                    </span>
                  )}
                </div>

                {/* Название и описание */}
                <h3 className="font-semibold text-foreground text-lg mb-2">
                  {loc(course, 'title')}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4 line-clamp-3">
                  {loc(course, 'description')}
                </p>

                {/* Кнопка */}
                <Button
                  className="w-full"
                  variant={isCompleted ? 'outline' : 'default'}
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(`/courses/${course.id}`)
                  }}
                >
                  {isCompleted ? `✓ ${t('courses.review')}` : t('courses.start')}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
