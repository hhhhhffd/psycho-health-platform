/**
 * Настройка react-i18next.
 * Поддерживаемые языки: Казахский (kk), Русский (ru), Английский (en).
 * Переводы загружаются из /public/locales/{lang}/translation.json.
 */
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import HttpBackend from 'i18next-http-backend'

i18n
  .use(HttpBackend)           // Загружает переводы с сервера
  .use(LanguageDetector)      // Определяет язык браузера
  .use(initReactI18next)      // Интегрирует с React
  .init({
    // Язык по умолчанию
    fallbackLng: 'ru',

    // Поддерживаемые языки
    supportedLngs: ['kk', 'ru', 'en'],

    // Путь к файлам переводов в /public
    backend: {
      loadPath: '/locales/{{lng}}/translation.json',
    },

    // Настройки определения языка
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18n_language',
    },

    interpolation: {
      escapeValue: false, // React уже экранирует XSS
    },

    // В dev показываем ключи если перевод не найден
    debug: import.meta.env.DEV,
  })

export default i18n
