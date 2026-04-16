/**
 * EmotionalRadar — компонент RadarChart для визуализации эмоционального профиля.
 * Поддерживает один или два датасета (для сравнения before/after).
 * Используется на страницах TestResult и MyResults.
 */
import { useTranslation } from 'react-i18next'
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ResponsiveContainer, Legend,
} from 'recharts'

/** Данные детального анализа — 5 осей по 0-100 */
export interface DetailedAnalysis {
  stress: number
  burnout: number
  motivation: number
  anxiety: number
  emotional_state: number
}

interface EmotionalRadarProps {
  /** Основной (текущий) датасет */
  data: DetailedAnalysis
  /** Второй датасет для сравнения (before/after) */
  compareData?: DetailedAnalysis
  /** Подписи к легенде при двойном отображении */
  labels?: { current: string; compare: string }
  /** Высота графика (по умолчанию 320) */
  height?: number
}

export default function EmotionalRadar({
  data,
  compareData,
  labels,
  height = 320,
}: EmotionalRadarProps) {
  const { t } = useTranslation()

  // Метки осей с переводом
  const axisLabels = [
    { key: 'stress', label: t('tests.categories.stress') },
    { key: 'burnout', label: t('tests.categories.burnout') },
    { key: 'motivation', label: t('tests.categories.motivation') },
    { key: 'anxiety', label: t('tests.categories.anxiety') },
    { key: 'emotional_state', label: t('tests.categories.emotional') },
  ]

  // Формируем данные для recharts
  const chartData = axisLabels.map(({ key, label }) => ({
    axis: label,
    current: data[key as keyof DetailedAnalysis] ?? 0,
    ...(compareData ? { compare: compareData[key as keyof DetailedAnalysis] ?? 0 } : {}),
  }))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={chartData} cx="50%" cy="50%" outerRadius="75%">
        <PolarGrid stroke="#e2e8f0" />
        <PolarAngleAxis
          dataKey="axis"
          tick={{ fontSize: 12, fill: '#64748b' }}
        />
        <PolarRadiusAxis
          angle={30}
          domain={[0, 100]}
          tick={{ fontSize: 10, fill: '#94a3b8' }}
          tickCount={5}
        />

        {/* Второй датасет (фоновый, если есть — рисуется первым, под основным) */}
        {compareData && (
          <Radar
            name={labels?.compare || 'Before'}
            dataKey="compare"
            stroke="#94a3b8"
            fill="#94a3b8"
            fillOpacity={0.15}
            strokeWidth={1.5}
            strokeDasharray="5 5"
          />
        )}

        {/* Основной датасет — яркий градиент */}
        <Radar
          name={labels?.current || 'Current'}
          dataKey="current"
          stroke="#6366f1"
          fill="url(#radarGradient)"
          fillOpacity={0.4}
          strokeWidth={2}
          dot={{ r: 3, fill: '#6366f1' }}
        />

        {/* Градиент для заливки */}
        <defs>
          <radialGradient id="radarGradient" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#818cf8" stopOpacity={0.8} />
            <stop offset="100%" stopColor="#6366f1" stopOpacity={0.2} />
          </radialGradient>
        </defs>

        {/* Легенда только при двух датасетах */}
        {compareData && (
          <Legend
            wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
          />
        )}
      </RadarChart>
    </ResponsiveContainer>
  )
}
