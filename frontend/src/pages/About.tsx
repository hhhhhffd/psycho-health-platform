/**
 * Страница о платформе.
 */
import { useTranslation } from 'react-i18next'

export default function About() {
  const { t } = useTranslation()

  return (
    <div className="container mx-auto px-4 py-16 max-w-3xl">
      <h1 className="text-3xl font-bold text-center mb-8">{t('about.title')}</h1>
      <div className="prose prose-lg max-w-none text-muted-foreground space-y-6">
        <p>{t('about.description')}</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
          <div className="p-4 rounded-lg border border-border">
            <h3 className="font-semibold text-foreground mb-2">5 {t('about.tests')}</h3>
            <p className="text-sm">{t('about.tests_desc')}</p>
          </div>
          <div className="p-4 rounded-lg border border-border">
            <h3 className="font-semibold text-foreground mb-2">AI {t('about.analysis')}</h3>
            <p className="text-sm">{t('about.analysis_desc')}</p>
          </div>
          <div className="p-4 rounded-lg border border-border">
            <h3 className="font-semibold text-foreground mb-2">{t('about.courses')}</h3>
            <p className="text-sm">{t('about.courses_desc')}</p>
          </div>
          <div className="p-4 rounded-lg border border-border">
            <h3 className="font-semibold text-foreground mb-2">{t('about.multilang')}</h3>
            <p className="text-sm">{t('about.multilang_desc')}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
