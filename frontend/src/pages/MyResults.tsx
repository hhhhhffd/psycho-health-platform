/**
 * Страница истории тестов — таймлайн карточек с раскрытием и сравнением.
 * Клик → раскрывает радар + AI саммари.
 * Если 2+ результата по одной категории → кнопка «Сравнить» с двойным радаром.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getMyResults, getResultDetail, type TestResultBrief, type TestResult } from '@/api/tests'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import EmotionalRadar, { type DetailedAnalysis } from '@/components/EmotionalRadar'

/** Стили бейджей уровней */
const LEVEL_COLORS: Record<string, string> = {
  normal: 'bg-green-100 text-green-800 border-green-200',
  elevated_stress: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  burnout_risk: 'bg-orange-100 text-orange-800 border-orange-200',
  critical: 'bg-red-100 text-red-800 border-red-200',
}

const LEVEL_ICONS: Record<string, string> = {
  normal: '✅', elevated_stress: '⚠️', burnout_risk: '🔥', critical: '🚨',
}

export default function MyResults() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const lang = (i18n.language || 'ru') as 'ru' | 'en' | 'kk'

  const [results, setResults] = useState<TestResultBrief[]>([])
  const [loading, setLoading] = useState(true)

  // ID раскрытой карточки
  const [expandedId, setExpandedId] = useState<number | null>(null)
  // Загруженные полные результаты (кеш)
  const [detailCache, setDetailCache] = useState<Record<number, TestResult>>({})
  // Режим сравнения: [current, compare]
  const [compareIds, setCompareIds] = useState<[number, number] | null>(null)

  useEffect(() => {
    getMyResults()
      .then(setResults)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  /** Раскрыть/свернуть карточку + подгрузить детали */
  async function toggleExpand(id: number) {
    if (expandedId === id) {
      setExpandedId(null)
      return
    }
    setExpandedId(id)
    setCompareIds(null)

    // Загружаем полный результат если нет в кеше
    if (!detailCache[id]) {
      try {
        const detail = await getResultDetail(id)
        setDetailCache((prev) => ({ ...prev, [id]: detail }))
      } catch {
        // Ошибка загрузки — просто не показываем детали
      }
    }
  }

  /** Начать сравнение двух результатов из одной категории */
  async function startCompare(currentId: number, compareId: number) {
    const toLoad = [currentId, compareId].filter((id) => !detailCache[id])
    for (const id of toLoad) {
      try {
        const detail = await getResultDetail(id)
        setDetailCache((prev) => ({ ...prev, [id]: detail }))
      } catch { /* skip */ }
    }
    setCompareIds([currentId, compareId])
    setExpandedId(currentId)
  }

  /** Получить предыдущий результат по той же категории */
  function getPreviousResult(current: TestResultBrief): TestResultBrief | null {
    const sameCategory = results.filter(
      (r) => r.category_id === current.category_id && r.id !== current.id,
    )
    return sameCategory.find((r) => new Date(r.created_at) < new Date(current.created_at)) || null
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="text-3xl font-bold text-center mb-8">{t('results.history')}</h1>

      {results.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">📋</div>
          <p className="text-muted-foreground text-lg mb-6">{t('results.no_results')}</p>
          <Button size="lg" onClick={() => navigate('/tests')}>
            {t('tests.start_test')} →
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {results.map((r) => {
            const catName = (r[`category_name_${lang}` as keyof TestResultBrief] as string) || r.category_name_ru
            const levelColor = LEVEL_COLORS[r.condition_level] || LEVEL_COLORS.normal
            const levelLabel = t(`results.levels.${r.condition_level}`)
            const levelIcon = LEVEL_ICONS[r.condition_level] || ''
            const date = new Date(r.created_at).toLocaleDateString(
              lang === 'kk' ? 'kk-KZ' : lang === 'en' ? 'en-US' : 'ru-RU',
              { year: 'numeric', month: 'short', day: 'numeric' },
            )
            const isExpanded = expandedId === r.id
            const detail = detailCache[r.id]
            const previousResult = getPreviousResult(r)
            const isComparing = compareIds !== null && compareIds[0] === r.id

            return (
              <Card
                key={r.id}
                className={`transition-all duration-300 ${isExpanded ? 'shadow-lg border-primary/30' : 'hover:shadow-md cursor-pointer'}`}
              >
                {/* Основная строка */}
                <CardContent
                  className="flex items-center justify-between p-4"
                  onClick={() => toggleExpand(r.id)}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-2xl">{levelIcon}</span>
                    <div>
                      <h3 className="font-semibold">{catName}</h3>
                      <p className="text-sm text-muted-foreground">{date}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-primary">{r.raw_score}</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${levelColor}`}>
                      {levelLabel}
                    </span>
                    <span className={`text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                      ▼
                    </span>
                  </div>
                </CardContent>

                {/* Раскрытый контент */}
                {isExpanded && detail?.ai_analysis && (
                  <div className="border-t border-border px-4 pb-6 pt-4 space-y-4">
                    {/* Радар */}
                    <Card className="bg-secondary/20">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">
                          {t('results.radar_title')}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {isComparing && compareIds && detailCache[compareIds[1]]?.ai_analysis ? (
                          <EmotionalRadar
                            data={detail.ai_analysis.detailed_analysis as DetailedAnalysis}
                            compareData={detailCache[compareIds[1]].ai_analysis!.detailed_analysis as DetailedAnalysis}
                            labels={{
                              current: date,
                              compare: new Date(detailCache[compareIds[1]].created_at).toLocaleDateString(
                                lang === 'kk' ? 'kk-KZ' : lang === 'en' ? 'en-US' : 'ru-RU',
                                { month: 'short', day: 'numeric' },
                              ),
                            }}
                            height={300}
                          />
                        ) : (
                          <EmotionalRadar
                            data={detail.ai_analysis.detailed_analysis as DetailedAnalysis}
                            height={280}
                          />
                        )}
                      </CardContent>
                    </Card>

                    {/* AI саммари */}
                    <div>
                      <h4 className="font-medium text-sm mb-2">🤖 {t('results.summary')}</h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {detail.ai_analysis.summary}
                      </p>
                    </div>

                    {/* Кнопки */}
                    <div className="flex flex-wrap gap-2">
                      {previousResult && !isComparing && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation()
                            startCompare(r.id, previousResult.id)
                          }}
                        >
                          📊 {t('results.compare')}
                        </Button>
                      )}
                      {isComparing && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation()
                            setCompareIds(null)
                          }}
                        >
                          ✕ {t('results.hide_compare')}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/courses/${detail.ai_analysis!.recommended_course_id}`)
                        }}
                      >
                        {t('results.view_course')}
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
