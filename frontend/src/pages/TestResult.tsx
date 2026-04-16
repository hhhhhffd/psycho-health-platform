/**
 * Страница результата теста — полная визуализация AI анализа.
 * Большой цветной бейдж уровня, EmotionalRadar, саммари, рекомендации, кнопки действий.
 */
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'
import { getResultDetail, type TestResult as TestResultType } from '@/api/tests'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import EmotionalRadar from '@/components/EmotionalRadar'

/** Стили для каждого уровня состояния */
const LEVEL_STYLES: Record<string, { badge: string; accent: string; icon: string }> = {
  normal: {
    badge: 'bg-green-100 text-green-800 border-green-300',
    accent: 'text-green-600',
    icon: '✅',
  },
  elevated_stress: {
    badge: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    accent: 'text-yellow-600',
    icon: '⚠️',
  },
  burnout_risk: {
    badge: 'bg-orange-100 text-orange-800 border-orange-300',
    accent: 'text-orange-600',
    icon: '🔥',
  },
  critical: {
    badge: 'bg-red-100 text-red-800 border-red-300',
    accent: 'text-red-600',
    icon: '🚨',
  },
}

export default function TestResult() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const { t } = useTranslation()

  // Результат может прийти из state (после submit) или загружаться по ID
  const [result, setResult] = useState<TestResultType | null>(
    (location.state as { result?: TestResultType })?.result || null,
  )
  const [loading, setLoading] = useState(!result)

  // Если нет state — загружаем результат по ID из API
  useEffect(() => {
    if (result || !id) return
    setLoading(true)
    getResultDetail(Number(id))
      .then(setResult)
      .catch(() => setResult(null))
      .finally(() => setLoading(false))
  }, [id, result])

  const analysis = result?.ai_analysis

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    )
  }

  if (!result || !analysis) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <p className="text-muted-foreground">{t('common.error')}</p>
        <Button className="mt-4" onClick={() => navigate('/tests')}>{t('tests.back_to_tests')}</Button>
      </div>
    )
  }

  const levelStyle = LEVEL_STYLES[analysis.condition_level] || LEVEL_STYLES.normal
  const levelLabel = t(`results.levels.${analysis.condition_level}`)

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <h1 className="text-3xl font-bold text-center mb-8">{t('results.title')}</h1>

      {/* ── Верхний блок: уровень + балл ──────────────────────────────── */}
      <Card className="mb-8">
        <CardContent className="p-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <span className="text-4xl">{levelStyle.icon}</span>
            <div>
              <p className="text-sm text-muted-foreground mb-1">{t('results.condition_level')}</p>
              <div className={`inline-block px-5 py-2 rounded-full border-2 text-xl font-bold ${levelStyle.badge}`}>
                {levelLabel}
              </div>
            </div>
          </div>
          <div className="text-center md:text-right">
            <div className={`text-6xl font-bold ${levelStyle.accent}`}>
              {analysis.score}
            </div>
            <div className="text-sm text-muted-foreground mt-1">/100</div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Левая колонка: радар + саммари ──────────────────────────── */}
        <div className="space-y-6">
          {/* Эмоциональный радар */}
          <Card>
            <CardHeader>
              <CardTitle>{t('results.radar_title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <EmotionalRadar data={analysis.detailed_analysis} height={340} />
            </CardContent>
          </Card>

          {/* AI саммари */}
          <Card>
            <CardHeader>
              <CardTitle>
                <span className="mr-2">🤖</span>
                {t('results.summary')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed text-base">
                {analysis.summary}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ── Правая колонка: рекомендации + бары + действия ──────────── */}
        <div className="space-y-6">
          {/* Рекомендации */}
          <Card>
            <CardHeader>
              <CardTitle>{t('results.recommendations')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {analysis.recommendations.map((rec, idx) => (
                <div
                  key={idx}
                  className="flex gap-4 p-4 rounded-xl bg-secondary/50 border border-border"
                >
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                    {idx + 1}
                  </span>
                  <p className="text-sm text-muted-foreground leading-relaxed pt-1">
                    {rec}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Детальные полоски прогресса */}
          <Card>
            <CardContent className="p-6 space-y-3">
              {([
                { key: 'stress', label: t('tests.categories.stress') },
                { key: 'burnout', label: t('tests.categories.burnout') },
                { key: 'motivation', label: t('tests.categories.motivation') },
                { key: 'anxiety', label: t('tests.categories.anxiety') },
                { key: 'emotional_state', label: t('tests.categories.emotional') },
              ] as const).map(({ key, label }) => {
                const value = analysis.detailed_analysis[key]
                const barColor = value > 70 ? 'bg-red-500' : value > 40 ? 'bg-yellow-500' : 'bg-green-500'
                return (
                  <div key={key}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium">{value}/100</span>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className={`h-full ${barColor} rounded-full transition-all duration-500`}
                        style={{ width: `${value}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          {/* Кнопки действий */}
          <div className="flex flex-col gap-3">
            <Button
              size="lg"
              className="w-full"
              onClick={() => navigate(`/courses/${analysis.recommended_course_id}`)}
            >
              {t('results.view_course')} →
            </Button>
            <Button variant="outline" onClick={() => navigate('/tests')}>
              {t('tests.back_to_tests')}
            </Button>
            <Button variant="outline" onClick={() => navigate('/my-results')}>
              {t('results.view_history')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
