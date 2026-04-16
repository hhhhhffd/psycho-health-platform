/**
 * Zustand стор для результатов тестов.
 * Хранит текущий тест, ответы и результат AI анализа.
 */
import { create } from 'zustand'

export interface TestAnswer {
  question_id: number
  answer_value: number
}

export interface AIAnalysisResult {
  condition_level: 'normal' | 'elevated_stress' | 'burnout_risk' | 'critical'
  score: number
  summary: string
  recommendations: string[]
  recommended_course_id: number
  detailed_analysis: {
    stress: number
    burnout: number
    motivation: number
    anxiety: number
    emotional_state: number
  }
}

export interface TestResult {
  id: number
  test_id: number
  test_name: string
  score: number
  condition_level: string
  ai_analysis: AIAnalysisResult
  created_at: string
}

interface TestState {
  currentTestId: number | null
  answers: TestAnswer[]
  lastResult: TestResult | null

  /** Установить текущий тест */
  setCurrentTest: (testId: number) => void

  /** Добавить или обновить ответ на вопрос */
  setAnswer: (answer: TestAnswer) => void

  /** Сохранить результат после завершения теста */
  setLastResult: (result: TestResult) => void

  /** Сбросить ответы (при начале нового теста) */
  resetAnswers: () => void
}

export const useTestStore = create<TestState>()((set) => ({
  currentTestId: null,
  answers: [],
  lastResult: null,

  setCurrentTest: (testId: number) => {
    set({ currentTestId: testId, answers: [] })
  },

  setAnswer: (answer: TestAnswer) => {
    set((state) => {
      // Обновляем существующий ответ или добавляем новый
      const existing = state.answers.findIndex(
        (a) => a.question_id === answer.question_id
      )
      if (existing >= 0) {
        const updated = [...state.answers]
        updated[existing] = answer
        return { answers: updated }
      }
      return { answers: [...state.answers, answer] }
    })
  },

  setLastResult: (result: TestResult) => {
    set({ lastResult: result })
  },

  resetAnswers: () => {
    set({ answers: [], currentTestId: null })
  },
}))
