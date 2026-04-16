/**
 * Хук для WebSocket соединения с авто-переподключением.
 * Токен передаётся как query-параметр (заголовки WS не поддерживаются браузерами).
 * При разрыве соединения — переподключение через 3 секунды.
 */
import { useEffect, useRef, useCallback } from 'react'
import { useAuthStore } from '@/stores/authStore'

export function useWebSocket(
  /** Путь после /api/ws/, например "user" или "psychologist" */
  path: string,
  /** Колбэк при получении сообщения */
  onMessage: (data: unknown) => void,
  /** Флаг включения: false — соединение не создаётся */
  enabled = true,
) {
  const { token } = useAuthStore()
  const wsRef     = useRef<WebSocket | null>(null)
  const activeRef = useRef(true)  // false когда компонент размонтирован

  // Храним актуальный onMessage в ref чтобы не пересоздавать эффект при каждом рендере
  const onMessageRef = useRef(onMessage)
  useEffect(() => { onMessageRef.current = onMessage }, [onMessage])

  const connect = useCallback(() => {
    if (!token || !activeRef.current) return

    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const host  = window.location.host
    const url   = `${proto}://${host}/api/ws/${path}?token=${encodeURIComponent(token)}`

    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onmessage = (e) => {
      try { onMessageRef.current(JSON.parse(e.data as string)) }
      catch { /* игнорируем невалидный JSON */ }
    }

    ws.onerror = () => ws.close()

    ws.onclose = () => {
      wsRef.current = null
      // Авто-переподключение через 3 сек если компонент ещё жив
      if (activeRef.current) {
        setTimeout(() => { if (activeRef.current) connect() }, 3000)
      }
    }
  }, [token, path])

  useEffect(() => {
    if (!enabled || !token) return

    activeRef.current = true
    connect()

    return () => {
      // При размонтировании или смене параметров — закрываем соединение
      activeRef.current = false
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [enabled, token, connect])

  return wsRef
}
