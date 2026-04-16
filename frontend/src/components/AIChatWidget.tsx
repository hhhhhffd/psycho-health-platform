/**
 * AIChatWidget — плавающий AI чат с кнопкой "Позвать психолога".
 * Поддерживает:
 * - Сохранение истории чата в localStorage (per user)
 * - Real-time статус эскалации через WebSocket (не polling!)
 * - Кнопку "Очистить чат"
 * - Возможность звать психолога повторно (когда предыдущий запрос закрыт)
 */
import { useState, useRef, useEffect, useCallback, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/authStore'
import {
  sendChatMessage,
  requestPsychologist,
  getMyEscalations,
  type EscalationStatus,
} from '@/api/ai'
import { useWebSocket } from '@/hooks/useWebSocket'
import { Button } from '@/components/ui/button'
import {
  MessageCircle, X, Send, Bot, User, Phone, CheckCircle, Clock, Trash2,
} from 'lucide-react'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  text: string
  timestamp: Date
}

interface StoredMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  text: string
  timestamp: string
}

/** Ключевые слова для автоматической эскалации к психологу */
const ESCALATION_KEYWORDS = [
  'суицид', 'убить себя', 'умереть', 'не хочу жить', 'конец жизни',
  'suicide', 'kill myself', 'end my life', 'want to die',
  'өзімді өлтіру',
]

function genId(): string { return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }
function formatTime(d: Date): string { return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
function needsAutoEscalation(text: string): boolean {
  const lower = text.toLowerCase()
  return ESCALATION_KEYWORDS.some((kw) => lower.includes(kw))
}

// ── localStorage helpers ──────────────────────────────────────────────────────
const chatKey       = (uid: number) => `chat_messages_${uid}`
const escalationKey = (uid: number) => `chat_escalation_${uid}`

function saveMessages(userId: number, msgs: ChatMessage[]): void {
  try {
    localStorage.setItem(chatKey(userId), JSON.stringify(
      msgs.map((m) => ({ ...m, timestamp: m.timestamp.toISOString() })) as StoredMessage[],
    ))
  } catch { /* QuotaExceededError */ }
}

function loadMessages(userId: number): ChatMessage[] {
  try {
    const raw = localStorage.getItem(chatKey(userId))
    if (!raw) return []
    return (JSON.parse(raw) as StoredMessage[]).map((m) => ({ ...m, timestamp: new Date(m.timestamp) }))
  } catch { return [] }
}

function saveEscalation(userId: number, esc: EscalationStatus | null): void {
  try {
    if (esc) localStorage.setItem(escalationKey(userId), JSON.stringify(esc))
    else     localStorage.removeItem(escalationKey(userId))
  } catch { /* ignore */ }
}

function loadEscalation(userId: number): EscalationStatus | null {
  try {
    const raw = localStorage.getItem(escalationKey(userId))
    return raw ? (JSON.parse(raw) as EscalationStatus) : null
  } catch { return null }
}

// ─────────────────────────────────────────────────────────────────────────────

export default function AIChatWidget() {
  const { t } = useTranslation()
  const { isAuthenticated, user } = useAuthStore()

  const [isOpen,       setIsOpen]       = useState(false)
  const [messages,     setMessages]     = useState<ChatMessage[]>([])
  const [input,        setInput]        = useState('')
  const [isLoading,    setIsLoading]    = useState(false)
  const [escalation,   setEscalation]   = useState<EscalationStatus | null>(null)
  const [isEscalating, setIsEscalating] = useState(false)
  const [initialized,  setInitialized]  = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef       = useRef<HTMLInputElement>(null)

  if (!isAuthenticated || !user) return null

  const userId = user.id

  // Активен ли WebSocket — только пока есть pending эскалация
  const wsEnabled = !!escalation && escalation.status === 'pending'

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  /* eslint-disable react-hooks/rules-of-hooks */

  useEffect(() => { scrollToBottom() }, [messages, scrollToBottom])
  useEffect(() => { if (isOpen) setTimeout(() => inputRef.current?.focus(), 300) }, [isOpen])

  /** Инициализация — загружаем кеш один раз при монтировании */
  useEffect(() => {
    if (initialized) return
    setInitialized(true)

    const cachedMsgs = loadMessages(userId)
    const cachedEsc  = loadEscalation(userId)

    if (cachedMsgs.length > 0) setMessages(cachedMsgs)

    if (cachedEsc && cachedEsc.status !== 'closed') {
      setEscalation(cachedEsc)
      // Синхронизируем с сервером для актуального статуса
      getMyEscalations()
        .then((list) => {
          const fresh = list.find((e) => e.id === cachedEsc.id)
          if (fresh) { setEscalation(fresh); saveEscalation(userId, fresh) }
        })
        .catch(() => null)
    }
  }, [initialized, userId])

  /** Приветствие — только если история пуста */
  useEffect(() => {
    if (!isOpen) return
    setMessages((prev) => {
      if (prev.length > 0) return prev
      const welcome: ChatMessage = { id: genId(), role: 'assistant', text: t('chat.welcome'), timestamp: new Date() }
      saveMessages(userId, [welcome])
      return [welcome]
    })
  }, [isOpen, t, userId])

  /**
   * WebSocket — real-time уведомления о статусе эскалации.
   * Подключается только когда есть активная pending эскалация.
   * При ответе психолога — добавляет сообщение в чат мгновенно.
   */
  useWebSocket(
    'user',
    useCallback((raw: unknown) => {
      const data = raw as { type: string; id: number; status: string; reply?: string | null }
      if (data.type !== 'escalation_update') return

      setEscalation((prev) => {
        if (!prev || prev.id !== data.id) return prev
        const updated = { ...prev, status: data.status as EscalationStatus['status'] }
        saveEscalation(userId, updated)
        return updated
      })

      if (data.status === 'responded' && data.reply) {
        const msg: ChatMessage = {
          id: genId(), role: 'system',
          text: `${t('chat.psych_replied')} ${data.reply}`,
          timestamp: new Date(),
        }
        setMessages((prev) => { const next = [...prev, msg]; saveMessages(userId, next); return next })
      } else if (data.status === 'closed') {
        const msg: ChatMessage = { id: genId(), role: 'system', text: t('chat.psych_closed'), timestamp: new Date() }
        setMessages((prev) => { const next = [...prev, msg]; saveMessages(userId, next); return next })
      }
    }, [t, userId]),
    wsEnabled,
  )

  /* eslint-enable react-hooks/rules-of-hooks */

  function addMessages(newMsgs: ChatMessage[]): void {
    setMessages((prev) => { const next = [...prev, ...newMsgs]; saveMessages(userId, next); return next })
  }

  /** Очистить историю чата */
  function handleClearChat(): void {
    setMessages([])
    saveMessages(userId, [])
    // Эскалацию не трогаем — она живёт отдельно
  }

  /** Отправка сообщения в AI */
  async function handleSend(e?: FormEvent) {
    e?.preventDefault()
    const text = input.trim()
    if (!text || isLoading) return

    addMessages([{ id: genId(), role: 'user', text, timestamp: new Date() }])
    setInput('')
    setIsLoading(true)

    try {
      if (needsAutoEscalation(text)) { await handleEscalate(text, true); return }
      const response = await sendChatMessage(text)
      addMessages([{ id: genId(), role: 'assistant', text: response.response, timestamp: new Date() }])
    } catch {
      addMessages([{ id: genId(), role: 'assistant', text: t('chat.error'), timestamp: new Date() }])
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Запрос живого психолога.
   * Разрешён если нет активной эскалации (null) или предыдущая уже закрыта.
   */
  async function handleEscalate(contextMessage?: string, auto = false) {
    const isActive = escalation && escalation.status !== 'closed'
    if (isEscalating || isActive) return
    setIsEscalating(true)

    const context = contextMessage
      ?? messages.slice(-4).map((m) => `${m.role === 'user' ? 'Пользователь' : 'AI'}: ${m.text}`).join('\n')

    try {
      const result = await requestPsychologist(context, auto)
      setEscalation(result)
      saveEscalation(userId, result)
      addMessages([{
        id: genId(), role: 'system',
        text: auto ? t('chat.auto_escalated') : t('chat.escalated'),
        timestamp: new Date(),
      }])
    } catch {
      addMessages([{ id: genId(), role: 'assistant', text: t('chat.escalate_error'), timestamp: new Date() }])
    } finally {
      setIsEscalating(false)
      setIsLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const canCallPsych = !escalation || escalation.status === 'closed'

  return (
    <>
      {/* ── Плавающая кнопка ─────────────────────────────────────────────── */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110 ${
          isOpen ? 'bg-muted-foreground text-background' : 'bg-primary text-primary-foreground'
        }`}
        aria-label={t('chat.title')}
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
      </button>

      {/* ── Панель чата ──────────────────────────────────────────────────── */}
      <div
        className={`fixed bottom-24 right-6 z-50 w-[380px] max-w-[calc(100vw-2rem)] bg-background border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 origin-bottom-right ${
          isOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4 pointer-events-none'
        }`}
        style={{ height: '540px' }}
      >
        {/* Заголовок */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-primary/5">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Bot className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm text-foreground">{t('chat.title')}</h3>
            <p className="text-xs text-muted-foreground">
              {isLoading ? t('chat.thinking') : t('chat.online')}
            </p>
          </div>

          {/* Кнопка "Позвать психолога" — видна если нет активной эскалации */}
          {canCallPsych ? (
            <button
              onClick={() => handleEscalate()}
              disabled={isEscalating}
              title={t('chat.call_psychologist')}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors disabled:opacity-50 flex-shrink-0"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>{t('chat.call_psychologist')}</span>
            </button>
          ) : (
            // Индикатор статуса активной эскалации
            <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg flex-shrink-0 ${
              escalation?.status === 'pending'
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-green-100 text-green-800'
            }`}>
              {escalation?.status === 'pending'
                ? <><Clock className="w-3 h-3" /><span>{t('chat.psych_pending_short')}</span></>
                : <><CheckCircle className="w-3 h-3" /><span>{t('chat.psych_replied_short')}</span></>
              }
            </div>
          )}

          {/* Кнопка очистки чата */}
          <button
            onClick={handleClearChat}
            title="Очистить чат"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Сообщения */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {messages.map((msg) => {
            if (msg.role === 'system') {
              return (
                <div key={msg.id} className="flex justify-center">
                  <div className="bg-amber-50 border border-amber-200 text-amber-700 text-xs px-3 py-1.5 rounded-full max-w-[85%] text-center whitespace-pre-wrap">
                    {msg.text}
                  </div>
                </div>
              )
            }
            return (
              <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
                  msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'
                }`}>
                  {msg.role === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                </div>
                <div className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-md'
                    : 'bg-secondary text-foreground rounded-bl-md'
                }`}>
                  <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                  <p className={`text-[10px] mt-1 ${
                    msg.role === 'user' ? 'text-primary-foreground/60' : 'text-muted-foreground'
                  }`}>
                    {formatTime(msg.timestamp)}
                  </p>
                </div>
              </div>
            )
          })}

          {isLoading && (
            <div className="flex gap-2">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="bg-secondary rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Поле ввода */}
        <div className="border-t border-border px-3 py-3">
          <form onSubmit={handleSend} className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('chat.placeholder')}
              disabled={isLoading}
              className="flex-1 h-10 px-3 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50 transition-colors"
            />
            <Button type="submit" size="sm" disabled={!input.trim() || isLoading} className="h-10 w-10 p-0 rounded-xl">
              <Send className="w-4 h-4" />
            </Button>
          </form>
          <p className="text-center text-[10px] text-muted-foreground/50 mt-2">{t('chat.powered_by')}</p>
        </div>
      </div>
    </>
  )
}
