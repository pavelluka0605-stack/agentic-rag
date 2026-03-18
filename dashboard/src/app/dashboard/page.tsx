'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  Lightbulb,
  History,
  GitBranch,
  Search,
  ShieldCheck,
  Inbox,
  Activity,
  Play,
  CircleDot,
  Zap,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Eye,
  ListTodo,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loading } from '@/components/ui/loading'
import { EmptyState } from '@/components/ui/empty-state'
import { StatusDot } from '@/components/ui/status-dot'
import { timeAgo, truncate, parseJsonField } from '@/lib/utils'
import type { MemoryStats, Episode, Incident, GithubEvent, Task, TaskProgress, TaskPhase } from '@/types'

const taskStatusLabel: Record<string, string> = {
  draft: 'Анализ...',
  pending: 'Ожидает выбора',
  confirmed: 'Готова к запуску',
  running: 'Выполняется',
  review: 'На проверке',
  needs_manual_review: 'Ручная проверка',
  done: 'Готово',
  failed: 'Ошибка',
  cancelled: 'Отменена',
}

const taskStatusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'info'> = {
  draft: 'secondary',
  pending: 'warning',
  confirmed: 'info',
  running: 'default',
  review: 'warning',
  needs_manual_review: 'warning',
  done: 'success',
  failed: 'destructive',
  cancelled: 'secondary',
}

const eventVariant = (type: string) => {
  if (type.includes('pull_request')) return 'success' as const
  if (type.includes('push')) return 'default' as const
  if (type.includes('issues')) return 'warning' as const
  if (type.includes('workflow')) return 'secondary' as const
  return 'outline' as const
}

interface TaskStats {
  total: number
  draft: number
  pending: number
  confirmed?: number
  running: number
  review?: number
  needs_manual_review?: number
  done: number
  failed: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<MemoryStats | null>(null)
  const [taskStats, setTaskStats] = useState<TaskStats | null>(null)
  const [recentTasks, setRecentTasks] = useState<Task[] | null>(null)
  const [episodes, setEpisodes] = useState<Episode[] | null>(null)
  const [incidents, setIncidents] = useState<Incident[] | null>(null)
  const [events, setEvents] = useState<GithubEvent[] | null>(null)
  const [healthStatus, setHealthStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const [statsRes, taskStatsRes, tasksRes, episodesRes, incidentsRes, eventsRes, healthRes] =
          await Promise.allSettled([
            fetch('/api/memory/stats'),
            fetch('/api/tasks?stats=true'),
            fetch('/api/tasks?limit=15'),
            fetch('/api/sessions?limit=5'),
            fetch('/api/incidents?status=open&limit=5'),
            fetch('/api/github/events?limit=10'),
            fetch('/api/health'),
          ])

        if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
          setStats(await statsRes.value.json())
        }
        if (taskStatsRes.status === 'fulfilled' && taskStatsRes.value.ok) {
          setTaskStats(await taskStatsRes.value.json())
        }
        if (tasksRes.status === 'fulfilled' && tasksRes.value.ok) {
          setRecentTasks(await tasksRes.value.json())
        }
        if (episodesRes.status === 'fulfilled' && episodesRes.value.ok) {
          setEpisodes(await episodesRes.value.json())
        }
        if (incidentsRes.status === 'fulfilled' && incidentsRes.value.ok) {
          setIncidents(await incidentsRes.value.json())
        }
        if (eventsRes.status === 'fulfilled' && eventsRes.value.ok) {
          setEvents(await eventsRes.value.json())
        }
        if (healthRes.status === 'fulfilled' && healthRes.value.ok) {
          const h = await healthRes.value.json()
          setHealthStatus(h.status)
        }
      } catch {
        // silently handle network errors
      } finally {
        setLoading(false)
      }
    }
    fetchData()
    // Re-fetch every 10s
    const interval = setInterval(fetchData, 10000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loading size="lg" />
      </div>
    )
  }

  const hasMemoryData = stats && (
    (stats.open_incidents ?? 0) > 0 ||
    (stats.verified_solutions ?? 0) > 0 ||
    (stats.episodes ?? 0) > 0 ||
    (stats.github_events ?? 0) > 0
  )
  const hasEpisodes = episodes && episodes.length > 0
  const hasIncidents = incidents && incidents.length > 0
  const hasEvents = events && events.length > 0

  // Derive task counts
  const runningCount = (taskStats?.running ?? 0) + (taskStats?.confirmed ?? 0)
  const awaitingCount = taskStats?.pending ?? 0
  const reviewCount = (taskStats?.review ?? 0) + (taskStats?.needs_manual_review ?? 0)
  const doneCount = taskStats?.done ?? 0
  const failedCount = taskStats?.failed ?? 0
  const totalTasks = taskStats?.total ?? 0

  // Split tasks by category
  const activeTasks = recentTasks?.filter(t => ['running', 'confirmed'].includes(t.status)) ?? []
  const pendingTasks = recentTasks?.filter(t => t.status === 'pending') ?? []
  const reviewTasks = recentTasks?.filter(t => ['review', 'needs_manual_review'].includes(t.status)) ?? []
  const completedTasks = recentTasks?.filter(t => t.status === 'done').slice(0, 5) ?? []
  const failedTasks = recentTasks?.filter(t => ['failed', 'cancelled'].includes(t.status)).slice(0, 3) ?? []

  return (
    <div className="space-y-8">
      <PageHeader
        title="Панель управления"
        description={totalTasks > 0
          ? `${totalTasks} задач в системе · последнее обновление ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
          : 'Обзор задач и активности системы'
        }
      />

      {/* ── Task Stat Cards ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 animate-fade-in">
        <StatCard
          title="Выполняются"
          value={runningCount}
          icon={Play}
          className={runningCount > 0 ? 'border-primary/50 bg-primary/5' : undefined}
          description={runningCount > 0 ? 'Активные задачи' : 'Нет активных'}
        />
        <StatCard
          title="Ожидают решения"
          value={awaitingCount}
          icon={Clock}
          className={awaitingCount > 0 ? 'border-warning/50 bg-warning/5' : undefined}
          description={awaitingCount > 0 ? 'Нужен выбор стратегии' : 'Очередь пуста'}
        />
        <StatCard
          title="На проверке"
          value={reviewCount}
          icon={Eye}
          className={reviewCount > 0 ? 'border-warning/50 bg-warning/5' : undefined}
          description={reviewCount > 0 ? 'Требует внимания' : 'Нет задач'}
        />
        <StatCard
          title="Выполнено"
          value={doneCount}
          icon={CheckCircle2}
          className="border-success/50 bg-success/5"
          description="Завершённых задач"
        />
        <StatCard
          title="Ошибки"
          value={failedCount}
          icon={XCircle}
          className={failedCount > 0 ? 'border-destructive/50 bg-destructive/5' : undefined}
          description={failedCount > 0 ? 'Требует разбора' : 'Всё чисто'}
        />
      </div>

      {/* ── Quick actions ── */}
      <div className="flex flex-wrap gap-2 rounded-xl border border-border-subtle bg-card p-3">
        <Link href="/tasks">
          <Button variant="outline" size="sm">
            <ListTodo className="h-4 w-4" />
            Все задачи
          </Button>
        </Link>
        <Link href="/memory">
          <Button variant="outline" size="sm">
            <Search className="h-4 w-4" />
            Поиск по памяти
          </Button>
        </Link>
        <Link href="/incidents">
          <Button variant="outline" size="sm">
            <AlertTriangle className="h-4 w-4" />
            Инциденты
          </Button>
        </Link>
        <Link href="/health">
          <Button variant="outline" size="sm">
            <ShieldCheck className="h-4 w-4" />
            Здоровье
            {healthStatus && (
              <StatusDot status={healthStatus === 'healthy' ? 'healthy' : healthStatus === 'degraded' ? 'degraded' : 'down'} />
            )}
          </Button>
        </Link>
      </div>

      {/* ── Active / Running Tasks ── */}
      {activeTasks.length > 0 && (
        <Card className="border-primary/20 bg-primary/[0.03] animate-fade-in">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Выполняются сейчас
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activeTasks.map((task) => {
                const progress = parseJsonField<TaskProgress[]>(task.progress)
                const phases = parseJsonField<TaskPhase[]>(task.execution_phases)
                const activePhase = phases?.find(p => p.status === 'active')
                const lastProgress = progress?.[progress.length - 1]
                const pct = lastProgress?.pct
                return (
                  <Link key={task.id} href={`/tasks?id=${task.id}`}>
                    <div className="rounded-lg border border-border-subtle p-3 transition-colors hover:bg-[oklch(0.195_0.008_260)] cursor-pointer">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium leading-snug">
                            {truncate(task.raw_input, 120)}
                          </p>
                          {activePhase && (
                            <p className="mt-1 text-xs text-primary">
                              Фаза: {activePhase.name_ru}
                            </p>
                          )}
                          {lastProgress && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {truncate(lastProgress.message_ru, 100)}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {pct != null && (
                            <span className="text-xs font-medium text-primary">{pct}%</span>
                          )}
                          <span className="text-xs text-muted-foreground">{timeAgo(task.updated_at)}</span>
                        </div>
                      </div>
                      {pct != null && (
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-primary/10">
                          <div
                            className="h-full rounded-full bg-primary transition-all duration-500"
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Awaiting Confirmation + Review ── */}
      {(pendingTasks.length > 0 || reviewTasks.length > 0) && (
        <Card className="border-warning/20 animate-fade-in">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-warning" />
              Требуют внимания
              <Badge variant="warning">{pendingTasks.length + reviewTasks.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[...pendingTasks, ...reviewTasks].map((task) => (
                <Link key={task.id} href={`/tasks?id=${task.id}`}>
                  <div className="flex items-start justify-between gap-3 rounded-lg border border-border-subtle p-3 transition-colors hover:bg-[oklch(0.195_0.008_260)] cursor-pointer">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-snug">
                        {truncate(task.raw_input, 120)}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <Badge variant={taskStatusVariant[task.status] ?? 'secondary'}>
                          {taskStatusLabel[task.status] ?? task.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{timeAgo(task.created_at)}</span>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Two-column: Recent Completed + Failed/Blocked ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recently Completed */}
        <Card className="animate-fade-in">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="h-4 w-4 text-success" />
                Недавно завершённые
              </CardTitle>
              <Link href="/tasks" className="text-xs text-primary hover:underline">Все задачи</Link>
            </div>
          </CardHeader>
          <CardContent>
            {completedTasks.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="Завершённых задач пока нет"
                description="Здесь появятся выполненные задачи"
              />
            ) : (
              <div className="space-y-3">
                {completedTasks.map((task) => (
                  <Link key={task.id} href={`/tasks?id=${task.id}`}>
                    <div className="flex items-start justify-between gap-3 rounded-lg border border-border-subtle p-3 transition-colors hover:bg-[oklch(0.195_0.008_260)] cursor-pointer">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-snug">
                          {task.result_summary_ru
                            ? truncate(task.result_summary_ru, 100)
                            : truncate(task.raw_input, 100)}
                        </p>
                        <span className="mt-1 text-xs text-muted-foreground">{timeAgo(task.updated_at)}</span>
                      </div>
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Failed / Blocked */}
        <Card className="animate-fade-in">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <XCircle className="h-4 w-4 text-destructive" />
                Ошибки и блокировки
              </CardTitle>
              {failedCount > 0 && (
                <Link href="/tasks" className="text-xs text-primary hover:underline">Все</Link>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {failedTasks.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="Нет ошибок"
                description="Все задачи выполняются без проблем"
              />
            ) : (
              <div className="space-y-3">
                {failedTasks.map((task) => (
                  <Link key={task.id} href={`/tasks?id=${task.id}`}>
                    <div className="flex items-start justify-between gap-3 rounded-lg border border-border-subtle p-3 transition-colors hover:bg-[oklch(0.195_0.008_260)] cursor-pointer">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-snug">
                          {truncate(task.raw_input, 100)}
                        </p>
                        {task.error && (
                          <p className="mt-1 text-xs text-destructive">{truncate(task.error, 80)}</p>
                        )}
                        <span className="mt-1 text-xs text-muted-foreground">{timeAgo(task.updated_at)}</span>
                      </div>
                      <Badge variant="destructive">{taskStatusLabel[task.status] ?? task.status}</Badge>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Latest Task Activity Feed ── */}
      {recentTasks && recentTasks.length > 0 && (
        <Card className="animate-fade-in">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4 text-muted-foreground" />
                Лента активности задач
              </CardTitle>
              <Link href="/tasks" className="text-xs text-primary hover:underline">Все задачи</Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {recentTasks.slice(0, 10).map((task) => (
                <Link key={task.id} href={`/tasks?id=${task.id}`}>
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border-subtle px-3 py-2.5 transition-colors hover:bg-[oklch(0.195_0.008_260)] sm:flex-nowrap sm:gap-4 sm:px-4 cursor-pointer">
                    <Badge variant={taskStatusVariant[task.status] ?? 'secondary'}>
                      {taskStatusLabel[task.status] ?? task.status}
                    </Badge>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                      {truncate(task.raw_input, 80)}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {timeAgo(task.updated_at)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Memory System (de-emphasized, shown only if data exists) ── */}
      {hasMemoryData && (
        <>
          <div className="mt-4 border-t border-border-subtle pt-6">
            <h2 className="mb-4 text-sm font-medium uppercase tracking-wider text-muted-foreground">
              Система памяти
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatCard
                title="Инциденты"
                value={stats?.open_incidents ?? 0}
                icon={AlertTriangle}
                description="Открытые"
              />
              <StatCard
                title="Решения"
                value={stats?.verified_solutions ?? 0}
                icon={Lightbulb}
                description="Проверенные"
              />
              <StatCard
                title="Сессии"
                value={stats?.episodes ?? 0}
                icon={History}
                description="Всего"
              />
              <StatCard
                title="GitHub"
                value={stats?.github_events ?? 0}
                icon={GitBranch}
                description="Событий"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Recent Sessions */}
            {hasEpisodes && (
              <Card className="animate-fade-in">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <History className="h-4 w-4 text-muted-foreground" />
                      Последние сессии
                    </CardTitle>
                    <Link href="/sessions" className="text-xs text-primary hover:underline">Все</Link>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {episodes!.map((ep) => {
                      const loops = parseJsonField<string[]>(ep.open_loops)
                      return (
                        <Link key={ep.id} href={`/sessions/${ep.id}`}>
                          <div className="flex items-start justify-between gap-3 rounded-lg border border-border-subtle p-3 transition-colors hover:bg-[oklch(0.195_0.008_260)] cursor-pointer">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium leading-snug">
                                {truncate(ep.summary, 120)}
                              </p>
                              <div className="mt-1.5 flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">
                                  {timeAgo(ep.created_at)}
                                </span>
                                {ep.project && (
                                  <Badge variant="secondary">{ep.project}</Badge>
                                )}
                                {loops && loops.length > 0 && (
                                  <span className="inline-flex items-center gap-1 text-xs text-warning">
                                    <CircleDot className="h-3 w-3" />
                                    {loops.length}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Open Incidents */}
            {hasIncidents && (
              <Card className="animate-fade-in">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                      Открытые инциденты
                    </CardTitle>
                    <Link href="/incidents" className="text-xs text-primary hover:underline">Все</Link>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {incidents!.map((inc) => (
                      <Link key={inc.id} href={`/incidents/${inc.id}`}>
                        <div className="flex items-start justify-between gap-3 rounded-lg border border-border-subtle p-3 transition-colors hover:bg-[oklch(0.195_0.008_260)] cursor-pointer">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <StatusDot status={inc.status as 'open'} />
                              <p className="text-sm font-medium leading-snug">
                                {truncate(inc.error_message, 100)}
                              </p>
                            </div>
                            <div className="mt-1.5 flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">
                                {timeAgo(inc.created_at)}
                              </span>
                              <Badge variant={inc.status === 'open' ? 'destructive' : 'warning'}>
                                {inc.status}
                              </Badge>
                              {inc.occurrence_count > 1 && (
                                <span className="text-xs text-muted-foreground">
                                  x{inc.occurrence_count}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* GitHub Activity */}
          {hasEvents && (
            <Card className="animate-fade-in">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                    Активность GitHub
                  </CardTitle>
                  <Link href="/github" className="text-xs text-primary hover:underline">Все</Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {events!.map((ev) => (
                    <div
                      key={ev.id}
                      className="flex flex-wrap items-center gap-2 rounded-lg border border-border-subtle px-3 py-2.5 transition-colors hover:bg-[oklch(0.195_0.008_260)] sm:flex-nowrap sm:gap-4 sm:px-4"
                    >
                      <Badge variant={eventVariant(ev.event_type)}>
                        {ev.event_type}
                        {ev.action ? `:${ev.action}` : ''}
                      </Badge>
                      <span className="shrink-0 text-sm font-medium text-foreground">
                        {ev.repo}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                        {ev.payload_summary
                          ? truncate(ev.payload_summary, 80)
                          : '—'}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {timeAgo(ev.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
