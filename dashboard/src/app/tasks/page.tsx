'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Send,
  Mic,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Zap,
  Shield,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  ListTodo,
  Clock,
  Play,
  MessageSquare,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loading } from '@/components/ui/loading'
import { EmptyState } from '@/components/ui/empty-state'
import { timeAgo, parseJsonField, truncate } from '@/lib/utils'
import {
  fetchTasks,
  createTask,
  taskAction,
} from '@/lib/api-client'
import type {
  Task,
  TaskInterpretation,
  TaskProgress,
  TaskStatus,
} from '@/types'

// ── Status helpers ─────────────────────────────────────────────

const statusConfig: Record<TaskStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'info' }> = {
  draft: { label: 'Черновик', variant: 'secondary' },
  pending: { label: 'Ожидает подтверждения', variant: 'warning' },
  confirmed: { label: 'Подтверждена', variant: 'info' },
  running: { label: 'Выполняется', variant: 'default' },
  done: { label: 'Выполнена', variant: 'success' },
  failed: { label: 'Ошибка', variant: 'destructive' },
  cancelled: { label: 'Отменена', variant: 'secondary' },
}

const riskColors: Record<string, string> = {
  low: 'text-success',
  medium: 'text-warning',
  high: 'text-destructive',
}

// ── Main Component ──────────────────────────────────────────────

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // New task form
  const [inputText, setInputText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Active task (expanded)
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [revisionText, setRevisionText] = useState('')

  const loadTasks = useCallback(async () => {
    try {
      const data = await fetchTasks({ limit: 30 })
      setTasks(data)
      setError(null)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTasks()
    // Poll every 5s for running tasks
    const interval = setInterval(loadTasks, 5000)
    return () => clearInterval(interval)
  }, [loadTasks])

  // ── Submit new task ──────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!inputText.trim() || submitting) return

    setSubmitting(true)
    try {
      const task = await createTask({ raw_input: inputText.trim() })
      setInputText('')
      setActiveTaskId(task.id)
      // Auto-interpret
      await taskAction(task.id, 'interpret')
      await loadTasks()
    } catch (e) {
      setError(`Ошибка создания: ${e}`)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Task actions ────────────────────────────────────

  async function handleAction(taskId: number, action: string, data?: Record<string, unknown>) {
    setActionLoading(`${taskId}-${action}`)
    try {
      await taskAction(taskId, action, data)
      await loadTasks()
    } catch (e) {
      setError(`Ошибка: ${e}`)
    } finally {
      setActionLoading(null)
    }
  }

  async function handleRevise(taskId: number) {
    if (!revisionText.trim()) return
    await handleAction(taskId, 'revise', { text: revisionText.trim() })
    setRevisionText('')
    // Re-interpret after revision
    await handleAction(taskId, 'interpret')
  }

  // ── Render ──────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loading size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Задачи"
        description="Приём, подтверждение и выполнение задач"
      />

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Скрыть</button>
        </div>
      )}

      {/* New task input */}
      <Card>
        <CardContent className="pt-5">
          <form onSubmit={handleSubmit} className="flex gap-3">
            <div className="relative flex-1">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Опишите задачу на русском языке..."
                rows={2}
                className="w-full resize-none rounded-lg border border-border-subtle bg-bg-deep px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    handleSubmit(e)
                  }
                }}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Button type="submit" disabled={!inputText.trim() || submitting} loading={submitting}>
                <Send className="h-4 w-4" />
                Отправить
              </Button>
              <Button type="button" variant="outline" size="sm" disabled title="Голосовой ввод (скоро)">
                <Mic className="h-4 w-4" />
              </Button>
            </div>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">
            Ctrl+Enter для быстрой отправки
          </p>
        </CardContent>
      </Card>

      {/* Task list */}
      {!tasks || tasks.length === 0 ? (
        <EmptyState
          icon={ListTodo}
          title="Нет задач"
          description="Опишите задачу выше, чтобы начать"
        />
      ) : (
        <div className="space-y-4">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              isExpanded={activeTaskId === task.id}
              onToggle={() => setActiveTaskId(activeTaskId === task.id ? null : task.id)}
              actionLoading={actionLoading}
              onAction={handleAction}
              revisionText={activeTaskId === task.id ? revisionText : ''}
              onRevisionTextChange={setRevisionText}
              onRevise={handleRevise}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── TaskCard ──────────────────────────────────────────────────

interface TaskCardProps {
  task: Task
  isExpanded: boolean
  onToggle: () => void
  actionLoading: string | null
  onAction: (taskId: number, action: string, data?: Record<string, unknown>) => Promise<void>
  revisionText: string
  onRevisionTextChange: (text: string) => void
  onRevise: (taskId: number) => void
}

function TaskCard({
  task,
  isExpanded,
  onToggle,
  actionLoading,
  onAction,
  revisionText,
  onRevisionTextChange,
  onRevise,
}: TaskCardProps) {
  const interpretation = parseJsonField<TaskInterpretation>(task.interpretation)
  const progress = parseJsonField<TaskProgress[]>(task.progress)
  const config = statusConfig[task.status]
  const isLoading = (action: string) => actionLoading === `${task.id}-${action}`

  return (
    <Card className={task.status === 'pending' ? 'border-warning/30' : task.status === 'running' ? 'border-primary/30' : undefined}>
      {/* Header row */}
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 p-5 text-left"
        role="button"
        tabIndex={0}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{truncate(task.raw_input, 120)}</span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Badge variant={config.variant}>{config.label}</Badge>
            <span className="text-xs text-muted-foreground">{timeAgo(task.created_at)}</span>
            {task.mode === 'fast' && (
              <Badge variant="warning">
                <Zap className="h-3 w-3" /> Быстрый
              </Badge>
            )}
            {task.mode === 'safe' && (
              <Badge variant="info">
                <Shield className="h-3 w-3" /> Безопасный
              </Badge>
            )}
            {interpretation?.risk_level && (
              <span className={`text-xs font-medium ${riskColors[interpretation.risk_level] || ''}`}>
                Риск: {interpretation.risk_level}
              </span>
            )}
          </div>
        </div>
        {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <CardContent className="border-t border-border-subtle pt-5">
          {/* Interpretation */}
          {interpretation && (
            <div className="space-y-4">
              <Section title="Как понята задача" icon={MessageSquare}>
                <p className="text-sm">{interpretation.understood}</p>
              </Section>

              <Section title="Ожидаемый результат" icon={CheckCircle2}>
                <p className="text-sm">{interpretation.expected_outcome}</p>
              </Section>

              {interpretation.affected_areas.length > 0 && (
                <Section title="Затрагиваемые области" icon={AlertTriangle}>
                  <div className="flex flex-wrap gap-1.5">
                    {interpretation.affected_areas.map((area, i) => (
                      <Badge key={i} variant="secondary">{area}</Badge>
                    ))}
                  </div>
                </Section>
              )}

              {interpretation.constraints.length > 0 && (
                <Section title="Ограничения" icon={Shield}>
                  <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                    {interpretation.constraints.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </Section>
              )}

              <Section title="План выполнения" icon={ListTodo}>
                <ol className="list-inside list-decimal space-y-1 text-sm">
                  {interpretation.plan.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </Section>

              <Section title="Уровень риска" icon={AlertTriangle}>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-semibold ${riskColors[interpretation.risk_level] || ''}`}>
                    {interpretation.risk_level === 'low' ? 'Низкий' : interpretation.risk_level === 'medium' ? 'Средний' : 'Высокий'}
                  </span>
                  {interpretation.risk_note && (
                    <span className="text-sm text-muted-foreground">— {interpretation.risk_note}</span>
                  )}
                </div>
              </Section>
            </div>
          )}

          {/* Progress (for running tasks) */}
          {progress && progress.length > 0 && (
            <div className="mt-4 space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Play className="h-4 w-4 text-primary" />
                Прогресс выполнения
              </h4>
              <div className="space-y-1.5">
                {progress.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">{p.message_ru}</span>
                    {p.pct != null && (
                      <Badge variant="secondary">{p.pct}%</Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Result (for done tasks) */}
          {task.status === 'done' && task.result_summary_ru && (
            <div className="mt-4 rounded-lg border border-success/30 bg-success/5 p-4">
              <h4 className="text-sm font-medium text-success flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Результат
              </h4>
              <p className="mt-2 text-sm">{task.result_summary_ru}</p>
            </div>
          )}

          {/* Error (for failed tasks) */}
          {task.status === 'failed' && task.error && (
            <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <h4 className="text-sm font-medium text-destructive flex items-center gap-2">
                <XCircle className="h-4 w-4" />
                Ошибка
              </h4>
              <p className="mt-2 text-sm">{task.error}</p>
            </div>
          )}

          {/* Actions for pending tasks */}
          {task.status === 'pending' && (
            <div className="mt-6 space-y-4">
              {/* Revision input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={revisionText}
                  onChange={(e) => onRevisionTextChange(e.target.value)}
                  placeholder="Уточнить задачу (текстом)..."
                  className="flex-1 rounded-lg border border-border-subtle bg-bg-deep px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && revisionText.trim()) {
                      onRevise(task.id)
                    }
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onRevise(task.id)}
                  disabled={!revisionText.trim()}
                  loading={isLoading('revise') || isLoading('interpret')}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Уточнить
                </Button>
              </div>

              {/* Confirm / Cancel / Mode */}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={() => onAction(task.id, 'confirm', { mode: 'safe' })}
                  loading={isLoading('confirm')}
                >
                  <Shield className="h-4 w-4" />
                  Подтвердить (безопасно)
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onAction(task.id, 'confirm', { mode: 'fast' })}
                  loading={isLoading('confirm')}
                >
                  <Zap className="h-4 w-4" />
                  Быстрый режим
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => onAction(task.id, 'cancel')}
                  loading={isLoading('cancel')}
                >
                  <XCircle className="h-4 w-4" />
                  Отменить
                </Button>
              </div>
            </div>
          )}

          {/* Draft — waiting for interpretation */}
          {task.status === 'draft' && (
            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Анализируем задачу...
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}

// ── Section helper ─────────────────────────────────────────────

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <div>
      <h4 className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground/70 flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </h4>
      {children}
    </div>
  )
}
