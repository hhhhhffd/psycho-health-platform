/**
 * EmotionCamera — компонент распознавания эмоций через камеру.
 * Использует face-api.js для обнаружения лица и определения эмоции.
 * Результат можно сохранить через POST /api/emotions/.
 * face-api.js загружается динамически чтобы не блокировать Vite pre-bundling.
 * Грациозная деградация: если камера или модели недоступны — показывает сообщение.
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import apiClient from '@/api/client'
import { Camera, CameraOff, Save, Loader2 } from 'lucide-react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FaceAPI = any

/** Маппинг эмоций на эмодзи и цвета */
const EMOTION_MAP: Record<string, { emoji: string; color: string; label_key: string }> = {
  happy: { emoji: '😊', color: 'text-green-600', label_key: 'emotions.happy' },
  sad: { emoji: '😢', color: 'text-blue-600', label_key: 'emotions.sad' },
  angry: { emoji: '😠', color: 'text-red-600', label_key: 'emotions.angry' },
  surprised: { emoji: '😮', color: 'text-amber-600', label_key: 'emotions.surprised' },
  neutral: { emoji: '😐', color: 'text-gray-600', label_key: 'emotions.neutral' },
  fearful: { emoji: '😨', color: 'text-purple-600', label_key: 'emotions.fearful' },
  disgusted: { emoji: '🤢', color: 'text-green-800', label_key: 'emotions.disgusted' },
}

/** URL моделей face-api.js из CDN */
const MODELS_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model'

/** Модуль face-api.js кешируется после первой загрузки */
let faceapiModule: FaceAPI = null

export default function EmotionCamera() {
  const { t } = useTranslation()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [isLoading, setIsLoading] = useState(false)
  const [isCameraOn, setIsCameraOn] = useState(false)
  const [modelsLoaded, setModelsLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detectedEmotion, setDetectedEmotion] = useState<string | null>(null)
  const [confidence, setConfidence] = useState<number>(0)
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  /** Динамическая загрузка face-api.js и нейросетевых моделей */
  const loadModels = useCallback(async () => {
    try {
      setIsLoading(true)

      // Динамический импорт — Vite не пытается анализировать при старте
      if (!faceapiModule) {
        faceapiModule = await import('face-api.js')
      }

      await Promise.all([
        faceapiModule.nets.tinyFaceDetector.loadFromUri(MODELS_URL),
        faceapiModule.nets.faceExpressionNet.loadFromUri(MODELS_URL),
      ])
      setModelsLoaded(true)
    } catch (err) {
      console.error('Failed to load face-api models:', err)
      setError(t('emotions.model_error'))
    } finally {
      setIsLoading(false)
    }
  }, [t])

  /** Запуск камеры */
  async function startCamera() {
    setError(null)
    setSaved(false)

    // Загружаем модели если ещё не загружены
    if (!modelsLoaded) {
      await loadModels()
    }

    // Если загрузка моделей провалилась — не продолжаем
    if (!faceapiModule) return

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setIsCameraOn(true)

      // Запускаем детекцию каждые 500мс
      intervalRef.current = setInterval(detectEmotion, 500)
    } catch (err) {
      console.error('Camera error:', err)
      setError(t('emotions.camera_error'))
    }
  }

  /** Остановка камеры */
  function stopCamera() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setIsCameraOn(false)
  }

  /** Детекция эмоции на текущем кадре */
  async function detectEmotion() {
    if (!videoRef.current || !canvasRef.current || !faceapiModule) return

    try {
      const detection = await faceapiModule
        .detectSingleFace(videoRef.current, new faceapiModule.TinyFaceDetectorOptions())
        .withFaceExpressions()

      if (detection) {
        // Находим эмоцию с максимальной уверенностью
        const expressions = detection.expressions as Record<string, number>
        let maxEmotion = 'neutral'
        let maxConf = 0

        for (const [emotion, conf] of Object.entries(expressions)) {
          if (conf > maxConf) {
            maxConf = conf
            maxEmotion = emotion
          }
        }

        setDetectedEmotion(maxEmotion)
        setConfidence(Math.round(maxConf * 100))

        // Рисуем рамку вокруг лица
        const canvas = canvasRef.current
        const video = videoRef.current
        const displaySize = { width: video.videoWidth, height: video.videoHeight }
        faceapiModule.matchDimensions(canvas, displaySize)
        const resizedDetection = faceapiModule.resizeResults(detection, displaySize)
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          faceapiModule.draw.drawDetections(canvas, [resizedDetection])
        }
      }
    } catch {
      // Тихо игнорируем ошибки детекции — это нормально
    }
  }

  /** Сохранение результата на сервер */
  async function saveResult() {
    if (!detectedEmotion) return
    setIsSaving(true)
    try {
      await apiClient.post('/emotions/', {
        detected_emotion: detectedEmotion,
        confidence: confidence / 100,
      })
      setSaved(true)
    } catch (err) {
      console.error('Failed to save emotion:', err)
      setError(t('emotions.save_error'))
    } finally {
      setIsSaving(false)
    }
  }

  /** Очистка при размонтировании */
  useEffect(() => {
    return () => {
      stopCamera()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const emotionInfo = detectedEmotion ? EMOTION_MAP[detectedEmotion] : null

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="w-5 h-5" />
          {t('emotions.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Видео + оверлей canvas */}
        <div className="relative bg-muted rounded-lg overflow-hidden aspect-video flex items-center justify-center">
          <video
            ref={videoRef}
            className={`w-full h-full object-cover ${isCameraOn ? 'block' : 'hidden'}`}
            muted
            playsInline
          />
          <canvas
            ref={canvasRef}
            className={`absolute top-0 left-0 w-full h-full ${isCameraOn ? 'block' : 'hidden'}`}
          />
          {!isCameraOn && (
            <div className="text-center text-muted-foreground p-4">
              <CameraOff className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">{t('emotions.camera_off')}</p>
            </div>
          )}
        </div>

        {/* Кнопки управления камерой */}
        <div className="flex gap-2">
          {!isCameraOn ? (
            <Button onClick={startCamera} disabled={isLoading} className="flex-1 gap-2">
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Camera className="w-4 h-4" />
              )}
              {isLoading ? t('emotions.loading_models') : t('emotions.start')}
            </Button>
          ) : (
            <Button onClick={stopCamera} variant="outline" className="flex-1 gap-2">
              <CameraOff className="w-4 h-4" />
              {t('emotions.stop')}
            </Button>
          )}
        </div>

        {/* Результат детекции */}
        {detectedEmotion && emotionInfo && (
          <div className="text-center p-4 bg-secondary rounded-lg">
            <div className="text-4xl mb-2">{emotionInfo.emoji}</div>
            <div className={`text-lg font-bold ${emotionInfo.color}`}>
              {t(emotionInfo.label_key)}
            </div>
            <div className="text-sm text-muted-foreground">
              {t('emotions.confidence')}: {confidence}%
            </div>

            {/* Кнопка сохранения */}
            {!saved ? (
              <Button
                onClick={saveResult}
                disabled={isSaving}
                size="sm"
                className="mt-3 gap-2"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {t('emotions.save')}
              </Button>
            ) : (
              <p className="mt-3 text-sm text-green-600 font-medium">
                ✅ {t('emotions.saved')}
              </p>
            )}
          </div>
        )}

        {/* Ошибка */}
        {error && (
          <div className="text-center p-3 bg-destructive/10 rounded-lg text-destructive text-sm">
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
