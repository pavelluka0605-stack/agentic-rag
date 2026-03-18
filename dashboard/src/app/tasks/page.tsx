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
  ThumbsUp,
  CircleDot,
  Square,
  Pause,
  ArrowLeft,
  HelpCircle,
  Ban,
  Trash2,
  Undo2,
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
  fetchDeletedTasks,
  fetchTask,
  createTask,
  createVoiceTask,
  taskAction,
  permanentDeleteTask,
  bulkSoftDelete,
} from '@/lib/api-client'
import type {
  Task,
  TaskInterpretation,
  TaskEngineeringPacket,
  TaskProgress,
  TaskStatus,
  TaskEvent,
  TaskOption,
  TaskPhase,
} from '@/types'

// ── Status helpers ─────────────────────────────────────────────

const statusConfig: Record<TaskStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'info' }> = {
  draft: { label: 'Анализ...', variant: 'secondary' },
  pending: { label: 'Выбор стратегии', variant: 'warning' },
  confirmed: { label: 'Готова к запуску', variant: 'info' },
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

const riskLabels: Record<string, string> = {
  low: 'низкий',
  medium: 'средний',
  high: 'высокий',
}

const effortLabels: Record<string, string> = {
  low: 'Мало',
  medium: 'Средне',
  high: 'Много',
}

const speedLabels: Record<string, string> = {
  fast: 'Быстро',
  medium: 'Средне',
  slow: 'Долго',
}

const eventTypeLabels: Record<string, string> = {
  created: 'Создана',
  interpreted: 'Разобрана',
  revised: 'Уточнена',
  option_chosen: 'Вариант выбран',
  confirmed: 'Подтверждена',
  dispatched: 'Отправлена',
  started: 'Запущена',
  running: 'Выполняется',
  progress: 'Прогресс',
  review: 'На проверке',
  review_requested: 'Запрос проверки',
  completed: 'Выполнена',
  failed: 'Ошибка',
  cancelled: 'Отменена',
  'request-review': 'Ручная проверка',
  manual_review_needed: 'Ручная проверка',
  escalated: 'Эскалирована',
  retried: 'Повтор',
  executor_started: 'Исполнитель запущен',
  executor_spawn_failed: 'Ошибка запуска',
  executor_fallback_tmux: 'Fallback (tmux)',
  executor_no_ack: 'Исполнитель не запущен',
  stall_detected: 'Зависание',
  dispatch_failed: 'Ошибка отправки',
  soft_deleted: 'В корзину',
  restored: 'Восстановлена',
  permanently_deleted: 'Удалена навсегда',
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

  // Trash view
  const [showTrash, setShowTrash] = useState(false)
  const [trashTasks, setTrashTasks] = useState<Task[]>([])
  const [trashCount, setTrashCount] = useState(0)
  const [trashLoading, setTrashLoading] = useState(false)

  // Delete confirmation dialog
  const [confirmDelete, setConfirmDelete] = useState<{ taskId: number; title: string } | null>(null)
  const [confirmPermanent, setConfirmPermanent] = useState<{ taskId: number; title: string } | null>(null)

  // Bulk action loading
  const [bulkLoading, setBulkLoading] = useState(false)

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

  const loadTrash = useCallback(async () => {
    setTrashLoading(true)
    try {
      const data = await fetchDeletedTasks({ limit: 50 })
      setTrashTasks(data)
      setTrashCount(data.length)
    } catch (e) {
      setError(`Ошибка загрузки корзины: ${e}`)
    } finally {
      setTrashLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTasks()
    // Also get trash count on mount
    fetchDeletedTasks({ limit: 1 }).then(d => setTrashCount(d.length)).catch(() => {})
    const interval = setInterval(loadTasks, 3000)
    return () => clearInterval(interval)
  }, [loadTasks])

  // When switching to trash tab, load deleted tasks
  useEffect(() => {
    if (showTrash) loadTrash()
  }, [showTrash, loadTrash])

  // ── Submit new task ──────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!inputText.trim() || submitting) return

    setSubmitting(true)
    try {
      const task = await createTask({ raw_input: inputText.trim() })
      setInputText('')
      setActiveTaskId(task.id)
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
    await handleAction(taskId, 'interpret')
  }

  // ── Delete actions ────────────────────────────────

  async function handleSoftDelete(taskId: number) {
    setActionLoading(`${taskId}-delete`)
    try {
      await taskAction(taskId, 'delete')
      setConfirmDelete(null)
      setActiveTaskId(null)
      await loadTasks()
      setTrashCount(c => c + 1)
    } catch (e) {
      setError(`Ошибка удаления: ${e}`)
    } finally {
      setActionLoading(null)
    }
  }

  async function handleRestore(taskId: number) {
    setActionLoading(`${taskId}-restore`)
    try {
      await taskAction(taskId, 'restore')
      await loadTrash()
      await loadTasks()
      setTrashCount(c => Math.max(0, c - 1))
    } catch (e) {
      setError(`Ошибка восстановления: ${e}`)
    } finally {
      setActionLoading(null)
    }
  }

  async function handlePermanentDelete(taskId: number) {
    setActionLoading(`${taskId}-permanent`)
    try {
      await permanentDeleteTask(taskId)
      setConfirmPermanent(null)
      await loadTrash()
      setTrashCount(c => Math.max(0, c - 1))
    } catch (e) {
      setError(`Ошибка удаления: ${e}`)
    } finally {
      setActionLoading(null)
    }
  }

  async function handleBulkDelete(status: string) {
    setBulkLoading(true)
    try {
      const result = await bulkSoftDelete({ status })
      if (result.deleted > 0) {
        await loadTasks()
        setTrashCount(c => c + result.deleted)
      }
    } catch (e) {
      setError(`Ошибка массового удаления: ${e}`)
    } finally {
      setBulkLoading(false)
    }
  }

  // ── Voice recording ────────────────────────────────

  async function handleVoiceToggle() {
    if (recording && mediaRecorder) {
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
        const MAX_AUDIO_BYTES = 10 * 1024 * 1024
        if (blob.size > MAX_AUDIO_BYTES) {
          setError(`Запись слишком длинная (${(blob.size / 1024 / 1024).toFixed(1)} МБ). Максимум 10 МБ.`)
          return
        }

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

  // Task counts by status for bulk action badges
  const countByStatus = (status: string) => tasks?.filter(t => t.status === status).length || 0
  const doneCount = countByStatus('done')
  const failedCount = countByStatus('failed')
  const cancelledCount = countByStatus('cancelled')
  const hasBulkTargets = doneCount > 0 || failedCount > 0 || cancelledCount > 0

  return (
    <div className="space-y-6">
      <PageHeader
        title="Задачи"
        description="Постановка, планирование и контроль выполнения"
      />

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Скрыть</button>
        </div>
      )}

      {/* ── Confirmation dialogs ── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={() => setConfirmDelete(null)}>
          <div className="w-full max-w-sm rounded-xl border border-border-subtle bg-bg-deep p-5 shadow-xl space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold">Переместить в корзину?</h3>
            <p className="text-sm text-muted-foreground break-words">{confirmDelete.title}</p>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => handleSoftDelete(confirmDelete.taskId)}
                loading={actionLoading === `${confirmDelete.taskId}-delete`}
              >
                <Trash2 className="h-4 w-4" /> В корзину
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(null)}>
                Отмена
              </Button>
            </div>
          </div>
        </div>
      )}

      {confirmPermanent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4" onClick={() => setConfirmPermanent(null)}>
          <div className="w-full max-w-sm rounded-xl border border-destructive/30 bg-bg-deep p-5 shadow-xl space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-destructive">Удалить навсегда?</h3>
            <p className="text-sm text-muted-foreground break-words">{confirmPermanent.title}</p>
            <p className="text-xs text-destructive/70">Это действие необратимо. Задача и её история будут удалены.</p>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => handlePermanentDelete(confirmPermanent.taskId)}
                loading={actionLoading === `${confirmPermanent.taskId}-permanent`}
              >
                Удалить навсегда
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setConfirmPermanent(null)}>
                Отмена
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Tasks / Trash ── */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setShowTrash(false)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${!showTrash ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Задачи
        </button>
        <button
          onClick={() => setShowTrash(true)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${showTrash ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Корзина
          {trashCount > 0 && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${showTrash ? 'bg-primary-foreground/20' : 'bg-muted-foreground/20'}`}>
              {trashCount}
            </span>
          )}
        </button>
      </div>

      {/* ── Trash View ── */}
      {showTrash ? (
        <div className="space-y-4">
          {trashLoading ? (
            <div className="flex justify-center py-8"><Loading size="lg" /></div>
          ) : trashTasks.length === 0 ? (
            <EmptyState icon={Trash2} title="Корзина пуста" description="Удалённые задачи появятся здесь" />
          ) : (
            <>
              {trashTasks.map((task) => {
                const interp = parseJsonField<TaskInterpretation>(task.interpretation)
                const config = statusConfig[task.status] || { label: task.status, variant: 'secondary' as const }
                return (
                  <Card key={task.id} className="opacity-70">
                    <div className="flex items-center gap-3 p-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium break-words line-through decoration-muted-foreground/30">
                          {interp?.understood || truncate(task.raw_input, 100)}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <Badge variant={config.variant}>{config.label}</Badge>
                          <span className="text-xs text-muted-foreground">удалена {timeAgo(task.deleted_at!)}</span>
                        </div>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRestore(task.id)}
                          loading={actionLoading === `${task.id}-restore`}
                          className="min-h-[36px]"
                        >
                          <Undo2 className="h-3.5 w-3.5" /> Восстановить
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmPermanent({ taskId: task.id, title: interp?.understood || task.raw_input.slice(0, 100) })}
                          className="min-h-[36px] text-destructive hover:text-destructive"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </>
          )}
        </div>
      ) : (
        <>
          {/* ── Stage A: Voice/Text Intake ── */}
          <Card>
            <CardContent className="pt-5">
              <form onSubmit={handleSubmit} className="space-y-3">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Опишите задачу голосом или текстом..."
                  rows={3}
                  className="w-full resize-none rounded-lg border border-border-subtle bg-bg-deep px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      handleSubmit(e)
                    }
                  }}
                />
                <div className="flex items-center gap-2">
                  <Button type="submit" disabled={!inputText.trim() || submitting} loading={submitting} className="flex-1 sm:flex-none">
                    <Send className="h-4 w-4" />
                    Анализировать
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
                    {recording ? 'Стоп' : 'Голос'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Ctrl+Enter для отправки. Можно добавить голос для контекста.
                </p>
              </form>
            </CardContent>
          </Card>

          {/* ── Bulk actions bar ── */}
          {hasBulkTargets && (
            <div className="flex flex-wrap items-center gap-2 px-1">
              <span className="text-xs text-muted-foreground">Очистить:</span>
              {doneCount > 0 && (
                <Button variant="outline" size="sm" onClick={() => handleBulkDelete('done')} loading={bulkLoading} className="text-xs h-7">
                  <Trash2 className="h-3 w-3" /> Выполненные ({doneCount})
                </Button>
              )}
              {failedCount > 0 && (
                <Button variant="outline" size="sm" onClick={() => handleBulkDelete('failed')} loading={bulkLoading} className="text-xs h-7">
                  <Trash2 className="h-3 w-3" /> Ошибочные ({failedCount})
                </Button>
              )}
              {cancelledCount > 0 && (
                <Button variant="outline" size="sm" onClick={() => handleBulkDelete('cancelled')} loading={bulkLoading} className="text-xs h-7">
                  <Trash2 className="h-3 w-3" /> Отменённые ({cancelledCount})
                </Button>
              )}
            </div>
          )}

          {/* Task list */}
          {!tasks || tasks.length === 0 ? (
            <EmptyState
              icon={ListTodo}
              title="Нет задач"
              description="Опишите задачу выше — система предложит варианты решения"
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
                  onDelete={(id, title) => setConfirmDelete({ taskId: id, title })}
                />
              ))}
            </div>
          )}
        </>
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
  onDelete: (taskId: number, title: string) => void
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
  onDelete,
}: TaskCardProps) {
  const interpretation = parseJsonField<TaskInterpretation>(task.interpretation)
  const engPacket = parseJsonField<TaskEngineeringPacket>(task.engineering_packet)
  const progress = parseJsonField<TaskProgress[]>(task.progress)
  const phases = parseJsonField<TaskPhase[]>(task.execution_phases)
  const chosenOption = parseJsonField<TaskOption>(task.chosen_option)
  const config = statusConfig[task.status] || { label: task.status, variant: 'secondary' as const }
  const isLoading = (action: string) => actionLoading === `${task.id}-${action}`

  // Compute active phase for running tasks
  const activePhase = phases?.find(p => p.status === 'active')
  const completedPhases = phases?.filter(p => p.status === 'done').length || 0
  const totalPhases = phases?.length || 0

  return (
    <Card className={
      task.status === 'pending' ? 'border-warning/30' :
      task.status === 'running' ? 'border-primary/30 shadow-primary/5 shadow-lg' :
      task.status === 'review' ? 'border-warning/30' :
      task.status === 'needs_manual_review' ? 'border-destructive/30' :
      undefined
    }>
      {/* Header row */}
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 p-4 sm:p-5 text-left"
        role="button"
        tabIndex={0}
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium break-words">
            {interpretation?.understood || truncate(task.raw_input, 100)}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge variant={config.variant}>{config.label}</Badge>
            <span className="text-xs text-muted-foreground">{timeAgo(task.created_at)}</span>
            {interpretation?.risk_level && (
              <span className={`text-xs font-medium ${riskColors[interpretation.risk_level] || ''}`}>
                {riskLabels[interpretation.risk_level] || interpretation.risk_level}
              </span>
            )}
            {/* Running task: show active phase inline */}
            {task.status === 'running' && activePhase && (
              <span className="text-xs text-primary font-medium">
                {activePhase.name_ru} ({completedPhases}/{totalPhases})
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {/* Delete button — only for non-running tasks */}
          {task.status !== 'running' && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete(task.id, interpretation?.understood || task.raw_input.slice(0, 100))
              }}
              className="p-1.5 rounded-md text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="В корзину"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <CardContent className="border-t border-border-subtle pt-4 px-3 sm:px-6">

          {/* ── Stage B: Understanding + Options (pending state) ── */}
          {task.status === 'pending' && interpretation && (
            <div className="space-y-5">
              {/* Understanding summary */}
              <div className="rounded-lg border border-border-subtle bg-bg-inset p-4 space-y-3">
                <Section title="Как понята задача" icon={MessageSquare}>
                  <p className="text-sm">{interpretation.understood}</p>
                </Section>
                <Section title="Ожидаемый результат" icon={CheckCircle2}>
                  <p className="text-sm">{interpretation.expected_outcome}</p>
                </Section>
                {interpretation.affected_areas && interpretation.affected_areas.length > 0 && (
                  <Section title="Затрагиваемые области" icon={AlertTriangle}>
                    <div className="flex flex-wrap gap-1.5">
                      {interpretation.affected_areas.map((area, i) => (
                        <Badge key={i} variant="secondary">{area}</Badge>
                      ))}
                    </div>
                  </Section>
                )}
              </div>

              {/* Solution Options */}
              {interpretation.options && interpretation.options.length > 0 ? (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">Варианты решения</h3>
                  <div className="space-y-3">
                    {interpretation.options.map((opt) => (
                      <OptionCard
                        key={opt.id}
                        option={opt}
                        isChosen={chosenOption?.id === opt.id}
                        onChoose={() => onAction(task.id, 'choose-option', { option_id: opt.id })}
                        isLoading={isLoading('choose-option')}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                /* Fallback: old-style plan without options */
                interpretation.plan && interpretation.plan.length > 0 && (
                  <Section title="План выполнения" icon={ListTodo}>
                    <ol className="list-inside list-decimal space-y-1 text-sm">
                      {interpretation.plan.map((step, i) => (
                        <li key={i}>{step}</li>
                      ))}
                    </ol>
                  </Section>
                )
              )}

              {/* Risk summary */}
              <div className="flex items-center gap-3 text-sm">
                <span className="text-muted-foreground">Общий риск:</span>
                <span className={`font-semibold ${riskColors[interpretation.risk_level] || ''}`}>
                  {riskLabels[interpretation.risk_level] || '?'}
                </span>
                {interpretation.risk_note && (
                  <span className="text-muted-foreground">— {interpretation.risk_note}</span>
                )}
              </div>

              {/* Revision input */}
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="text"
                  value={revisionText}
                  onChange={(e) => onRevisionTextChange(e.target.value)}
                  placeholder="Уточнить или добавить контекст..."
                  className="w-full rounded-lg border border-border-subtle bg-bg-deep px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none sm:flex-1"
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
                  className="w-full sm:w-auto"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Уточнить
                </Button>
              </div>

              {/* Confirm / Cancel — only after option is chosen */}
              <div className="grid grid-cols-1 gap-2.5 sm:flex sm:flex-wrap sm:items-center" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }}>
                <Button
                  onClick={() => onAction(task.id, 'confirm', { mode: 'safe' })}
                  loading={isLoading('confirm')}
                  disabled={!!(interpretation.options && interpretation.options.length > 0 && !chosenOption)}
                  className="w-full min-h-[44px] sm:w-auto sm:min-h-0"
                >
                  <Shield className="h-4 w-4" />
                  {chosenOption ? 'Подтвердить подход' : 'Выберите вариант'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onAction(task.id, 'confirm', { mode: 'fast' })}
                  loading={isLoading('confirm')}
                  disabled={!!(interpretation.options && interpretation.options.length > 0 && !chosenOption)}
                  className="w-full min-h-[44px] sm:w-auto sm:min-h-0"
                >
                  <Zap className="h-4 w-4" />
                  Быстрый режим
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => onAction(task.id, 'cancel')}
                  loading={isLoading('cancel')}
                  className="w-full min-h-[44px] sm:w-auto sm:min-h-0"
                >
                  <XCircle className="h-4 w-4" />
                  Отменить
                </Button>
              </div>
            </div>
          )}

          {/* ── Stage C: Plan Confirmation (confirmed state) ── */}
          {task.status === 'confirmed' && engPacket && (
            <div className="space-y-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }}>
              {/* Chosen approach */}
              {chosenOption && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <p className="text-xs font-medium uppercase text-primary/70 mb-1">Выбранный подход</p>
                  <p className="text-sm font-medium">{chosenOption.title}</p>
                  <p className="text-sm text-muted-foreground mt-1">{chosenOption.description}</p>
                </div>
              )}

              {/* Engineering packet */}
              <div className="rounded-lg border border-info/30 bg-info/5 p-3 sm:p-4 space-y-3">
                <h4 className="text-sm font-medium text-info flex items-center gap-2">
                  <ListTodo className="h-4 w-4 shrink-0" />
                  Что будет сделано
                </h4>
                <p className="text-sm font-medium break-words">{engPacket.title}</p>
                <p className="text-sm text-muted-foreground break-words">{engPacket.objective}</p>

                {/* Steps */}
                <div>
                  <span className="text-xs font-medium uppercase text-muted-foreground/70">Шаги:</span>
                  <ol className="mt-1 list-inside list-decimal space-y-1 text-sm break-words">
                    {engPacket.steps.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                </div>

                {/* Not doing */}
                {engPacket.not_doing && engPacket.not_doing.length > 0 && (
                  <div>
                    <span className="text-xs font-medium uppercase text-destructive/70">Что НЕ входит:</span>
                    <ul className="mt-1 list-inside list-disc space-y-1 text-sm text-muted-foreground break-words">
                      {engPacket.not_doing.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Acceptance criteria */}
                {engPacket.acceptance_criteria.length > 0 && (
                  <div>
                    <span className="text-xs font-medium uppercase text-muted-foreground/70">Критерии приёмки:</span>
                    <ul className="mt-1 list-inside list-disc space-y-1 text-sm text-muted-foreground break-words">
                      {engPacket.acceptance_criteria.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Phase preview */}
                {phases && phases.length > 0 && (
                  <div>
                    <span className="text-xs font-medium uppercase text-muted-foreground/70">Этапы выполнения:</span>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {phases.map((phase, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {i + 1}. {phase.name_ru}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Mode + Risk */}
                <div className="flex flex-wrap gap-4 pt-2 border-t border-border-subtle text-xs text-muted-foreground">
                  <span>Режим: <strong>{task.mode === 'fast' ? 'Быстрый' : 'Безопасный'}</strong></span>
                  {interpretation?.risk_level && (
                    <span>Риск: <strong className={riskColors[interpretation.risk_level]}>{riskLabels[interpretation.risk_level]}</strong></span>
                  )}
                </div>
              </div>

              {/* Execute / Cancel */}
              <div className="grid grid-cols-1 gap-2.5 sm:flex sm:items-center">
                <Button
                  onClick={() => onAction(task.id, 'start')}
                  loading={isLoading('start')}
                  className="w-full min-h-[44px] sm:w-auto sm:min-h-0"
                >
                  <Play className="h-4 w-4" />
                  Запустить
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => onAction(task.id, 'cancel')}
                  loading={isLoading('cancel')}
                  className="w-full min-h-[44px] sm:w-auto sm:min-h-0"
                >
                  <XCircle className="h-4 w-4" />
                  Отменить
                </Button>
              </div>
            </div>
          )}

          {/* ── Stage D: Live Execution View (running state) ── */}
          {task.status === 'running' && (
            <div className="space-y-4">
              {/* Phase tracker */}
              {phases && phases.length > 0 && (
                <PhaseTracker phases={phases} />
              )}

              {/* Live progress feed */}
              {progress && progress.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Play className="h-4 w-4 text-primary animate-pulse" />
                    Что происходит сейчас
                  </h4>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {[...progress].reverse().map((p, i) => (
                      <div key={i} className={`flex items-start gap-2 text-sm ${i === 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                        {i === 0 ? (
                          <CircleDot className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5 animate-pulse" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5 text-success/50 shrink-0 mt-0.5" />
                        )}
                        <span className="break-words min-w-0">{p.message_ru}</span>
                        {p.pct != null && (
                          <Badge variant="secondary" className="shrink-0">{p.pct}%</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* No progress yet — detect stall */}
              {(!progress || progress.length === 0) && (() => {
                const waitingSec = Math.floor((Date.now() - new Date(task.updated_at).getTime()) / 1000)
                const isStalled = waitingSec > 90
                return isStalled ? (
                  <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-3">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>Задача зависла — нет данных от исполнителя уже {Math.floor(waitingSec / 60)} мин. Возможно, исполнитель не запустился.</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Задача запущена, ожидаем первые данные...
                  </div>
                )
              })()}

              {/* Stage E: Owner Controls */}
              <div className="grid grid-cols-1 gap-2.5 sm:flex sm:flex-wrap sm:items-center pt-2 border-t border-border-subtle" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }}>
                <Button
                  variant="outline"
                  onClick={() => onAction(task.id, 'review', { detail: 'Остановлена владельцем для проверки' })}
                  loading={isLoading('review')}
                  className="w-full min-h-[44px] sm:w-auto sm:min-h-0"
                >
                  <Pause className="h-4 w-4" />
                  Остановить
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onAction(task.id, 'request-review', { reason: 'Нужно уточнение от владельца' })}
                  loading={isLoading('request-review')}
                  className="w-full min-h-[44px] sm:w-auto sm:min-h-0"
                >
                  <HelpCircle className="h-4 w-4" />
                  Уточнить
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => onAction(task.id, 'fail', { error: 'Остановлена владельцем' })}
                  loading={isLoading('fail')}
                  className="w-full min-h-[44px] sm:w-auto sm:min-h-0"
                >
                  <Ban className="h-4 w-4" />
                  Отменить задачу
                </Button>
              </div>
            </div>
          )}

          {/* ── Review state — approve / rework / reject ── */}
          {task.status === 'review' && (
            <div className="space-y-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }}>
              {/* Show phases if available */}
              {phases && phases.length > 0 && <PhaseTracker phases={phases} />}

              {/* Progress so far */}
              {progress && progress.length > 0 && (
                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                  {[...progress].reverse().slice(0, 5).map((p, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-3.5 w-3.5 text-success/50 shrink-0 mt-0.5" />
                      <span className="break-words min-w-0">{p.message_ru}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="rounded-lg border border-warning/30 bg-warning/5 p-3">
                <h4 className="text-sm font-medium text-warning flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Задача ожидает вашего решения
                </h4>
                {task.error && <p className="mt-2 text-sm text-muted-foreground break-words">{task.error}</p>}
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:flex sm:flex-wrap sm:items-center">
                <Button
                  onClick={() => onAction(task.id, 'complete', { result_summary_ru: 'Проверка пройдена, результат принят' })}
                  loading={isLoading('complete')}
                  className="w-full min-h-[44px] sm:w-auto sm:min-h-0"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Принять результат
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onAction(task.id, 'request-review', { reason: 'Нужна доработка' })}
                  loading={isLoading('request-review')}
                  className="w-full min-h-[44px] sm:w-auto sm:min-h-0"
                >
                  <ArrowLeft className="h-4 w-4" />
                  На доработку
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => onAction(task.id, 'fail', { error: 'Отклонено при проверке' })}
                  loading={isLoading('fail')}
                  className="w-full min-h-[44px] sm:w-auto sm:min-h-0"
                >
                  <XCircle className="h-4 w-4" />
                  Отклонить
                </Button>
              </div>
            </div>
          )}

          {/* Needs manual review */}
          {task.status === 'needs_manual_review' && (
            <div className="space-y-3" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }}>
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <h4 className="text-sm font-medium text-destructive flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  Требуется ваше решение
                </h4>
                {task.error && <p className="mt-2 text-sm break-words">{task.error}</p>}
              </div>

              {/* Diagnostics */}
              {events && events.length > 0 && (() => {
                const retryCount = events.filter(e => e.event_type === 'retried').length
                const lastEvent = events[events.length - 1]
                const diagEvents = events.filter(e =>
                  ['executor_spawn_failed', 'executor_no_ack', 'executor_fallback_tmux', 'stall_detected', 'dispatch_failed'].includes(e.event_type)
                )
                return (diagEvents.length > 0 || retryCount > 0) ? (
                  <div className="rounded-lg border border-border-subtle bg-bg-inset p-3 space-y-1.5">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Диагностика</h4>
                    {retryCount > 0 && (
                      <p className="text-xs text-muted-foreground">Попыток: {retryCount}</p>
                    )}
                    {diagEvents.map((de, i) => (
                      <p key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                        <span className="text-warning shrink-0">•</span>
                        <span className="break-words">{de.detail}</span>
                      </p>
                    ))}
                    <p className="text-xs text-muted-foreground/60">
                      Последнее событие: {eventTypeLabels[lastEvent.event_type] || lastEvent.event_type} — {timeAgo(lastEvent.created_at)}
                    </p>
                  </div>
                ) : null
              })()}

              <div className="grid grid-cols-1 gap-2.5 sm:flex sm:flex-wrap sm:items-center">
                <Button
                  onClick={() => onAction(task.id, 'retry', { strategy: 're-execute' })}
                  loading={isLoading('retry')}
                  className="w-full min-h-[44px] sm:w-auto sm:min-h-0"
                >
                  <RotateCcw className="h-4 w-4" />
                  Перезапустить
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onAction(task.id, 'complete', { result_summary_ru: 'Решено вручную' })}
                  loading={isLoading('complete')}
                  className="w-full min-h-[44px] sm:w-auto sm:min-h-0"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Решено — принять
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => onAction(task.id, 'fail', { error: 'Не удалось решить' })}
                  loading={isLoading('fail')}
                  className="w-full min-h-[44px] sm:w-auto sm:min-h-0"
                >
                  <XCircle className="h-4 w-4" />
                  Не решено
                </Button>
              </div>
            </div>
          )}

          {/* Result (done) */}
          {task.status === 'done' && (
            <div className="space-y-4">
              {phases && phases.length > 0 && <PhaseTracker phases={phases} />}
              {task.result_summary_ru && (
                <div className="rounded-lg border border-success/30 bg-success/5 p-4">
                  <h4 className="text-sm font-medium text-success flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Результат
                  </h4>
                  <p className="mt-2 text-sm">{task.result_summary_ru}</p>
                </div>
              )}
            </div>
          )}

          {/* Error (failed) — with diagnostics and retry */}
          {task.status === 'failed' && (
            <div className="space-y-3" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }}>
              {task.error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                  <h4 className="text-sm font-medium text-destructive flex items-center gap-2">
                    <XCircle className="h-4 w-4" />
                    Ошибка
                  </h4>
                  <p className="mt-2 text-sm break-words">{task.error}</p>
                </div>
              )}

              {/* Diagnostics */}
              {events && events.length > 0 && (() => {
                const retryCount = events.filter(e => e.event_type === 'retried').length
                const lastEvent = events[events.length - 1]
                const diagEvents = events.filter(e =>
                  ['executor_spawn_failed', 'executor_no_ack', 'executor_fallback_tmux', 'stall_detected', 'dispatch_failed'].includes(e.event_type)
                )
                return (diagEvents.length > 0 || retryCount > 0) ? (
                  <div className="rounded-lg border border-border-subtle bg-bg-inset p-3 space-y-1.5">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Диагностика</h4>
                    {retryCount > 0 && (
                      <p className="text-xs text-muted-foreground">Попыток: {retryCount}</p>
                    )}
                    {diagEvents.map((de, i) => (
                      <p key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                        <span className="text-warning shrink-0">•</span>
                        <span className="break-words">{de.detail}</span>
                      </p>
                    ))}
                    <p className="text-xs text-muted-foreground/60">
                      Последнее событие: {eventTypeLabels[lastEvent.event_type] || lastEvent.event_type} — {timeAgo(lastEvent.created_at)}
                    </p>
                  </div>
                ) : null
              })()}

              {/* Retry actions */}
              <div className="grid grid-cols-1 gap-2.5 sm:flex sm:flex-wrap sm:items-center">
                {task.engineering_packet && (
                  <Button
                    onClick={() => onAction(task.id, 'retry', { strategy: 're-execute' })}
                    loading={isLoading('retry')}
                    className="w-full min-h-[44px] sm:w-auto sm:min-h-0"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Перезапустить
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => onAction(task.id, 'retry', { strategy: 're-interpret' })}
                  loading={isLoading('retry')}
                  className="w-full min-h-[44px] sm:w-auto sm:min-h-0"
                >
                  <RotateCcw className="h-4 w-4" />
                  Переанализировать
                </Button>
              </div>
            </div>
          )}

          {/* Draft — waiting for interpretation */}
          {task.status === 'draft' && (
            <div className="space-y-3" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }}>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                Анализируем задачу и готовим варианты...
              </div>
              <div className="grid grid-cols-1 gap-2.5 sm:flex sm:flex-wrap sm:gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onAction(task.id, 'interpret')}
                  loading={isLoading('interpret')}
                  className="min-h-[44px] sm:min-h-0"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Повторить
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onAction(task.id, 'cancel')}
                  loading={isLoading('cancel')}
                  className="min-h-[44px] sm:min-h-0"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Отменить
                </Button>
              </div>
            </div>
          )}

          {/* Event timeline (collapsible) */}
          {events && events.length > 0 && (
            <EventTimeline events={events} />
          )}
        </CardContent>
      )}
    </Card>
  )
}

// ── Option Card ─────────────────────────────────────────────

function OptionCard({
  option,
  isChosen,
  onChoose,
  isLoading,
}: {
  option: TaskOption
  isChosen: boolean
  onChoose: () => void
  isLoading: boolean
}) {
  return (
    <div
      className={`rounded-lg border p-3 sm:p-4 transition-colors ${
        isChosen
          ? 'border-primary bg-primary/5'
          : option.recommended
            ? 'border-success/40 bg-success/5'
            : 'border-border-subtle bg-bg-inset'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-muted-foreground/60">Вариант {option.id}</span>
            <span className="text-sm font-semibold">{option.title}</span>
            {option.recommended && (
              <Badge variant="success" className="text-[10px]">
                <ThumbsUp className="h-3 w-3" /> Рекомендован
              </Badge>
            )}
            {isChosen && (
              <Badge variant="info" className="text-[10px]">
                <CheckCircle2 className="h-3 w-3" /> Выбран
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">{option.description}</p>
        </div>
      </div>

      {/* Pros / Cons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
        {option.pros.length > 0 && (
          <div>
            <span className="text-[10px] font-medium uppercase text-success/80">Плюсы</span>
            <ul className="mt-0.5 space-y-0.5">
              {option.pros.map((pro, i) => (
                <li key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                  <span className="text-success shrink-0">+</span> {pro}
                </li>
              ))}
            </ul>
          </div>
        )}
        {option.cons.length > 0 && (
          <div>
            <span className="text-[10px] font-medium uppercase text-destructive/80">Минусы</span>
            <ul className="mt-0.5 space-y-0.5">
              {option.cons.map((con, i) => (
                <li key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                  <span className="text-destructive shrink-0">−</span> {con}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Tradeoff badges */}
      <div className="flex flex-wrap gap-2 mt-2 text-[10px]">
        <span className="px-1.5 py-0.5 rounded bg-bg-deep text-muted-foreground">
          Трудозатраты: {effortLabels[option.effort] || option.effort}
        </span>
        <span className="px-1.5 py-0.5 rounded bg-bg-deep text-muted-foreground">
          Скорость: {speedLabels[option.speed] || option.speed}
        </span>
        <span className={`px-1.5 py-0.5 rounded bg-bg-deep ${riskColors[option.risk] || 'text-muted-foreground'}`}>
          Риск: {riskLabels[option.risk] || option.risk}
        </span>
      </div>

      {/* Recommendation reason */}
      {option.recommended && option.recommendation_reason && (
        <p className="text-xs text-success/80 mt-2 italic">{option.recommendation_reason}</p>
      )}

      {/* Choose button */}
      {!isChosen && (
        <Button
          variant={option.recommended ? 'default' : 'outline'}
          size="sm"
          onClick={onChoose}
          loading={isLoading}
          className="mt-3 w-full min-h-[44px] sm:w-auto sm:min-h-0"
        >
          Выбрать этот вариант
        </Button>
      )}
    </div>
  )
}

// ── Phase Tracker ──────────────────────────────────────────────

function PhaseTracker({ phases }: { phases: TaskPhase[] }) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium flex items-center gap-2">
        <ListTodo className="h-4 w-4 text-muted-foreground" />
        Этапы выполнения
      </h4>
      <div className="space-y-1">
        {phases.map((phase, i) => {
          const doneSteps = phase.steps.filter(s => s.status === 'done').length
          const totalSteps = phase.steps.length

          return (
            <div key={i} className="rounded-lg border border-border-subtle overflow-hidden">
              {/* Phase header */}
              <div className={`flex items-center gap-2 px-3 py-2 text-sm ${
                phase.status === 'active' ? 'bg-primary/10 text-primary font-medium' :
                phase.status === 'done' ? 'bg-success/5 text-success/80' :
                phase.status === 'blocked' ? 'bg-destructive/5 text-destructive/80' :
                'bg-bg-inset text-muted-foreground'
              }`}>
                {phase.status === 'done' && <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />}
                {phase.status === 'active' && <CircleDot className="h-3.5 w-3.5 shrink-0 animate-pulse" />}
                {phase.status === 'pending' && <Clock className="h-3.5 w-3.5 shrink-0" />}
                {phase.status === 'blocked' && <Ban className="h-3.5 w-3.5 shrink-0" />}
                <span>{phase.name_ru}</span>
                {totalSteps > 0 && (
                  <span className="text-xs text-muted-foreground ml-auto">{doneSteps}/{totalSteps}</span>
                )}
              </div>

              {/* Steps (visible for active and done phases) */}
              {(phase.status === 'active' || phase.status === 'blocked') && phase.steps.length > 0 && (
                <div className="px-3 py-2 space-y-1 bg-bg-deep">
                  {phase.steps.map((step, j) => (
                    <div key={j} className={`flex items-start gap-2 text-xs ${
                      step.status === 'done' ? 'text-success/60' :
                      step.status === 'active' ? 'text-primary font-medium' :
                      'text-muted-foreground/50'
                    }`}>
                      {step.status === 'done' && <CheckCircle2 className="h-3 w-3 shrink-0 mt-0.5" />}
                      {step.status === 'active' && <CircleDot className="h-3 w-3 shrink-0 mt-0.5 animate-pulse" />}
                      {step.status === 'pending' && <Square className="h-3 w-3 shrink-0 mt-0.5" />}
                      {step.status === 'blocked' && <Ban className="h-3 w-3 shrink-0 mt-0.5" />}
                      <span>{step.text_ru}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Event Timeline ─────────────────────────────────────────────

function EventTimeline({ events }: { events: TaskEvent[] }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="mt-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <Clock className="h-4 w-4" />
        <span>История ({events.length})</span>
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {expanded && (
        <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
          {[...events].reverse().map((evt) => (
            <div key={evt.id} className="flex items-start gap-2 text-xs">
              <span className="text-muted-foreground/60 whitespace-nowrap shrink-0">{timeAgo(evt.created_at)}</span>
              <Badge variant="secondary" className="text-[10px] shrink-0">{eventTypeLabels[evt.event_type] || evt.event_type}</Badge>
              {evt.detail && <span className="text-muted-foreground break-words min-w-0">{evt.detail}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
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
