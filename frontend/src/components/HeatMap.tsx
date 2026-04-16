/**
 * HeatMap — тепловая карта стресса по категориям × возрастным группам.
 * Строки = возрастные группы (elementary, middle, high, adult)
 * Столбцы = категории тестов (5 шт.)
 * Ячейки = средний балл, окрашенный по шкале: зелёный → жёлтый → оранжевый → красный.
 * Тултипы при наведении показывают точные значения.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { HeatmapItem } from '@/api/analytics'

/** Категории в фиксированном порядке для столбцов */
const CATEGORY_SLUGS = ['burnout', 'stress', 'emotional', 'motivation', 'anxiety'] as const

/** Возрастные группы в фиксированном порядке для строк */
const AGE_GROUPS = ['elementary', 'middle', 'high', 'adult'] as const

/**
 * Возвращает цвет фона ячейки по среднему баллу (0–100).
 * Зелёный = низкий стресс (хорошо), красный = высокий стресс (плохо).
 */
function getScoreColor(score: number): string {
  if (score === 0) return 'bg-muted'
  if (score <= 25) return 'bg-green-100 text-green-800'
  if (score <= 50) return 'bg-yellow-100 text-yellow-800'
  if (score <= 75) return 'bg-orange-100 text-orange-800'
  return 'bg-red-100 text-red-800'
}

/**
 * Возвращает Tailwind border-color для акцентной полоски.
 */
function getScoreBorderColor(score: number): string {
  if (score === 0) return 'border-muted'
  if (score <= 25) return 'border-green-400'
  if (score <= 50) return 'border-yellow-400'
  if (score <= 75) return 'border-orange-400'
  return 'border-red-400'
}

interface Props {
  data: HeatmapItem[]
}

export default function HeatMap({ data }: Props) {
  const { t } = useTranslation()
  const [hoveredCell, setHoveredCell] = useState<string | null>(null)

  /** Поиск элемента в данных */
  function findItem(categorySlug: string, ageGroup: string): HeatmapItem | undefined {
    return data.find(
      (item) => item.category_slug === categorySlug && item.age_group === ageGroup
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        {/* Заголовки столбцов = категории */}
        <thead>
          <tr>
            <th className="text-left p-3 font-medium text-muted-foreground">
              {t('dashboard.category')}
            </th>
            {CATEGORY_SLUGS.map((slug) => (
              <th key={slug} className="p-3 text-center font-medium text-muted-foreground">
                {t(`tests.categories.${slug}`)}
              </th>
            ))}
          </tr>
        </thead>

        {/* Строки = возрастные группы */}
        <tbody>
          {AGE_GROUPS.map((ag) => (
            <tr key={ag} className="border-t border-border">
              <td className="p-3 font-medium">
                {t(`dashboard.age_groups.${ag}`)}
              </td>
              {CATEGORY_SLUGS.map((slug) => {
                const item = findItem(slug, ag)
                const score = item?.avg_score ?? 0
                const count = item?.count ?? 0
                const cellKey = `${ag}-${slug}`
                const isHovered = hoveredCell === cellKey

                return (
                  <td
                    key={slug}
                    className="p-1 text-center"
                    onMouseEnter={() => setHoveredCell(cellKey)}
                    onMouseLeave={() => setHoveredCell(null)}
                  >
                    <div
                      className={`relative rounded-lg p-3 transition-all duration-200 border-l-4 ${getScoreColor(score)} ${getScoreBorderColor(score)} ${
                        isHovered ? 'scale-105 shadow-md' : ''
                      }`}
                    >
                      {/* Средний балл */}
                      <div className="text-lg font-bold">
                        {count > 0 ? score : '—'}
                      </div>

                      {/* Кол-во тестов (показывается при наведении или всегда) */}
                      <div className="text-[10px] opacity-70">
                        {count > 0 ? `n=${count}` : ''}
                      </div>

                      {/* Тултип при наведении */}
                      {isHovered && count > 0 && (
                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-foreground text-background text-xs rounded-md px-2 py-1 whitespace-nowrap z-10 shadow-lg">
                          {t(`tests.categories.${slug}`)}: {score} ({count} {t('dashboard.tests_taken').toLowerCase()})
                        </div>
                      )}
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Легенда цветовой шкалы */}
      <div className="flex items-center justify-center gap-4 mt-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-green-100 border border-green-400" />
          <span>0–25</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-yellow-100 border border-yellow-400" />
          <span>26–50</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-orange-100 border border-orange-400" />
          <span>51–75</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-red-100 border border-red-400" />
          <span>76–100</span>
        </div>
      </div>
    </div>
  )
}
