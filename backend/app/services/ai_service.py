"""
Единый AI сервис — Groq (основной) + Gemini (резервный) + дефолтный ответ.
Реализован как класс-синглтон с DI через FastAPI Depends().
Всегда возвращает валидный JSON анализ, даже если оба провайдера недоступны.
"""
import json
import logging
from typing import Any

from openai import AsyncOpenAI
from google import genai

from app.config import settings
from app.schemas.ai import AIAnalysisRequest, AIAnalysisResponse

logger = logging.getLogger(__name__)

# ── Системные промпты ────────────────────────────────────────────────────────

ANALYSIS_SYSTEM_PROMPT = """You are a professional psychologist analyzing test results.
Given the test category, user's answers and raw score, provide a detailed analysis.

You MUST respond in valid JSON with this exact schema:
{
  "condition_level": "normal" | "elevated_stress" | "burnout_risk" | "critical",
  "score": <number 0-100>,
  "summary": "<brief description of user's psychological state>",
  "recommendations": ["<recommendation 1>", "<recommendation 2>", "<recommendation 3>"],
  "recommended_course_id": <number 1-5>,
  "detailed_analysis": {
    "stress": <number 0-100>,
    "burnout": <number 0-100>,
    "motivation": <number 0-100>,
    "anxiety": <number 0-100>,
    "emotional_state": <number 0-100>
  }
}

Category to course mapping:
1 = burnout, 2 = stress, 3 = emotional, 4 = motivation, 5 = anxiety

Age groups: elementary (6-10 years), middle (11-14), high (15-17), adult (18+).
Do NOT include the raw age_group string in the summary — describe the person naturally.

Scoring guidelines:
- raw_score 0-25% of max: normal
- raw_score 25-50% of max: elevated_stress
- raw_score 50-75% of max: burnout_risk
- raw_score 75-100% of max: critical

CRITICAL LANGUAGE RULE: The "User language" field specifies the ONLY language for "summary" and "recommendations".
- If user_language=ru → write summary and recommendations ENTIRELY in Russian. No English, no Chinese, no mixed text.
- If user_language=kk → write ENTIRELY in Kazakh.
- If user_language=en → write ENTIRELY in English.
Do NOT mix languages. Every word must be in the specified language.

ONLY output valid JSON, no markdown, no explanation."""

CHAT_SYSTEM_PROMPT = """You are a supportive psychological assistant on a well-being platform.
You help users understand their test results and recommend courses.
Be empathetic, professional, and constructive.
If the user shares test results context, reference it in your response.
Keep responses concise (2-4 paragraphs).

CRITICAL LANGUAGE RULE: You MUST respond in the SAME language the user writes in.
- If the user writes in Russian → respond ENTIRELY in Russian.
- If the user writes in Kazakh → respond ENTIRELY in Kazakh.
- If the user writes in English → respond ENTIRELY in English.
Do NOT mix languages. Do NOT insert words from other languages. Every single word must be in the same language."""


class AIService:
    """
    Сервис AI-анализа с автоматическим fallback:
    Groq (LLaMA 3.3 70B) → Gemini 2.5 Flash → детерминированный дефолт.

    Инициализируется один раз при старте приложения (синглтон).
    Клиенты API создаются лениво — только при наличии ключей.
    """

    def __init__(self) -> None:
        """Инициализация AI клиентов (только при наличии API ключей)."""
        # Groq клиент (через OpenAI SDK с кастомным base_url)
        self._groq_client: AsyncOpenAI | None = None
        if settings.GROQ_API_KEY:
            self._groq_client = AsyncOpenAI(
                api_key=settings.GROQ_API_KEY,
                base_url="https://api.groq.com/openai/v1",
            )
            logger.info("Groq AI клиент инициализирован")

        # Gemini клиент
        self._gemini_client: genai.Client | None = None
        if settings.GEMINI_API_KEY:
            self._gemini_client = genai.Client(api_key=settings.GEMINI_API_KEY)
            logger.info("Gemini AI клиент инициализирован")

        if not self._groq_client and not self._gemini_client:
            logger.warning(
                "Ни один AI провайдер не настроен — будет использоваться дефолтный анализ"
            )

    # ── Публичные методы ─────────────────────────────────────────────────────

    async def analyze(self, request: AIAnalysisRequest) -> dict[str, Any]:
        """
        Анализирует результаты теста через AI.
        Цепочка: Groq → Gemini → детерминированный дефолт.
        Всегда возвращает валидный dict, соответствующий AIAnalysisResponse.
        """
        user_message = self._build_analysis_prompt(request)

        # 1. Пробуем Groq (основной провайдер)
        if self._groq_client:
            try:
                result = await self._call_groq_analysis(user_message)
                if result:
                    logger.info("AI анализ выполнен через Groq")
                    return result
            except Exception as e:
                logger.warning(f"Groq API ошибка: {e}")

        # 2. Пробуем Gemini (резервный провайдер)
        if self._gemini_client:
            try:
                result = await self._call_gemini_analysis(user_message)
                if result:
                    logger.info("AI анализ выполнен через Gemini (fallback)")
                    return result
            except Exception as e:
                logger.warning(f"Gemini API ошибка: {e}")

        # 3. Дефолтный ответ (graceful degradation — без AI)
        logger.warning("Оба AI провайдера недоступны — используем дефолтный анализ")
        return self._get_default_analysis(request)

    async def chat(self, message: str, context: str = "", language: str = "ru") -> str:
        """
        Чат с AI ассистентом. Контекст включает результаты тестов.
        Цепочка: Groq → Gemini → дефолтный текстовый ответ.
        """
        user_message = message
        if context:
            user_message = f"User context:\n{context}\n\nUser message: {message}"

        # 1. Groq
        if self._groq_client:
            try:
                return await self._call_groq_chat(user_message)
            except Exception as e:
                logger.warning(f"Groq Chat ошибка: {e}")

        # 2. Gemini
        if self._gemini_client:
            try:
                return await self._call_gemini_chat(user_message)
            except Exception as e:
                logger.warning(f"Gemini Chat ошибка: {e}")

        # 3. Дефолтный ответ
        logger.warning("AI чат недоступен — возвращаем дефолтное сообщение")
        defaults = {
            "ru": "К сожалению, AI ассистент временно недоступен. Пожалуйста, ознакомьтесь с рекомендованными курсами на основе ваших результатов.",
            "en": "The AI assistant is temporarily unavailable. Please review the recommended courses based on your results.",
            "kk": "AI көмекші уақытша қолжетімсіз. Нәтижелеріңізге негізделген ұсынылған курстарды қараңыз.",
        }
        return defaults.get(language, defaults["ru"])

    # ── Приватные методы: построение промпта ──────────────────────────────────

    def _build_analysis_prompt(self, request: AIAnalysisRequest) -> str:
        """Формирует пользовательское сообщение для AI анализа."""
        return (
            f"Test category: {request.category_slug}\n"
            f"Age group: {request.age_group}\n"
            f"User answers: {request.answers}\n"
            f"Raw score: {request.raw_score} out of {request.max_score}\n"
            f"User language: {request.user_language}\n"
            f"Analyze the results and provide JSON response."
        )

    # ── Приватные методы: Groq ───────────────────────────────────────────────

    async def _call_groq_analysis(self, user_message: str) -> dict[str, Any] | None:
        """Вызов Groq API (LLaMA 3.3 70B) с JSON mode для анализа теста."""
        assert self._groq_client is not None

        response = await self._groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": ANALYSIS_SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            response_format={"type": "json_object"},
            temperature=0.3,
            max_tokens=1000,
        )

        content = response.choices[0].message.content
        if not content:
            return None

        # Парсим JSON и валидируем через Pydantic
        parsed = json.loads(content)
        validated = AIAnalysisResponse.model_validate(parsed)
        return validated.model_dump()

    async def _call_groq_chat(self, user_message: str) -> str:
        """Чат через Groq API — обычный текстовый ответ (без JSON mode)."""
        assert self._groq_client is not None

        response = await self._groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": CHAT_SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            temperature=0.7,
            max_tokens=500,
        )

        return response.choices[0].message.content or ""

    # ── Приватные методы: Gemini ─────────────────────────────────────────────

    async def _call_gemini_analysis(self, user_message: str) -> dict[str, Any] | None:
        """Вызов Google Gemini API с JSON mode для анализа теста."""
        assert self._gemini_client is not None

        response = await self._gemini_client.aio.models.generate_content(
            model="gemini-2.5-flash",
            contents=f"{ANALYSIS_SYSTEM_PROMPT}\n\n{user_message}",
            config=genai.types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.3,
                max_output_tokens=1000,
            ),
        )

        content = response.text
        if not content:
            return None

        parsed = json.loads(content)
        validated = AIAnalysisResponse.model_validate(parsed)
        return validated.model_dump()

    async def _call_gemini_chat(self, user_message: str) -> str:
        """Чат через Gemini API — обычный текстовый ответ."""
        assert self._gemini_client is not None

        response = await self._gemini_client.aio.models.generate_content(
            model="gemini-2.5-flash",
            contents=f"{CHAT_SYSTEM_PROMPT}\n\n{user_message}",
            config=genai.types.GenerateContentConfig(
                temperature=0.7,
                max_output_tokens=500,
            ),
        )

        return response.text or ""

    # ── Дефолтный анализ (graceful degradation) ──────────────────────────────

    def _get_default_analysis(self, request: AIAnalysisRequest) -> dict[str, Any]:
        """
        Генерирует детерминированный анализ когда оба AI провайдера недоступны.
        Основан на простой формуле по сырому баллу — без AI.
        """
        # Определяем уровень по процентной шкале
        pct = (request.raw_score / request.max_score * 100) if request.max_score > 0 else 50
        if pct < 25:
            level = "normal"
        elif pct < 50:
            level = "elevated_stress"
        elif pct < 75:
            level = "burnout_risk"
        else:
            level = "critical"

        # Маппинг категорий → id курсов
        course_map = {
            "burnout": 1, "stress": 2, "emotional": 3,
            "motivation": 4, "anxiety": 5,
        }
        course_id = course_map.get(request.category_slug, 1)

        # Саммари на нужном языке
        summaries = {
            "normal": {
                "ru": "Ваши показатели в пределах нормы. Продолжайте поддерживать своё психологическое здоровье.",
                "en": "Your indicators are within normal range. Keep maintaining your psychological well-being.",
                "kk": "Сіздің көрсеткіштеріңіз қалыпты шегінде. Психологиялық денсаулығыңызды қолдай беріңіз.",
            },
            "elevated_stress": {
                "ru": "Выявлен повышенный уровень стресса. Рекомендуется обратить внимание на методы релаксации.",
                "en": "Elevated stress level detected. Consider incorporating relaxation techniques.",
                "kk": "Стресс деңгейі жоғарылағаны анықталды. Босаңсу техникаларына назар аударыңыз.",
            },
            "burnout_risk": {
                "ru": "Выявлен риск профессионального выгорания. Рекомендуется консультация специалиста.",
                "en": "Burnout risk detected. Professional consultation is recommended.",
                "kk": "Кәсіби күйіп қалу қаупі анықталды. Маманмен кеңесу ұсынылады.",
            },
            "critical": {
                "ru": "Критическое состояние. Настоятельно рекомендуется обратиться к психологу.",
                "en": "Critical condition detected. Seeking professional help is strongly recommended.",
                "kk": "Сыни жағдай анықталды. Психологқа жүгіну ұсынылады.",
            },
        }

        lang = request.user_language if request.user_language in ("ru", "en", "kk") else "ru"
        score_normalized = int(pct)

        # Рекомендации на нужном языке (ровно 3 штуки)
        rec_templates = {
            "ru": [
                summaries[level]["ru"],
                "Рекомендуем пройти обучающий курс на нашей платформе.",
                "Следите за своим состоянием и проходите тесты регулярно.",
            ],
            "en": [
                summaries[level]["en"],
                "We recommend completing a course on our platform.",
                "Monitor your condition and take tests regularly.",
            ],
            "kk": [
                summaries[level]["kk"],
                "Біздің платформадағы оқу курсын өтуді ұсынамыз.",
                "Жағдайыңызды бақылап, тесттерді үнемі тапсырыңыз.",
            ],
        }

        # Детальный анализ зависит от категории теста
        cat = request.category_slug
        da = {
            "stress": min(100, score_normalized + 10) if cat == "stress" else max(0, 50 - score_normalized // 3),
            "burnout": min(100, score_normalized + 10) if cat == "burnout" else max(0, 50 - score_normalized // 3),
            "motivation": max(0, 100 - score_normalized),
            "anxiety": min(100, score_normalized + 10) if cat == "anxiety" else max(0, 50 - score_normalized // 3),
            "emotional_state": max(0, 100 - score_normalized // 2),
        }

        return {
            "condition_level": level,
            "score": score_normalized,
            "summary": summaries[level][lang],
            "recommendations": rec_templates[lang],
            "recommended_course_id": course_id,
            "detailed_analysis": da,
        }


# ── Синглтон и FastAPI dependency ────────────────────────────────────────────

# Единственный экземпляр AIService (создаётся при импорте модуля)
_ai_service: AIService | None = None


def get_ai_service() -> AIService:
    """
    FastAPI dependency — возвращает синглтон AIService.
    Используется в эндпоинтах: Depends(get_ai_service).
    """
    global _ai_service
    if _ai_service is None:
        _ai_service = AIService()
    return _ai_service
