/**
 * Дашборд психолога — 4 таба:
 * 1. Аналитика (графики, heatmap, PDF)
 * 2. Управление тестами (создание/редактирование категорий и вопросов)
 * 3. Управление курсами (создание/редактирование курсов)
 * 4. Эскалации — запросы пользователей на живой чат
 */
import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useWebSocket } from '@/hooks/useWebSocket'
import {
  ResponsiveContainer,
  PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import HeatMap from '@/components/HeatMap'
import {
  getOverview, getConditions, getCategories, getHeatmap, getTrends,
  type OverviewStats, type ConditionItem, type CategoryStat,
  type HeatmapItem, type TrendPoint,
} from '@/api/analytics'
import {
  getCategories as getTestCategories,
  createCategory, updateCategory, deleteCategory,
  createQuestion, deleteQuestion,
  type TestCategory, type TestQuestion,
} from '@/api/tests'
import { getCourses, createCourse, updateCourse, deleteCourse, type CourseWithProgress } from '@/api/courses'
import { getAllEscalations, replyToEscalation, closeEscalation, type EscalationItem } from '@/api/ai'
import { Users, ClipboardList, TrendingUp, Activity, FileDown, BarChart2, BookOpen, Phone, Plus, Trash2, Edit3, Send, CheckCircle, Clock } from 'lucide-react'
import { generatePDFReport } from '@/lib/pdfGenerator'

const LEVEL_COLORS: Record<string, string> = {
  normal: '#22c55e', elevated_stress: '#eab308', burnout_risk: '#f97316', critical: '#ef4444',
}

type Tab = 'analytics' | 'tests' | 'courses' | 'escalations'

export default function PsychDashboard() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<Tab>('analytics')

  // ── Analytics state ───────────────────────────────────────────────────────
  const [overview, setOverview] = useState<OverviewStats | null>(null)
  const [conditions, setConditions] = useState<ConditionItem[]>([])
  const [categoriesData, setCategoriesData] = useState<CategoryStat[]>([])
  const [heatmapData, setHeatmapData] = useState<HeatmapItem[]>([])
  const [trendData, setTrendData] = useState<TrendPoint[]>([])
  const [loadingAnalytics, setLoadingAnalytics] = useState(true)

  // ── Tests state ───────────────────────────────────────────────────────────
  const [testCategories, setTestCategories] = useState<TestCategory[]>([])
  const [loadingTests, setLoadingTests] = useState(false)
  const [newCat, setNewCat] = useState({ slug: '', name_ru: '', name_kk: '', name_en: '', description_ru: '' })
  const [newQ, setNewQ] = useState({ category_id: 0, age_group: 'adult', question_ru: '', question_kk: '', question_en: '' })
  const [expandedCat, setExpandedCat] = useState<number | null>(null)

  // ── Courses state ─────────────────────────────────────────────────────────
  const [courses, setCourses] = useState<CourseWithProgress[]>([])
  const [loadingCourses, setLoadingCourses] = useState(false)
  const [newCourse, setNewCourse] = useState({ category_id: 1, title_ru: '', title_kk: '', title_en: '', description_ru: '', video_urls: '', content_ru: '' })
  const [editCourse, setEditCourse] = useState<CourseWithProgress | null>(null)

  // ── Escalations state ─────────────────────────────────────────────────────
  const [escalations, setEscalations] = useState<EscalationItem[]>([])
  const [loadingEscalations, setLoadingEscalations] = useState(false)
  const [replyTexts, setReplyTexts] = useState<Record<number, string>>({})
  const [newEscalationBadge, setNewEscalationBadge] = useState(0)

  // WebSocket — получаем уведомление когда пользователь создаёт новый запрос
  useWebSocket(
    'psychologist',
    useCallback((raw: unknown) => {
      const data = raw as { type: string }
      if (data.type !== 'new_escalation') return
      // Обновляем список если уже на вкладке эскалаций, иначе показываем бейдж
      setNewEscalationBadge((n) => n + 1)
      getAllEscalations()
        .then(setEscalations)
        .catch(() => null)
    }, []),
    true,
  )

  // Load analytics on mount
  useEffect(() => {
    Promise.all([getOverview(), getConditions(), getCategories(), getHeatmap(), getTrends(90)])
      .then(([ov, cond, cats, hm, tr]) => {
        setOverview(ov); setConditions(cond); setCategoriesData(cats)
        setHeatmapData(hm); setTrendData(tr)
      })
      .catch(console.error)
      .finally(() => setLoadingAnalytics(false))
  }, [])

  // Load tab-specific data on tab change
  useEffect(() => {
    if (activeTab === 'tests' && testCategories.length === 0) {
      setLoadingTests(true)
      getTestCategories().then(setTestCategories).catch(console.error).finally(() => setLoadingTests(false))
    }
    if (activeTab === 'courses' && courses.length === 0) {
      setLoadingCourses(true)
      getCourses().then(setCourses).catch(console.error).finally(() => setLoadingCourses(false))
    }
    if (activeTab === 'escalations') {
      setNewEscalationBadge(0)  // сбрасываем счётчик новых запросов
      setLoadingEscalations(true)
      getAllEscalations().then(setEscalations).catch(console.error).finally(() => setLoadingEscalations(false))
    }
  }, [activeTab])

  // ── Analytics helpers ─────────────────────────────────────────────────────
  const pieData = conditions.map((c) => ({
    name: t(`results.levels.${c.condition_level}`),
    value: c.count, fill: LEVEL_COLORS[c.condition_level] ?? '#94a3b8',
  }))
  const barData = categoriesData.map((c) => ({ name: t(`tests.categories.${c.slug}`), avg_score: c.avg_score }))
  const lineData = trendData.map((p) => ({ date: p.date.slice(5), avg_score: p.avg_score, test_count: p.test_count }))

  // ── Tests handlers ────────────────────────────────────────────────────────
  async function handleCreateCategory() {
    if (!newCat.slug || !newCat.name_ru) return
    try {
      const created = await createCategory({ ...newCat, name_kk: newCat.name_kk || newCat.name_ru, name_en: newCat.name_en || newCat.name_ru })
      setTestCategories((prev) => [...prev, created])
      setNewCat({ slug: '', name_ru: '', name_kk: '', name_en: '', description_ru: '' })
    } catch (e: unknown) {
      alert((e as Error).message)
    }
  }

  async function handleDeleteCategory(id: number) {
    if (!confirm(t('manage.confirm_delete'))) return
    await deleteCategory(id)
    setTestCategories((prev) => prev.filter((c) => c.id !== id))
  }

  async function handleCreateQuestion() {
    if (!newQ.category_id || !newQ.question_ru) return
    await createQuestion(newQ.category_id, {
      age_group: newQ.age_group,
      question_ru: newQ.question_ru,
      question_kk: newQ.question_kk || newQ.question_ru,
      question_en: newQ.question_en || newQ.question_ru,
    })
    // Reload categories to refresh question count
    const updated = await getTestCategories()
    setTestCategories(updated)
    setNewQ({ category_id: 0, age_group: 'adult', question_ru: '', question_kk: '', question_en: '' })
  }

  // ── Course handlers ───────────────────────────────────────────────────────
  async function handleCreateCourse() {
    if (!newCourse.title_ru) return
    const data = {
      ...newCourse,
      title_kk: newCourse.title_kk || newCourse.title_ru,
      title_en: newCourse.title_en || newCourse.title_ru,
      video_urls: newCourse.video_urls ? newCourse.video_urls.split('\n').map((u) => u.trim()).filter(Boolean) : [],
    }
    const created = await createCourse(data)
    setCourses((prev) => [...prev, created])
    setNewCourse({ category_id: 1, title_ru: '', title_kk: '', title_en: '', description_ru: '', video_urls: '', content_ru: '' })
  }

  async function handleUpdateCourse() {
    if (!editCourse) return
    const updated = await updateCourse(editCourse.id, {
      title_ru: editCourse.title_ru,
      title_kk: editCourse.title_kk,
      title_en: editCourse.title_en,
      description_ru: editCourse.description_ru,
      content_ru: editCourse.content_ru,
      video_urls: editCourse.video_urls,
    })
    setCourses((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
    setEditCourse(null)
  }

  async function handleDeleteCourse(id: number) {
    if (!confirm(t('manage.confirm_delete'))) return
    await deleteCourse(id)
    setCourses((prev) => prev.filter((c) => c.id !== id))
  }

  // ── Escalation handlers ───────────────────────────────────────────────────
  async function handleReply(id: number) {
    const reply = replyTexts[id]
    if (!reply?.trim()) return
    await replyToEscalation(id, reply)
    setEscalations((prev) => prev.map((e) => e.id === id ? { ...e, status: 'responded' as const, psychologist_reply: reply } : e))
    setReplyTexts((prev) => ({ ...prev, [id]: '' }))
  }

  async function handleClose(id: number) {
    await closeEscalation(id)
    setEscalations((prev) => prev.map((e) => e.id === id ? { ...e, status: 'closed' as const } : e))
  }

  const tabs: { key: Tab; label: string; icon: React.ElementType; badge?: number }[] = [
    { key: 'analytics', label: t('dashboard.tab_analytics'), icon: BarChart2 },
    { key: 'tests', label: t('manage.tab_tests'), icon: ClipboardList },
    { key: 'courses', label: t('manage.tab_courses'), icon: BookOpen },
    {
      key: 'escalations', label: t('manage.tab_escalations'), icon: Phone,
      badge: (escalations.filter((e) => e.status === 'pending').length + newEscalationBadge) || undefined,
    },
  ]

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Заголовок */}
      <h1 className="text-3xl font-bold mb-6">{t('dashboard.title')}</h1>

      {/* Табы */}
      <div className="flex gap-1 mb-6 bg-muted p-1 rounded-xl w-fit flex-wrap">
        {tabs.map(({ key, label, icon: Icon, badge }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === key ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
            {badge ? (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
                {badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* ── ТАБ 1: АНАЛИТИКА ─────────────────────────────────────────────── */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {loadingAnalytics ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
            </div>
          ) : overview && (
            <>
              {/* PDF кнопка */}
              <div className="flex justify-end">
                <Button variant="outline" className="gap-2" onClick={() => generatePDFReport({
                  userName: 'Analytics Report', userEmail: '', ageGroup: 'All', role: 'psychologist',
                  testResults: categoriesData.map((c) => ({
                    category: t(`tests.categories.${c.slug}`), score: c.avg_score,
                    conditionLevel: c.avg_score > 75 ? 'critical' : c.avg_score > 50 ? 'burnout_risk' : c.avg_score > 25 ? 'elevated_stress' : 'normal',
                    date: new Date().toLocaleDateString(),
                  })),
                  recommendations: [t('dashboard.export_pdf')], chartElementId: 'psych-charts',
                })}>
                  <FileDown className="w-4 h-4" />{t('dashboard.export_pdf')}
                </Button>
              </div>

              {/* Метрики */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                  { icon: Users, label: t('dashboard.users'), value: overview.total_users, color: 'text-primary' },
                  { icon: ClipboardList, label: t('dashboard.tests_taken'), value: overview.total_tests, color: 'text-primary' },
                  { icon: TrendingUp, label: t('dashboard.avg_score'), value: overview.avg_score, color: 'text-amber-600' },
                  { icon: Activity, label: t('dashboard.tests_today'), value: overview.tests_today, color: 'text-green-600' },
                  { icon: Activity, label: t('dashboard.tests_week'), value: overview.tests_this_week, color: 'text-blue-600' },
                ].map((stat, i) => (
                  <Card key={i}><CardContent className="p-4 flex flex-col items-center gap-1">
                    <stat.icon className={`w-5 h-5 ${stat.color} mb-1`} />
                    <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                    <div className="text-xs text-muted-foreground text-center">{stat.label}</div>
                  </CardContent></Card>
                ))}
              </div>

              {/* Графики */}
              <div id="psych-charts" className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card><CardHeader><CardTitle>{t('dashboard.level_distribution')}</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                        {pieData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                      </Pie><Tooltip /><Legend /></PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
                <Card><CardHeader><CardTitle>{t('dashboard.categories_overview')}</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={barData}>
                        <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis domain={[0, 100]} /><Tooltip />
                        <Bar dataKey="avg_score" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              <Card><CardHeader><CardTitle>{t('dashboard.heatmap')}</CardTitle></CardHeader>
                <CardContent><HeatMap data={heatmapData} /></CardContent>
              </Card>

              {lineData.length > 0 && (
                <Card><CardHeader><CardTitle>{t('dashboard.trend')}</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart data={lineData}>
                        <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tick={{ fontSize: 11 }} /><YAxis domain={[0, 100]} /><Tooltip />
                        <Line type="monotone" dataKey="avg_score" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} name={t('dashboard.avg_score')} />
                        <Line type="monotone" dataKey="test_count" stroke="#22c55e" strokeWidth={2} strokeDasharray="5 5" dot={false} name={t('dashboard.tests_taken')} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      )}

      {/* ── ТАБ 2: УПРАВЛЕНИЕ ТЕСТАМИ ──────────────────────────────────────── */}
      {activeTab === 'tests' && (
        <div className="space-y-6">
          {loadingTests ? (
            <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
          ) : (
            <>
              {/* Форма создания категории */}
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="w-4 h-4" />{t('manage.create_category')}</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input className="border rounded-lg px-3 py-2 text-sm" placeholder="slug (напр. burnout)" value={newCat.slug} onChange={(e) => setNewCat({ ...newCat, slug: e.target.value })} />
                    <input className="border rounded-lg px-3 py-2 text-sm" placeholder={t('manage.name_ru')} value={newCat.name_ru} onChange={(e) => setNewCat({ ...newCat, name_ru: e.target.value })} />
                    <input className="border rounded-lg px-3 py-2 text-sm" placeholder={t('manage.name_kk')} value={newCat.name_kk} onChange={(e) => setNewCat({ ...newCat, name_kk: e.target.value })} />
                    <input className="border rounded-lg px-3 py-2 text-sm" placeholder={t('manage.name_en')} value={newCat.name_en} onChange={(e) => setNewCat({ ...newCat, name_en: e.target.value })} />
                    <input className="border rounded-lg px-3 py-2 text-sm md:col-span-2" placeholder={t('manage.description')} value={newCat.description_ru} onChange={(e) => setNewCat({ ...newCat, description_ru: e.target.value })} />
                  </div>
                  <Button className="mt-3 gap-2" onClick={handleCreateCategory}><Plus className="w-4 h-4" />{t('manage.create')}</Button>
                </CardContent>
              </Card>

              {/* Список категорий */}
              <div className="space-y-3">
                {testCategories.map((cat) => (
                  <Card key={cat.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold">{cat.name_ru} <span className="text-xs text-muted-foreground">({cat.slug})</span></div>
                          <div className="text-xs text-muted-foreground mt-0.5">{cat.description_ru || '—'}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" className="gap-1 h-8" onClick={() => setExpandedCat(expandedCat === cat.id ? null : cat.id)}>
                            <Plus className="w-3 h-3" />{t('manage.add_question')}
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 text-destructive hover:text-destructive" onClick={() => handleDeleteCategory(cat.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>

                      {/* Форма добавления вопроса */}
                      {expandedCat === cat.id && (
                        <div className="mt-4 pt-4 border-t space-y-3">
                          <p className="text-sm font-medium text-muted-foreground">{t('manage.add_question_to')} «{cat.name_ru}»</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <select className="border rounded-lg px-3 py-2 text-sm bg-background" value={newQ.age_group} onChange={(e) => setNewQ({ ...newQ, age_group: e.target.value, category_id: cat.id })}>
                              <option value="adult">adult</option>
                              <option value="high">high school</option>
                              <option value="middle">middle school</option>
                              <option value="elementary">elementary</option>
                            </select>
                            <input className="border rounded-lg px-3 py-2 text-sm" placeholder={t('manage.question_ru')} value={newQ.question_ru} onChange={(e) => setNewQ({ ...newQ, question_ru: e.target.value, category_id: cat.id })} />
                            <input className="border rounded-lg px-3 py-2 text-sm" placeholder={t('manage.question_kk')} value={newQ.question_kk} onChange={(e) => setNewQ({ ...newQ, question_kk: e.target.value })} />
                            <input className="border rounded-lg px-3 py-2 text-sm" placeholder={t('manage.question_en')} value={newQ.question_en} onChange={(e) => setNewQ({ ...newQ, question_en: e.target.value })} />
                          </div>
                          <Button size="sm" className="gap-1" onClick={handleCreateQuestion}><Plus className="w-3 h-3" />{t('manage.save_question')}</Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── ТАБ 3: УПРАВЛЕНИЕ КУРСАМИ ──────────────────────────────────────── */}
      {activeTab === 'courses' && (
        <div className="space-y-6">
          {loadingCourses ? (
            <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
          ) : (
            <>
              {/* Форма создания курса */}
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="w-4 h-4" />{t('manage.create_course')}</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input type="number" className="border rounded-lg px-3 py-2 text-sm" placeholder="category_id (1-5)" min={1} max={5} value={newCourse.category_id} onChange={(e) => setNewCourse({ ...newCourse, category_id: Number(e.target.value) })} />
                    <input className="border rounded-lg px-3 py-2 text-sm" placeholder={t('manage.title_ru')} value={newCourse.title_ru} onChange={(e) => setNewCourse({ ...newCourse, title_ru: e.target.value })} />
                    <input className="border rounded-lg px-3 py-2 text-sm" placeholder={t('manage.title_kk')} value={newCourse.title_kk} onChange={(e) => setNewCourse({ ...newCourse, title_kk: e.target.value })} />
                    <input className="border rounded-lg px-3 py-2 text-sm" placeholder={t('manage.title_en')} value={newCourse.title_en} onChange={(e) => setNewCourse({ ...newCourse, title_en: e.target.value })} />
                    <textarea className="border rounded-lg px-3 py-2 text-sm md:col-span-2 h-20" placeholder={t('manage.video_urls_hint')} value={newCourse.video_urls} onChange={(e) => setNewCourse({ ...newCourse, video_urls: e.target.value })} />
                    <textarea className="border rounded-lg px-3 py-2 text-sm md:col-span-2 h-24" placeholder={t('manage.content_ru')} value={newCourse.content_ru} onChange={(e) => setNewCourse({ ...newCourse, content_ru: e.target.value })} />
                  </div>
                  <Button className="mt-3 gap-2" onClick={handleCreateCourse}><Plus className="w-4 h-4" />{t('manage.create')}</Button>
                </CardContent>
              </Card>

              {/* Список курсов */}
              <div className="space-y-3">
                {courses.map((course) => (
                  <Card key={course.id}>
                    <CardContent className="p-4">
                      {editCourse?.id === course.id ? (
                        // Форма редактирования
                        <div className="space-y-3">
                          <input className="w-full border rounded-lg px-3 py-2 text-sm" value={editCourse.title_ru} onChange={(e) => setEditCourse({ ...editCourse, title_ru: e.target.value })} placeholder={t('manage.title_ru')} />
                          <textarea className="w-full border rounded-lg px-3 py-2 text-sm h-16" value={editCourse.description_ru} onChange={(e) => setEditCourse({ ...editCourse, description_ru: e.target.value })} placeholder={t('manage.description')} />
                          <textarea className="w-full border rounded-lg px-3 py-2 text-sm h-20" value={editCourse.content_ru} onChange={(e) => setEditCourse({ ...editCourse, content_ru: e.target.value })} placeholder={t('manage.content_ru')} />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={handleUpdateCourse}>{t('manage.save')}</Button>
                            <Button size="sm" variant="outline" onClick={() => setEditCourse(null)}>{t('common.cancel')}</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold">{course.title_ru}</div>
                            <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{course.description_ru || '—'}</div>
                            <div className="text-xs text-muted-foreground mt-1">{course.video_urls.length} {t('manage.videos')}</div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => setEditCourse(course)}>
                              <Edit3 className="w-3 h-3" />{t('manage.edit')}
                            </Button>
                            <Button size="sm" variant="outline" className="h-8 text-destructive hover:text-destructive" onClick={() => handleDeleteCourse(course.id)}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── ТАБ 4: ЭСКАЛАЦИИ ────────────────────────────────────────────────── */}
      {activeTab === 'escalations' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-sm">
              {t('manage.escalations_desc')}
            </p>
            <Button variant="outline" size="sm" onClick={() => {
              setLoadingEscalations(true)
              getAllEscalations().then(setEscalations).catch(console.error).finally(() => setLoadingEscalations(false))
            }}>{t('common.refresh')}</Button>
          </div>

          {loadingEscalations ? (
            <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
          ) : escalations.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">{t('manage.no_escalations')}</CardContent></Card>
          ) : (
            escalations.map((esc) => (
              <Card key={esc.id} className={esc.status === 'pending' ? 'border-amber-200 bg-amber-50/30' : ''}>
                <CardContent className="p-4 space-y-3">
                  {/* Шапка: пользователь + статус */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-sm">{esc.user_name}</div>
                      <div className="text-xs text-muted-foreground">{esc.user_email}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {new Date(esc.created_at).toLocaleString()}
                        {esc.auto_escalated && <span className="ml-2 text-amber-600">🤖 auto</span>}
                      </div>
                    </div>
                    <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
                      esc.status === 'pending' ? 'bg-amber-100 text-amber-800'
                      : esc.status === 'responded' ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-600'
                    }`}>
                      {esc.status === 'pending' ? <Clock className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
                      {t(`manage.status_${esc.status}`)}
                    </div>
                  </div>

                  {/* Сообщение пользователя */}
                  <div className="bg-muted rounded-lg p-3 text-sm">{esc.user_message}</div>

                  {/* Ответ если уже есть */}
                  {esc.psychologist_reply && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
                      <div className="font-medium text-xs mb-1">{t('manage.your_reply')}:</div>
                      {esc.psychologist_reply}
                    </div>
                  )}

                  {/* Форма ответа — только для pending/responded */}
                  {esc.status !== 'closed' && (
                    <div className="flex gap-2">
                      <input
                        className="flex-1 border rounded-lg px-3 py-2 text-sm bg-background"
                        placeholder={t('manage.write_reply')}
                        value={replyTexts[esc.id] ?? ''}
                        onChange={(e) => setReplyTexts((prev) => ({ ...prev, [esc.id]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleReply(esc.id) }}
                      />
                      <Button size="sm" className="gap-1 h-10" onClick={() => handleReply(esc.id)}>
                        <Send className="w-3 h-3" />{t('manage.reply')}
                      </Button>
                      <Button size="sm" variant="outline" className="h-10" onClick={() => handleClose(esc.id)}>
                        {t('manage.close')}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  )
}
