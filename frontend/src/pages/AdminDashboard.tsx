/**
 * Панель администратора — 4 таба:
 * 1. Аналитика (метрики, PieChart, таблица результатов)
 * 2. Пользователи (список, назначение ролей, активация/деактивация)
 * 3. Тесты (управление категориями и вопросами — те же возможности что у психолога)
 * 4. Курсы (управление курсами — те же возможности что у психолога)
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  getOverview, getConditions, getRecentResults,
  type OverviewStats, type ConditionItem, type RecentResult,
} from '@/api/analytics'
import { getUsers, updateUserRole, toggleUserActive, type AdminUser } from '@/api/admin'
import {
  getCategories as getTestCategories, createCategory, deleteCategory,
  createQuestion, type TestCategory,
} from '@/api/tests'
import { getCourses, createCourse, updateCourse, deleteCourse, type CourseWithProgress } from '@/api/courses'
import { Users, ClipboardList, TrendingUp, Activity, BarChart2, BookOpen, ShieldCheck, Plus, Trash2, Edit3, UserCheck, UserX } from 'lucide-react'

const LEVEL_COLORS: Record<string, string> = {
  normal: '#22c55e', elevated_stress: '#eab308', burnout_risk: '#f97316', critical: '#ef4444',
}
const LEVEL_BADGE: Record<string, string> = {
  normal: 'bg-green-100 text-green-800', elevated_stress: 'bg-yellow-100 text-yellow-800',
  burnout_risk: 'bg-orange-100 text-orange-800', critical: 'bg-red-100 text-red-800',
}
const ROLE_BADGE: Record<string, string> = {
  user: 'bg-gray-100 text-gray-700', psychologist: 'bg-blue-100 text-blue-700', admin: 'bg-purple-100 text-purple-700',
}

type Tab = 'analytics' | 'users' | 'tests' | 'courses'

export default function AdminDashboard() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<Tab>('analytics')

  // ── Analytics ─────────────────────────────────────────────────────────────
  const [overview, setOverview] = useState<OverviewStats | null>(null)
  const [conditions, setConditions] = useState<ConditionItem[]>([])
  const [recent, setRecent] = useState<RecentResult[]>([])
  const [loadingAnalytics, setLoadingAnalytics] = useState(true)

  // ── Users ─────────────────────────────────────────────────────────────────
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [searchUsers, setSearchUsers] = useState('')
  const [roleFilter, setRoleFilter] = useState('')

  // ── Tests ─────────────────────────────────────────────────────────────────
  const [testCategories, setTestCategories] = useState<TestCategory[]>([])
  const [loadingTests, setLoadingTests] = useState(false)
  const [newCat, setNewCat] = useState({ slug: '', name_ru: '', name_kk: '', name_en: '', description_ru: '' })
  const [newQ, setNewQ] = useState({ category_id: 0, age_group: 'adult', question_ru: '', question_kk: '', question_en: '' })
  const [expandedCat, setExpandedCat] = useState<number | null>(null)

  // ── Courses ───────────────────────────────────────────────────────────────
  const [courses, setCourses] = useState<CourseWithProgress[]>([])
  const [loadingCourses, setLoadingCourses] = useState(false)
  const [newCourse, setNewCourse] = useState({ category_id: 1, title_ru: '', title_kk: '', title_en: '', description_ru: '', video_urls: '', content_ru: '' })
  const [editCourse, setEditCourse] = useState<CourseWithProgress | null>(null)

  useEffect(() => {
    Promise.all([getOverview(), getConditions(), getRecentResults(20)])
      .then(([ov, cond, rec]) => { setOverview(ov); setConditions(cond); setRecent(rec) })
      .catch(console.error)
      .finally(() => setLoadingAnalytics(false))
  }, [])

  useEffect(() => {
    if (activeTab === 'users' && users.length === 0) {
      setLoadingUsers(true)
      getUsers().then(setUsers).catch(console.error).finally(() => setLoadingUsers(false))
    }
    if (activeTab === 'tests' && testCategories.length === 0) {
      setLoadingTests(true)
      getTestCategories().then(setTestCategories).catch(console.error).finally(() => setLoadingTests(false))
    }
    if (activeTab === 'courses' && courses.length === 0) {
      setLoadingCourses(true)
      getCourses().then(setCourses).catch(console.error).finally(() => setLoadingCourses(false))
    }
  }, [activeTab])

  // Search/filter users
  const filteredUsers = users.filter((u) => {
    const q = searchUsers.toLowerCase()
    const matchSearch = !q || u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    const matchRole = !roleFilter || u.role === roleFilter
    return matchSearch && matchRole
  })

  // ── User handlers ─────────────────────────────────────────────────────────
  async function handleRoleChange(id: number, role: 'user' | 'psychologist' | 'admin') {
    const updated = await updateUserRole(id, role)
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? { ...u, role: updated.role as AdminUser['role'] } : u)))
  }

  async function handleToggleActive(id: number) {
    const updated = await toggleUserActive(id)
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? { ...u, is_active: updated.is_active } : u)))
  }

  // ── Tests handlers ────────────────────────────────────────────────────────
  async function handleCreateCategory() {
    if (!newCat.slug || !newCat.name_ru) return
    const created = await createCategory({ ...newCat, name_kk: newCat.name_kk || newCat.name_ru, name_en: newCat.name_en || newCat.name_ru })
    setTestCategories((prev) => [...prev, created])
    setNewCat({ slug: '', name_ru: '', name_kk: '', name_en: '', description_ru: '' })
  }

  async function handleDeleteCategory(id: number) {
    if (!confirm(t('manage.confirm_delete'))) return
    await deleteCategory(id)
    setTestCategories((prev) => prev.filter((c) => c.id !== id))
  }

  async function handleCreateQuestion() {
    if (!newQ.category_id || !newQ.question_ru) return
    await createQuestion(newQ.category_id, {
      age_group: newQ.age_group, question_ru: newQ.question_ru,
      question_kk: newQ.question_kk || newQ.question_ru, question_en: newQ.question_en || newQ.question_ru,
    })
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
      title_ru: editCourse.title_ru, title_kk: editCourse.title_kk,
      title_en: editCourse.title_en, description_ru: editCourse.description_ru,
      content_ru: editCourse.content_ru, video_urls: editCourse.video_urls,
    })
    setCourses((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
    setEditCourse(null)
  }

  async function handleDeleteCourse(id: number) {
    if (!confirm(t('manage.confirm_delete'))) return
    await deleteCourse(id)
    setCourses((prev) => prev.filter((c) => c.id !== id))
  }

  const pieData = conditions.map((c) => ({
    name: t(`results.levels.${c.condition_level}`),
    value: c.count, fill: LEVEL_COLORS[c.condition_level] ?? '#94a3b8',
  }))

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'analytics', label: t('dashboard.tab_analytics'), icon: BarChart2 },
    { key: 'users', label: t('admin.tab_users'), icon: Users },
    { key: 'tests', label: t('manage.tab_tests'), icon: ClipboardList },
    { key: 'courses', label: t('manage.tab_courses'), icon: BookOpen },
  ]

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">{t('admin.title')}</h1>

      {/* Табы */}
      <div className="flex gap-1 mb-6 bg-muted p-1 rounded-xl w-fit flex-wrap">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === key ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {/* ── ТАБ 1: АНАЛИТИКА ─────────────────────────────────────────────── */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {loadingAnalytics ? (
            <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" /></div>
          ) : overview && (
            <>
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  <CardContent className="space-y-3">
                    {conditions.map((c) => (
                      <div key={c.condition_level} className="flex items-center justify-between p-3 rounded-lg bg-secondary">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: LEVEL_COLORS[c.condition_level] }} />
                          <span className="font-medium">{t(`results.levels.${c.condition_level}`)}</span>
                        </div>
                        <span className="font-bold text-primary">{c.count}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              <Card><CardHeader><CardTitle>{t('admin.recent_results')}</CardTitle></CardHeader>
                <CardContent><div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-border">
                      <th className="text-left p-3 font-medium text-muted-foreground">{t('admin.user')}</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">{t('dashboard.category')}</th>
                      <th className="text-center p-3 font-medium text-muted-foreground">{t('admin.score')}</th>
                      <th className="text-center p-3 font-medium text-muted-foreground">{t('results.condition_level')}</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">{t('admin.date')}</th>
                    </tr></thead>
                    <tbody>
                      {recent.map((r) => (
                        <tr key={r.id} className="border-b border-border hover:bg-secondary/50">
                          <td className="p-3"><div className="font-medium">{r.user_name}</div><div className="text-xs text-muted-foreground">{r.user_email}</div></td>
                          <td className="p-3">{t(`tests.categories.${r.category_slug}`)}</td>
                          <td className="p-3 text-center font-mono font-bold">{r.raw_score}</td>
                          <td className="p-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${LEVEL_BADGE[r.condition_level] ?? 'bg-gray-100 text-gray-800'}`}>
                              {t(`results.levels.${r.condition_level}`)}
                            </span>
                          </td>
                          <td className="p-3 text-right text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div></CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* ── ТАБ 2: ПОЛЬЗОВАТЕЛИ ──────────────────────────────────────────── */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Поиск и фильтр */}
          <div className="flex gap-3 flex-wrap">
            <input
              className="border rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px] bg-background"
              placeholder={t('admin.search_users')}
              value={searchUsers}
              onChange={(e) => setSearchUsers(e.target.value)}
            />
            <select
              className="border rounded-lg px-3 py-2 text-sm bg-background"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="">{t('admin.all_roles')}</option>
              <option value="user">user</option>
              <option value="psychologist">psychologist</option>
              <option value="admin">admin</option>
            </select>
            <Button variant="outline" size="sm" onClick={() => {
              setLoadingUsers(true)
              getUsers().then(setUsers).catch(console.error).finally(() => setLoadingUsers(false))
            }}>{t('common.refresh')}</Button>
          </div>

          <div className="text-sm text-muted-foreground">{t('admin.showing')} {filteredUsers.length} / {users.length}</div>

          {loadingUsers ? (
            <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
          ) : (
            <div className="space-y-2">
              {filteredUsers.map((user) => (
                <Card key={user.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Аватар */}
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-bold text-primary">{user.full_name[0]}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium flex items-center gap-2 flex-wrap">
                            {user.full_name}
                            <span className={`text-xs px-2 py-0.5 rounded-full ${ROLE_BADGE[user.role]}`}>{user.role}</span>
                            {!user.is_active && <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">{t('admin.inactive')}</span>}
                          </div>
                          <div className="text-xs text-muted-foreground">{user.email} · {user.test_count} {t('admin.tests')}</div>
                        </div>
                      </div>

                      {/* Действия */}
                      <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
                        {/* Выбор роли */}
                        <select
                          className="border rounded-lg px-2 py-1.5 text-xs bg-background"
                          value={user.role}
                          onChange={(e) => handleRoleChange(user.id, e.target.value as AdminUser['role'])}
                        >
                          <option value="user">user</option>
                          <option value="psychologist">psychologist</option>
                          <option value="admin">admin</option>
                        </select>

                        {/* Активировать/деактивировать */}
                        <Button
                          size="sm"
                          variant="outline"
                          className={`h-8 gap-1 text-xs ${user.is_active ? 'text-red-600 hover:text-red-700' : 'text-green-600 hover:text-green-700'}`}
                          onClick={() => handleToggleActive(user.id)}
                        >
                          {user.is_active ? <><UserX className="w-3 h-3" />{t('admin.deactivate')}</> : <><UserCheck className="w-3 h-3" />{t('admin.activate')}</>}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ТАБ 3: ТЕСТЫ ─────────────────────────────────────────────────── */}
      {activeTab === 'tests' && (
        <div className="space-y-6">
          {loadingTests ? (
            <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
          ) : (
            <>
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="w-4 h-4" />{t('manage.create_category')}</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input className="border rounded-lg px-3 py-2 text-sm" placeholder="slug" value={newCat.slug} onChange={(e) => setNewCat({ ...newCat, slug: e.target.value })} />
                    <input className="border rounded-lg px-3 py-2 text-sm" placeholder={t('manage.name_ru')} value={newCat.name_ru} onChange={(e) => setNewCat({ ...newCat, name_ru: e.target.value })} />
                    <input className="border rounded-lg px-3 py-2 text-sm" placeholder={t('manage.name_kk')} value={newCat.name_kk} onChange={(e) => setNewCat({ ...newCat, name_kk: e.target.value })} />
                    <input className="border rounded-lg px-3 py-2 text-sm" placeholder={t('manage.name_en')} value={newCat.name_en} onChange={(e) => setNewCat({ ...newCat, name_en: e.target.value })} />
                  </div>
                  <Button className="mt-3 gap-2" onClick={handleCreateCategory}><Plus className="w-4 h-4" />{t('manage.create')}</Button>
                </CardContent>
              </Card>
              <div className="space-y-3">
                {testCategories.map((cat) => (
                  <Card key={cat.id}><CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold">{cat.name_ru} <span className="text-xs text-muted-foreground">({cat.slug})</span></div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => setExpandedCat(expandedCat === cat.id ? null : cat.id)}>
                          <Plus className="w-3 h-3" />{t('manage.add_question')}
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 text-destructive" onClick={() => handleDeleteCategory(cat.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    {expandedCat === cat.id && (
                      <div className="mt-4 pt-4 border-t space-y-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <select className="border rounded-lg px-3 py-2 text-sm bg-background" value={newQ.age_group} onChange={(e) => setNewQ({ ...newQ, age_group: e.target.value, category_id: cat.id })}>
                            <option value="adult">adult</option><option value="high">high</option><option value="middle">middle</option><option value="elementary">elementary</option>
                          </select>
                          <input className="border rounded-lg px-3 py-2 text-sm" placeholder={t('manage.question_ru')} value={newQ.question_ru} onChange={(e) => setNewQ({ ...newQ, question_ru: e.target.value, category_id: cat.id })} />
                        </div>
                        <Button size="sm" className="gap-1" onClick={handleCreateQuestion}><Plus className="w-3 h-3" />{t('manage.save_question')}</Button>
                      </div>
                    )}
                  </CardContent></Card>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── ТАБ 4: КУРСЫ ─────────────────────────────────────────────────── */}
      {activeTab === 'courses' && (
        <div className="space-y-6">
          {loadingCourses ? (
            <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
          ) : (
            <>
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="w-4 h-4" />{t('manage.create_course')}</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input type="number" min={1} max={10} className="border rounded-lg px-3 py-2 text-sm" placeholder="category_id" value={newCourse.category_id} onChange={(e) => setNewCourse({ ...newCourse, category_id: Number(e.target.value) })} />
                    <input className="border rounded-lg px-3 py-2 text-sm" placeholder={t('manage.title_ru')} value={newCourse.title_ru} onChange={(e) => setNewCourse({ ...newCourse, title_ru: e.target.value })} />
                    <textarea className="border rounded-lg px-3 py-2 text-sm md:col-span-2 h-16" placeholder={t('manage.video_urls_hint')} value={newCourse.video_urls} onChange={(e) => setNewCourse({ ...newCourse, video_urls: e.target.value })} />
                    <textarea className="border rounded-lg px-3 py-2 text-sm md:col-span-2 h-20" placeholder={t('manage.content_ru')} value={newCourse.content_ru} onChange={(e) => setNewCourse({ ...newCourse, content_ru: e.target.value })} />
                  </div>
                  <Button className="mt-3 gap-2" onClick={handleCreateCourse}><Plus className="w-4 h-4" />{t('manage.create')}</Button>
                </CardContent>
              </Card>
              <div className="space-y-3">
                {courses.map((course) => (
                  <Card key={course.id}><CardContent className="p-4">
                    {editCourse?.id === course.id ? (
                      <div className="space-y-3">
                        <input className="w-full border rounded-lg px-3 py-2 text-sm" value={editCourse.title_ru} onChange={(e) => setEditCourse({ ...editCourse, title_ru: e.target.value })} />
                        <textarea className="w-full border rounded-lg px-3 py-2 text-sm h-16" value={editCourse.description_ru} onChange={(e) => setEditCourse({ ...editCourse, description_ru: e.target.value })} />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleUpdateCourse}>{t('manage.save')}</Button>
                          <Button size="sm" variant="outline" onClick={() => setEditCourse(null)}>{t('common.cancel')}</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="font-semibold">{course.title_ru}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{course.video_urls.length} {t('manage.videos')}</div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => setEditCourse(course)}><Edit3 className="w-3 h-3" />{t('manage.edit')}</Button>
                          <Button size="sm" variant="outline" className="h-8 text-destructive" onClick={() => handleDeleteCourse(course.id)}><Trash2 className="w-3 h-3" /></Button>
                        </div>
                      </div>
                    )}
                  </CardContent></Card>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
