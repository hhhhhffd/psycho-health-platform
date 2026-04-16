/**
 * Детальная страница курса — переключатель видео (табы), текстовый контент,
 * кнопка «Пройти тест повторно» и «Завершить курс».
 * Дизайн: согласован с TestResult — цвета категории, бейджи, анимации.
 */
import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getCourseDetail, updateProgress, type CourseWithProgress } from '@/api/courses'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

/** Стили категорий — используем тот же маппинг, что и в Courses */
const CATEGORY_STYLES: Record<number, {
  slug: string
  icon: string
  accent: string
  bgLight: string
}> = {
  1: { slug: 'burnout', icon: '🔥', accent: 'text-orange-600', bgLight: 'bg-orange-50' },
  2: { slug: 'stress', icon: '⚡', accent: 'text-red-600', bgLight: 'bg-red-50' },
  3: { slug: 'emotional', icon: '💙', accent: 'text-blue-600', bgLight: 'bg-blue-50' },
  4: { slug: 'motivation', icon: '🚀', accent: 'text-purple-600', bgLight: 'bg-purple-50' },
  5: { slug: 'anxiety', icon: '🧘', accent: 'text-teal-600', bgLight: 'bg-teal-50' },
}

export default function CourseDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const lang = (i18n.language || 'ru') as 'ru' | 'en' | 'kk'

  const [course, setCourse] = useState<CourseWithProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeVideo, setActiveVideo] = useState(0)
  const [completing, setCompleting] = useState(false)

  useEffect(() => {
    if (!id) return
    getCourseDetail(Number(id))
      .then((c) => {
        setCourse(c)
        // Автоматически ставим «в процессе» при первом открытии
        if (!c.progress_status || c.progress_status === 'not_started') {
          updateProgress(Number(id), 'in_progress').catch(console.error)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  /** Помечаем курс как завершённый */
  async function markCompleted() {
    if (!id || completing) return
    setCompleting(true)
    try {
      await updateProgress(Number(id), 'completed')
      setCourse((prev) => prev ? { ...prev, progress_status: 'completed' } : prev)
    } catch (err) {
      console.error('Ошибка обновления прогресса:', err)
    } finally {
      setCompleting(false)
    }
  }

  /** Локализованное поле */
  function loc(obj: Record<string, unknown>, field: string): string {
    return (obj[`${field}_${lang}`] as string) || (obj[`${field}_ru`] as string) || ''
  }

  /** Извлекает YouTube video ID из URL */
  function getYoutubeId(url: string): string | null {
    const match = url.match(/(?:v=|\/)([\w-]{11})/)
    return match ? match[1] : null
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    )
  }

  if (!course) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <p className="text-muted-foreground">{t('common.error')}</p>
        <Button className="mt-4" onClick={() => navigate('/courses')}>{t('common.back')}</Button>
      </div>
    )
  }

  const catStyle = CATEGORY_STYLES[course.category_id] || CATEGORY_STYLES[1]
  const isCompleted = course.progress_status === 'completed'
  const validVideos = course.video_urls
    .map((url, idx) => ({ url, id: getYoutubeId(url), idx }))
    .filter((v) => v.id !== null)

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Навигация назад */}
      <Button variant="ghost" onClick={() => navigate('/courses')} className="mb-4">
        ← {t('common.back')}
      </Button>

      {/* Заголовок курса */}
      <div className="flex items-start gap-4 mb-8">
        <div className={`flex-shrink-0 w-14 h-14 rounded-2xl ${catStyle.bgLight} flex items-center justify-center text-3xl`}>
          {catStyle.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-bold text-foreground">{loc(course, 'title')}</h1>
          <p className="text-muted-foreground mt-1">{loc(course, 'description')}</p>

          {/* Бейдж статуса */}
          {isCompleted && (
            <span className="inline-flex items-center gap-1 mt-2 px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-medium">
              ✓ {t('courses.completed')}
            </span>
          )}
        </div>
      </div>

      {/* ── Секция видео с табами ─────────────────────────────────────── */}
      {validVideos.length > 0 && (
        <Card className="mb-8 overflow-hidden">
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                🎬 {t('courses.video_lessons')}
              </CardTitle>

              {/* Табы для переключения видео */}
              {validVideos.length > 1 && (
                <div className="flex gap-1">
                  {validVideos.map((v, i) => (
                    <button
                      key={v.idx}
                      onClick={() => setActiveVideo(i)}
                      className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors ${
                        activeVideo === i
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                      }`}
                    >
                      {t('courses.video')} {i + 1}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-4">
            {/* Активное видео */}
            <div className="aspect-video rounded-lg overflow-hidden bg-black">
              <iframe
                key={validVideos[activeVideo]?.id}
                src={`https://www.youtube.com/embed/${validVideos[activeVideo]?.id}`}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={`${loc(course, 'title')} — ${t('courses.video')} ${activeVideo + 1}`}
              />
            </div>

            {/* Индикатор текущего видео */}
            {validVideos.length > 1 && (
              <div className="flex justify-center gap-1.5 mt-3">
                {validVideos.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveVideo(i)}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      activeVideo === i ? 'bg-primary' : 'bg-muted-foreground/30'
                    }`}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Текстовый контент ─────────────────────────────────────────── */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            📖 {t('courses.materials')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm max-w-none text-muted-foreground whitespace-pre-wrap leading-relaxed">
            {loc(course, 'content')}
          </div>
        </CardContent>
      </Card>

      {/* ── Действия ──────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Кнопка завершения / бейдж завершённого */}
        {!isCompleted ? (
          <Button
            className="flex-1"
            size="lg"
            onClick={markCompleted}
            disabled={completing}
          >
            {completing ? t('common.loading') : `✓ ${t('courses.mark_complete')}`}
          </Button>
        ) : (
          <div className="flex-1 flex items-center justify-center py-3 rounded-lg bg-green-50 border border-green-200 text-green-700 font-medium">
            ✓ {t('courses.completed')}
          </div>
        )}

        {/* Кнопка «Пройти тест повторно» — ведёт на страницу тестов */}
        <Button
          variant="outline"
          size="lg"
          className="flex-1"
          asChild
        >
          <Link to="/tests">
            📋 {t('courses.retake_test')}
          </Link>
        </Button>
      </div>
    </div>
  )
}
