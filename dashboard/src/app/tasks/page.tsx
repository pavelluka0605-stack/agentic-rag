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
  fetchTask,
  createTask,
  createVoiceTask,
  taskAction,
} from '@/lib/api-client'
import type {
  Task,
  TaskInterpretation,
  TaskEngineeringPacket,
  TaskProgress,
  TaskStatus,
  TaskEvent,
} from '@/types'

// ── Status helpers ─────────────────────────────────────────────

const statusConfig: Record<TaskStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'info' }> = {
  draft: { label: 'Черновик', variant: 'secondary' },
  pending: { label: 'Ожидает подтверждения', variant: 'warning' },
  confirmed: { label: 'Подтверждена', variant: 'info' },
  running: { label: 'Выполняется', variant: 'default' },
  review: { label: 'На проверке', variant: 'warning' },
  needs_manual_review: { label: 'Ручная проверка', variant: 'destructive' },
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

  // Voice recording
  const [recording, setRecording] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)

  // Active task (expanded)
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [revisionText, setRevisionText] = useState('')
  const [taskEvents, setTaskEvents] = useState<Record<number, TaskEvent[]>>({})

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

  async function loadTaskEvents(taskId: number) {
    try {
      const taskWithEvents = await fetchTask(taskId, { events: true }) as Task & { events?: TaskEvent[] }
      if (taskWithEvents.events) {
        setTaskEvents(prev => ({ ...prev, [taskId]: taskWithEvents.events! }))
      }
    } catch {
      // non-critical
    }
  }

  function handleToggle(taskId: number) {
    if (activeTaskId === taskId) {
      setActiveTaskId(null)
    } else {
      setActiveTaskId(taskId)
      loadTaskEvents(taskId)
    }
  }

  async function handleRevise(taskId: number) {
    if (!revisionText.trim()) return
    await handleAction(taskId, 'revise', { text: revisionText.trim() })
    setRevisionText('')
    // Re-interpret after revision
    await handleAction(taskId, 'interpret')
  }

  // ── Voice recording ────────────────────────────────

  async function handleVoiceToggle() {
    if (recording && mediaRecorder) {
      // Stop recording
      mediaRecorder.stop()
      setRecording(false)
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      const chunks: Blob[] = []

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        setMediaRecorder(null)

        const blob = new Blob(chunks, { type: 'audio/webm' })

        // Size guard: 10MB max (Whisper accepts 25MB, but base64 doubles size)
        const MAX_AUDIO_BYTES = 10 * 1024 * 1024
        if (blob.size > MAX_AUDIO_BYTES) {
          setError(`Запись слишком длинная (${(blob.size / 1024 / 1024).toFixed(1)} МБ). Максимум 10 МБ — попробуйте короче.`)
          return
        }

        // Convert to base64 (chunked to avoid call stack overflow)
        const buffer = await blob.arrayBuffer()
        const bytes = new Uint8Array(buffer)
        let binary = ''
        const chunkSize = 8192
        for (let i = 0; i < bytes.length; i += chunkSize) {
          binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
        }
        const base64 = btoa(binary)

        setSubmitting(true)
        try {
          const task = await createVoiceTask({ audio: base64 })
          setActiveTaskId(task.id)
          await loadTasks()
        } catch (e) {
          setError(`Ошибка голосового ввода: ${e}`)
        } finally {
          setSubmitting(false)
        }
      }

      recorder.start()
      setMediaRecorder(recorder)
      setRecording(true)
    } catch (e) {
      setError(`Микрофон недоступен: ${e}`)
    }
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
              <Button
                type="button"
                variant={recording ? 'destructive' : 'outline'}
                size="sm"
                onClick={handleVoiceToggle}
                disabled={submitting}
                title={recording ? 'Остановить запись' : 'Голосовой ввод'}
              >
                <Mic className={`h-4 w-4 ${recording ? 'animate-pulse' : ''}`} />
                {recording ? 'Стоп' : ''}
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
              onToggle={() => handleToggle(task.id)}
              actionLoading={actionLoading}
              onAction={handleAction}
              revisionText={activeTaskId === task.id ? revisionText : ''}
              onRevisionTextChange={setRevisionText}
              onRevise={handleRevise}
              events={taskEvents[task.id]}
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
  events?: TaskEvent[]
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
  events,
}: TaskCardProps) {
  const interpretation = parseJsonField<TaskInterpretation>(task.interpretation)
  const engPacket = parseJsonField<TaskEngineeringPacket>(task.engineering_packet)
  const progress = parseJsonField<TaskProgress[]>(task.progress)
  const config = statusConfig[task.status] || { label: task.status, variant: 'secondary' as const }
  const isLoading = (action: string) => actionLoading === `${task.id}-${action}`

  return (
    <Card className={task.status === 'pending' ? 'border-warning/30' : task.status === 'running' ? 'border-primary/30' : task.status === 'review' ? 'border-warning/30' : task.status === 'needs_manual_review' ? 'border-destructive/30' : undefined}>
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

          {/* Review state — approve / reject / escalate */}
          {task.status === 'review' && (
            <div className="mt-4 space-y-3">
              <div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
                <h4 className="text-sm font-medium text-warning flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Задача ожидает проверки
                </h4>
                {task.error && <p className="mt-2 text-sm text-muted-foreground">{task.error}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={() => onAction(task.id, 'complete', { result_summary_ru: 'Проверка пройдена' })}
                  loading={isLoading('complete')}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Принять
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onAction(task.id, 'request-review', { reason: 'Требуется ручная проверка' })}
                  loading={isLoading('request-review')}
                >
                  <AlertTriangle className="h-4 w-4" />
                  Ручная проверка
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => onAction(task.id, 'fail', { error: 'Отклонено при проверке' })}
                  loading={isLoading('fail')}
                >
                  <XCircle className="h-4 w-4" />
                  Отклонить
                </Button>
              </div>
            </div>
          )}

          {/* Needs manual review — show reason and resolution buttons */}
          {task.status === 'needs_manual_review' && (
            <div className="mt-4 space-y-3">
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                <h4 className="text-sm font-medium text-destructive flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Требуется ручная проверка
                </h4>
                {task.error && <p className="mt-2 text-sm">{task.error}</p>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={() => onAction(task.id, 'complete', { result_summary_ru: 'Решено вручную' })}
                  loading={isLoading('complete')}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Решено — принять
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => onAction(task.id, 'fail', { error: 'Не удалось решить' })}
                  loading={isLoading('fail')}
                >
                  <XCircle className="h-4 w-4" />
                  Не решено
                </Button>
              </div>
            </div>
          )}

          {/* Event timeline */}
          {events && events.length > 0 && (
            <div className="mt-4 space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                История событий
              </h4>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {events.map((evt) => (
                  <div key={evt.id} className="flex items-start gap-2 text-xs">
                    <span className="text-muted-foreground/60 whitespace-nowrap shrink-0">{timeAgo(evt.created_at)}</span>
                    <Badge variant="secondary" className="text-[10px] shrink-0">{evt.event_type}</Badge>
                    {evt.detail && <span className="text-muted-foreground">{evt.detail}</span>}
                  </div>
                ))}
              </div>
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

          {/* Confirmed — engineering packet + Execute button */}
          {task.status === 'confirmed' && engPacket && (
            <div className="mt-6 space-y-4">
              <div className="rounded-lg border border-info/30 bg-info/5 p-4 space-y-3">
                <h4 className="text-sm font-medium text-info flex items-center gap-2">
                  <ListTodo className="h-4 w-4" />
                  Инженерный пакет
                </h4>
                <p className="text-sm font-medium">{engPacket.title}</p>
                <p className="text-sm text-muted-foreground">{engPacket.objective}</p>
                <div>
                  <span className="text-xs font-medium uppercase text-muted-foreground/70">Шаги:</span>
                  <ol className="mt-1 list-inside list-decimal space-y-1 text-sm">
                    {engPacket.steps.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </div>
                {engPacket.acceptance_criteria.length > 0 && (
                  <div>
                    <span className="text-xs font-medium uppercase text-muted-foreground/70">Критерии приёмки:</span>
                    <ul className="mt-1 list-inside list-disc space-y-1 text-sm text-muted-foreground">
                      {engPacket.acceptance_criteria.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => onAction(task.id, 'start')}
                  loading={isLoading('start')}
                >
                  <Play className="h-4 w-4" />
                  Запустить выполнение
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

          {/* Draft — waiting for interpretation or failed */}
          {task.status === 'draft' && (
            <div className="mt-4 flex items-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Анализируем задачу...
              <Button
                variant="outline"
                size="sm"
                onClick={() => onAction(task.id, 'interpret')}
                loading={isLoading('interpret')}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Повторить
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onAction(task.id, 'cancel')}
                loading={isLoading('cancel')}
              >
                <XCircle className="h-3.5 w-3.5" />
                Отменить
              </Button>
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
