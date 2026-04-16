/**
 * Страница прохождения теста — вопросы с вариантами ответа (Likert 0-4).
 * Показывает один вопрос за раз, прогресс-бар, кнопки навигации.
 */
import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getQuestions, submitTest, type TestQuestion } from '@/api/tests'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

/** Варианты ответа по шкале Likert */
const LIKERT_OPTIONS = {
  ru: ['Никогда', 'Редко', 'Иногда', 'Часто', 'Постоянно'],
  kk: ['Ешқашан', 'Сирек', 'Кейде', 'Жиі', 'Үнемі'],
  en: ['Never', 'Rarely', 'Sometimes', 'Often', 'Always'],
}

export default function TestPass() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()

  const ageGroup = searchParams.get('age_group') || 'adult'
  const lang = (i18n.language || 'ru') as 'ru' | 'en' | 'kk'
  const options = LIKERT_OPTIONS[lang] || LIKERT_OPTIONS.ru

  const [questions, setQuestions] = useState<TestQuestion[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [answers, setAnswers] = useState<(number | null)[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Загружаем вопросы
  useEffect(() => {
    if (!id) return
    setLoading(true)
    getQuestions(Number(id), ageGroup)
      .then((qs) => {
        setQuestions(qs)
        setAnswers(new Array(qs.length).fill(null))
      })
      .catch(() => setError('Ошибка загрузки вопросов'))
      .finally(() => setLoading(false))
  }, [id, ageGroup])

  /** Выбор ответа для текущего вопроса */
  function selectAnswer(value: number) {
    const newAnswers = [...answers]
    newAnswers[currentIdx] = value
    setAnswers(newAnswers)
  }

  /** Отправка теста */
  async function handleSubmit() {
    if (!id || answers.includes(null)) return
    setSubmitting(true)
    try {
      const result = await submitTest(Number(id), answers as number[])
      navigate(`/tests/${id}/result`, { state: { result } })
    } catch {
      setError('Ошибка отправки теста')
      setSubmitting(false)
    }
  }

  const question = questions[currentIdx]
  const progress = questions.length > 0 ? ((currentIdx + 1) / questions.length) * 100 : 0
  const isLast = currentIdx === questions.length - 1
  const allAnswered = !answers.includes(null)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    )
  }

  if (error || !question) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <p className="text-red-500">{error || t('common.error')}</p>
        <Button className="mt-4" onClick={() => navigate('/tests')}>{t('tests.back_to_tests')}</Button>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      {/* Прогресс-бар */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-muted-foreground mb-2">
          <span>{t('tests.question')} {currentIdx + 1} / {questions.length}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-2 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Карточка вопроса */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg leading-relaxed">
            {(question[`question_${lang}` as keyof TestQuestion] as string) || question.question_ru}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {options.map((label, idx) => (
            <button
              key={idx}
              onClick={() => selectAnswer(idx)}
              className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                answers[currentIdx] === idx
                  ? 'border-primary bg-primary/10 text-primary font-medium'
                  : 'border-border hover:border-primary/50 hover:bg-secondary'
              }`}
            >
              {label}
            </button>
          ))}
        </CardContent>
      </Card>

      {/* Навигация */}
      <div className="flex justify-between mt-6">
        <Button
          variant="outline"
          onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
          disabled={currentIdx === 0}
        >
          {t('common.back')}
        </Button>

        {isLast ? (
          <Button onClick={handleSubmit} disabled={!allAnswered || submitting}>
            {submitting ? t('common.loading') : t('tests.submit_test')}
          </Button>
        ) : (
          <Button
            onClick={() => setCurrentIdx((i) => Math.min(questions.length - 1, i + 1))}
            disabled={answers[currentIdx] === null}
          >
            {t('common.next')}
          </Button>
        )}
      </div>
    </div>
  )
}
