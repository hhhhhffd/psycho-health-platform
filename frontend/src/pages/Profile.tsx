/**
 * Профиль пользователя — данные аккаунта + переключение языка.
 * Язык сохраняется в i18next и обновляет UI мгновенно.
 */
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/authStore'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import EmotionCamera from '@/components/EmotionCamera'

/** Доступные языки с метками */
const LANGUAGES = [
  { code: 'kk', label: 'Қазақша', flag: '🇰🇿' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
] as const

/** Карта ролей с i18n-меткой и цветом бейджа */
const ROLE_STYLES: Record<string, { label: Record<string, string>; color: string }> = {
  user: {
    label: { ru: 'Пользователь', en: 'User', kk: 'Пайдаланушы' },
    color: 'bg-blue-100 text-blue-700',
  },
  psychologist: {
    label: { ru: 'Психолог', en: 'Psychologist', kk: 'Психолог' },
    color: 'bg-purple-100 text-purple-700',
  },
  admin: {
    label: { ru: 'Администратор', en: 'Administrator', kk: 'Әкімші' },
    color: 'bg-red-100 text-red-700',
  },
}

/** Карта возрастных групп */
const AGE_GROUP_LABELS: Record<string, Record<string, string>> = {
  elementary: { ru: 'Начальная школа', en: 'Elementary', kk: 'Бастауыш мектеп' },
  middle: { ru: 'Средняя школа', en: 'Middle School', kk: 'Орта мектеп' },
  high: { ru: 'Старшая школа', en: 'High School', kk: 'Жоғары мектеп' },
  adult: { ru: 'Взрослый', en: 'Adult', kk: 'Ересек' },
}

export default function Profile() {
  const { t, i18n } = useTranslation()
  const { user } = useAuthStore()
  const lang = (i18n.language || 'ru') as 'ru' | 'en' | 'kk'

  if (!user) return null

  const roleInfo = ROLE_STYLES[user.role] || ROLE_STYLES.user
  const ageGroupLabel = user.age_group
    ? (AGE_GROUP_LABELS[user.age_group]?.[lang] || user.age_group)
    : '—'

  return (
    <div className="container mx-auto px-4 py-8 max-w-lg space-y-6">
      <h1 className="text-3xl font-bold text-center mb-8">{t('profile.title')}</h1>

      {/* Аватар + имя */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-3xl font-bold text-primary mb-3">
          {user.full_name.charAt(0).toUpperCase()}
        </div>
        <h2 className="text-xl font-semibold">{user.full_name}</h2>
        <span className={`mt-2 px-3 py-1 rounded-full text-xs font-medium ${roleInfo.color}`}>
          {roleInfo.label[lang] || user.role}
        </span>
      </div>

      {/* Данные профиля */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">{t('profile.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ProfileRow label="Email" value={user.email} />
          <ProfileRow label={t('profile.role')} value={roleInfo.label[lang] || user.role} />
          <ProfileRow label={t('tests.age_group')} value={ageGroupLabel} />
          <ProfileRow
            label={t('profile.member_since')}
            value={new Date(user.created_at).toLocaleDateString(
              lang === 'kk' ? 'kk-KZ' : lang === 'en' ? 'en-US' : 'ru-RU',
              { year: 'numeric', month: 'long', day: 'numeric' },
            )}
          />
        </CardContent>
      </Card>

      {/* Распознавание эмоций (бонус) */}
      <EmotionCamera />

      {/* Выбор языка */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('profile.language') || 'Language'}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {LANGUAGES.map(({ code, label, flag }) => (
              <button
                key={code}
                onClick={() => i18n.changeLanguage(code)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200 ${
                  i18n.language === code
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border hover:border-primary/30 hover:bg-secondary'
                }`}
              >
                <span className="text-2xl">{flag}</span>
                <span className={`text-sm font-medium ${
                  i18n.language === code ? 'text-primary' : 'text-muted-foreground'
                }`}>
                  {label}
                </span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/** Строка данных профиля */
function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="font-medium text-sm">{value}</span>
    </div>
  )
}
