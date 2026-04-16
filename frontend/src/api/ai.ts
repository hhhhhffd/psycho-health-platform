/**
 * API функции для AI чат-ассистента и эскалаций к психологу.
 */
import apiClient from './client'

export interface ChatResponse {
  response: string
}

export interface EscalationStatus {
  id: number
  status: 'pending' | 'responded' | 'closed'
  psychologist_reply: string | null
  created_at: string
  responded_at: string | null
}

export interface EscalationItem {
  id: number
  user_id: number
  user_name: string
  user_email: string
  user_message: string
  auto_escalated: boolean
  status: 'pending' | 'responded' | 'closed'
  psychologist_id: number | null
  psychologist_reply: string | null
  created_at: string
  responded_at: string | null
}

/** Отправить сообщение AI ассистенту */
export async function sendChatMessage(message: string): Promise<ChatResponse> {
  const response = await apiClient.post<ChatResponse>('/ai/chat', { message })
  return response.data
}

/** Запросить помощь психолога */
export async function requestPsychologist(
  userMessage: string,
  autoEscalated = false,
): Promise<EscalationStatus> {
  const response = await apiClient.post<EscalationStatus>('/ai/escalate', {
    user_message: userMessage,
    auto_escalated: autoEscalated,
  })
  return response.data
}

/** Получить статус своих запросов к психологу */
export async function getMyEscalations(): Promise<EscalationStatus[]> {
  const response = await apiClient.get<EscalationStatus[]>('/ai/escalations/my')
  return response.data
}

/** Психолог: получить все запросы */
export async function getAllEscalations(statusFilter?: string): Promise<EscalationItem[]> {
  const params = statusFilter ? { status_filter: statusFilter } : {}
  const response = await apiClient.get<EscalationItem[]>('/ai/escalations', { params })
  return response.data
}

/** Психолог: ответить на запрос */
export async function replyToEscalation(id: number, reply: string): Promise<void> {
  await apiClient.post(`/ai/escalations/${id}/reply`, { reply })
}

/** Закрыть запрос */
export async function closeEscalation(id: number): Promise<void> {
  await apiClient.patch(`/ai/escalations/${id}/close`)
}
