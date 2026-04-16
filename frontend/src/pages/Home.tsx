/**
 * Главная страница — hero секция, карточки возможностей, статистика.
 * Дизайн: чистый, современный, впечатляющий для жюри хакатона.
 */
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/authStore'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

export default function Home() {
  const { t } = useTranslation()
  const { isAuthenticated } = useAuthStore()

  return (
    <div className="flex flex-col">
      {/* ── Hero секция ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-24 md:py-32 px-4">
        {/* Декоративный фон — градиент */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/5 via-background to-primary/10" />
        <div className="absolute top-20 right-10 -z-10 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-10 left-10 -z-10 h-56 w-56 rounded-full bg-primary/5 blur-3xl" />

        <div className="container mx-auto text-center max-w-4xl">
          {/* Бейдж */}
          <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary mb-6">
            <span className="mr-2">🧠</span>
            AI-Powered Psychology Platform
          </div>

          {/* Заголовок */}
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-foreground leading-tight">
            {t('home.hero_title')}
          </h1>

          {/* Подзаголовок */}
          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            {t('home.hero_subtitle')}
          </p>

          {/* CTA кнопки */}
          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="text-base px-8 py-6" asChild>
              <Link to={isAuthenticated ? '/tests' : '/register'}>
                {t('home.cta_button')} →
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="text-base px-8 py-6" asChild>
              <Link to="/about">
                {t('about.title')}
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Статистика ──────────────────────────────────────────────────── */}
      <section className="border-y border-border bg-secondary/30 py-12 px-4">
        <div className="container mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl text-center">
          <StatItem value="500+" label={t('dashboard.users')} />
          <StatItem value="2000+" label={t('dashboard.tests_taken')} />
          <StatItem value="5" label={t('about.tests')} />
          <StatItem value="3" label={t('about.multilang')} />
        </div>
      </section>

      {/* ── Карточки возможностей ────────────────────────────────────────── */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-5xl">
          <h2 className="text-3xl font-bold text-center mb-12">
            {t('home.features_title')}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FeatureCard
              icon="📋"
              title={t('about.tests')}
              description={t('about.tests_desc')}
              color="bg-blue-50 border-blue-100"
              iconBg="bg-blue-100"
            />
            <FeatureCard
              icon="🤖"
              title={`AI ${t('about.analysis')}`}
              description={t('about.analysis_desc')}
              color="bg-purple-50 border-purple-100"
              iconBg="bg-purple-100"
            />
            <FeatureCard
              icon="📚"
              title={t('about.courses')}
              description={t('about.courses_desc')}
              color="bg-green-50 border-green-100"
              iconBg="bg-green-100"
            />
          </div>
        </div>
      </section>

      {/* ── Как это работает ─────────────────────────────────────────────── */}
      <section className="py-20 px-4 bg-secondary/20">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold text-center mb-12">
            {t('home.features_title')}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <StepCard step={1} icon="✍️" title={t('home.cta_button')} />
            <StepCard step={2} icon="📊" title={t('results.title')} />
            <StepCard step={3} icon="🎓" title={t('courses.title')} />
          </div>
        </div>
      </section>
    </div>
  )
}

/** Карточка статистики */
function StatItem({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-3xl md:text-4xl font-bold text-primary">{value}</div>
      <div className="text-sm text-muted-foreground mt-1">{label}</div>
    </div>
  )
}

/** Карточка возможности */
function FeatureCard({
  icon, title, description, color, iconBg,
}: {
  icon: string; title: string; description: string; color: string; iconBg: string
}) {
  return (
    <Card className={`border ${color} hover:shadow-lg transition-all duration-300 hover:-translate-y-1`}>
      <CardContent className="p-6">
        <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${iconBg} text-2xl mb-4`}>
          {icon}
        </div>
        <h3 className="font-semibold text-foreground text-lg mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      </CardContent>
    </Card>
  )
}

/** Шаг «Как это работает» */
function StepCard({ step, icon, title }: { step: number; icon: string; title: string }) {
  return (
    <div className="text-center">
      <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-3xl mb-4">
        {icon}
        <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
          {step}
        </span>
      </div>
      <h3 className="font-semibold text-foreground">{title}</h3>
    </div>
  )
}
