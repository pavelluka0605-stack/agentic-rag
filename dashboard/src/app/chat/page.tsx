'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Send,
  Mic,
  Plus,
  MessageSquare,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Clock,
  Zap,
  Shield,
  Play,
  RotateCcw,
  ListTodo,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loading } from '@/components/ui/loading'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'
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
  TaskProgress,
  TaskStatus,
  TaskEvent,
} from '@/types'

// ── Status config ──────────────────────────────────────────

const statusConfig: Record<TaskStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'info' }> = {
  draft: { label: 'Черновик', variant: 'secondary' },
  pending: { label: 'Ожидает', variant: 'warning' },
  confirmed: { label: 'Подтверждена', variant: 'info' },
  running: { label: 'Выполняется', variant: 'default' },
  review: { label: 'Проверка', variant: 'warning' },
  needs_manual_review: { label: 'Ручная проверка', variant: 'destructive' },
  done: { label: 'Готово', variant: 'success' },
  failed: { label: 'Ошибка', variant: 'destructive' },
  cancelled: { label: 'Отменена', variant: 'secondary' },
}

const statusIcon: Record<string, typeof CheckCircle2> = {
  done: CheckCircle2,
  failed: XCircle,
  running: Loader2,
  draft: Clock,
  pending: AlertTriangle,
  confirmed: Play,
  review: AlertTriangle,
  needs_manual_review: AlertTriangle,
  cancelled: XCircle,
}

// ── Main Chat Page ─────────────────────────────────────────

export default function ChatPage() {
  return (
    <Suspense>
      <ChatPageInner />
    </Suspense>
  )
}

function ChatPageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [tasks, setTasks] = useState<Task[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<number | null>(() => {
    const threadParam = searchParams.get('thread')
    return threadParam ? parseInt(threadParam, 10) || null : null
  })
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [taskEvents, setTaskEvents] = useState<TaskEvent[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [threadNotFound, setThreadNotFound] = useState(false)

  // Input
  const [inputText, setInputText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Voice
  const [recording, setRecording] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // ── Load tasks ──────────────────────────────────────────

  const loadTasks = useCallback(async () => {
    try {
      const data = await fetchTasks({ limit: 50 })
      setTasks(data)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTasks()
    const interval = setInterval(loadTasks, 5000)
    return () => clearInterval(interval)
  }, [loadTasks])

  // ── Load selected task detail ───────────────────────────

  const loadTaskDetail = useCallback(async (id: number) => {
    setDetailLoading(true)
    setThreadNotFound(false)
    try {
      const task = await fetchTask(id, { events: true }) as Task & { events?: TaskEvent[] }
      setSelectedTask(task)
      setTaskEvents(task.events || [])
    } catch (err) {
      // If thread not found (404), show graceful error
      if (String(err).includes('404') || String(err).includes('not found')) {
        setThreadNotFound(true)
      }
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedId != null) {
      loadTaskDetail(selectedId)
      const interval = setInterval(() => loadTaskDetail(selectedId), 5000)
      return () => clearInterval(interval)
    } else {
      setSelectedTask(null)
      setTaskEvents([])
    }
  }, [selectedId, loadTaskDetail])

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [taskEvents, selectedTask])

  // ── Create new task ─────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!inputText.trim() || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const task = await createTask({ raw_input: inputText.trim() })
      setInputText('')
      await taskAction(task.id, 'interpret')
      await loadTasks()
      setSelectedId(task.id)
      router.replace(`/chat?thread=${task.id}`, { scroll: false })
    } catch (err) {
      setError(`Ошибка: ${err}`)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Task action ─────────────────────────────────────────

  async function handleAction(action: string, data?: Record<string, unknown>) {
    if (!selectedId) return
    setActionLoading(action)
    try {
      await taskAction(selectedId, action, data)
      await loadTasks()
      await loadTaskDetail(selectedId)
    } catch (err) {
      setError(`Ошибка: ${err}`)
    } finally {
      setActionLoading(null)
    }
  }

  // ── Voice ───────────────────────────────────────────────

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
        if (blob.size > 10 * 1024 * 1024) {
          setError('Запись слишком длинная (макс. 10 МБ)')
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
          setSelectedId(task.id)
          await loadTasks()
        } catch (err) {
          setError(`Ошибка: ${err}`)
        } finally {
          setSubmitting(false)
        }
      }
      recorder.start()
      setMediaRecorder(recorder)
      setRecording(true)
    } catch (err) {
      setError(`Микрофон: ${err}`)
    }
  }

  // ── Select thread ───────────────────────────────────────

  function selectThread(id: number) {
    setSelectedId(id)
    setError(null)
    setThreadNotFound(false)
    router.replace(`/chat?thread=${id}`, { scroll: false })
  }

  function goBack() {
    setSelectedId(null)
    setSelectedTask(null)
    setTaskEvents([])
    setError(null)
    setThreadNotFound(false)
    router.replace('/chat', { scroll: false })
  }

  // ── Render ──────────────────────────────────────────────

  const isLoading = (action: string) => actionLoading === action
  const interpretation = selectedTask ? parseJsonField<TaskInterpretation>(selectedTask.interpretation) : null
  const progress = selectedTask ? parseJsonField<TaskProgress[]>(selectedTask.progress) : null

  // Full-bleed: negate AppShell padding, fill height
  return (
    <div className="flex h-[calc(100dvh-3.5rem)] min-w-0 overflow-hidden">

      {/* ── Thread list (left panel) ───────────────────── */}
      <div
        className={cn(
          'flex min-w-0 flex-col border-r border-border-subtle bg-bg-deep',
          // Mobile: full width when no thread selected, hidden when thread selected
          selectedId != null ? 'hidden md:flex' : 'flex w-full',
          // Desktop: fixed width
          'md:w-80 md:shrink-0'
        )}
      >
        {/* Thread list header */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border-subtle px-4">
          <h2 className="text-sm font-semibold">Чаты</h2>
          <button
            onClick={() => { setSelectedId(null); textareaRef.current?.focus() }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            title="Новый чат"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* Thread list body */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <Loading size="sm" />
            </div>
          ) : !tasks || tasks.length === 0 ? (
            <div className="px-4 py-8">
              <EmptyState
                icon={MessageSquare}
                title="Нет чатов"
                description="Напишите сообщение, чтобы начать"
              />
            </div>
          ) : (
            <div className="divide-y divide-border-subtle/50">
              {tasks.map((task) => {
                const cfg = statusConfig[task.status] || { label: task.status, variant: 'secondary' as const }
                const Icon = statusIcon[task.status] || MessageSquare
                const isActive = selectedId === task.id
                return (
                  <button
                    key={task.id}
                    onClick={() => selectThread(task.id)}
                    className={cn(
                      'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors',
                      isActive
                        ? 'bg-primary/10 border-l-2 border-l-primary'
                        : 'hover:bg-[oklch(0.175_0.008_260)]'
                    )}
                  >
                    <Icon className={cn(
                      'mt-0.5 h-4 w-4 shrink-0',
                      task.status === 'running' && 'animate-spin text-primary',
                      task.status === 'done' && 'text-success',
                      task.status === 'failed' && 'text-destructive',
                      !['running', 'done', 'failed'].includes(task.status) && 'text-muted-foreground'
                    )} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {truncate(task.raw_input, 60)}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <Badge variant={cfg.variant} className="text-[10px] px-1.5 py-0">
                          {cfg.label}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">
                          {timeAgo(task.created_at)}
                        </span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* New chat input at bottom of thread list */}
        <div className="shrink-0 border-t border-border-subtle p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {error && selectedId == null && (
            <div className="mb-2 rounded-lg border border-destructive/50 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {error}
              <button onClick={() => setError(null)} className="ml-2 underline">Скрыть</button>
            </div>
          )}
          <form onSubmit={handleSubmit} className="flex gap-2">
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Новое сообщение..."
              rows={1}
              className="min-w-0 flex-1 resize-none rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit(e)
              }}
            />
            <Button type="submit" size="sm" disabled={!inputText.trim() || submitting} loading={submitting}>
              <Send className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant={recording ? 'destructive' : 'outline'}
              size="sm"
              onClick={handleVoiceToggle}
              disabled={submitting}
            >
              <Mic className={cn('h-4 w-4', recording && 'animate-pulse')} />
            </Button>
          </form>
        </div>
      </div>

      {/* ── Chat area (right panel) ────────────────────── */}
      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col bg-bg-surface',
          // Mobile: full width when thread selected, hidden when not
          selectedId != null ? 'flex' : 'hidden md:flex'
        )}
      >
        {selectedId == null ? (
          /* ── Empty state / new task form ──────────────── */
          <div className="flex flex-1 flex-col items-center justify-center p-6">
            <div className="w-full max-w-lg space-y-6">
              <div className="text-center">
                <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground/30" />
                <h2 className="mt-3 text-lg font-semibold">Новый чат</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Напишите сообщение — Claude разберётся
                </p>
              </div>
              <form onSubmit={handleSubmit} className="space-y-3">
                <textarea
                  ref={textareaRef}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Напишите сообщение..."
                  rows={3}
                  className="w-full resize-none rounded-lg border border-border-subtle bg-bg-deep px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit(e)
                  }}
                />
                <div className="flex items-center gap-2">
                  <Button type="submit" disabled={!inputText.trim() || submitting} loading={submitting} className="flex-1">
                    <Send className="h-4 w-4" />
                    Отправить
                  </Button>
                  <Button
                    type="button"
                    variant={recording ? 'destructive' : 'outline'}
                    onClick={handleVoiceToggle}
                    disabled={submitting}
                  >
                    <Mic className={cn('h-4 w-4', recording && 'animate-pulse')} />
                  </Button>
                </div>
                <p className="text-center text-xs text-muted-foreground">
                  Ctrl+Enter для отправки
                </p>
              </form>
            </div>
          </div>
        ) : (
          /* ── Thread detail view ──────────────────────── */
          <>
            {/* Chat header */}
            <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border-subtle px-4">
              {/* Back button: visible on mobile only */}
              <button
                onClick={goBack}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground md:hidden"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {selectedTask ? truncate(selectedTask.raw_input, 80) : '...'}
                </p>
                {selectedTask && (
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={statusConfig[selectedTask.status]?.variant || 'secondary'}
                      className="text-[10px] px-1.5 py-0"
                    >
                      {statusConfig[selectedTask.status]?.label || selectedTask.status}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">
                      {timeAgo(selectedTask.created_at)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {threadNotFound ? (
                <div className="flex flex-1 flex-col items-center justify-center py-16">
                  <MessageSquare className="h-12 w-12 text-muted-foreground/30" />
                  <h3 className="mt-3 text-sm font-medium">Чат не найден</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Чат #{selectedId} не существует или был удалён
                  </p>
                  <Button size="sm" variant="outline" className="mt-4" onClick={goBack}>
                    <ArrowLeft className="h-3.5 w-3.5" /> К списку чатов
                  </Button>
                </div>
              ) : detailLoading && !selectedTask ? (
                <div className="flex h-32 items-center justify-center">
                  <Loading size="sm" />
                </div>
              ) : selectedTask ? (
                <>
                  {/* Original request */}
                  <ChatBubble role="user" time={selectedTask.created_at}>
                    {selectedTask.raw_input}
                    {selectedTask.voice_transcript && (
                      <p className="mt-1 text-xs text-muted-foreground italic">
                        (голосовой ввод)
                      </p>
                    )}
                  </ChatBubble>

                  {/* Interpretation */}
                  {interpretation && (
                    <ChatBubble role="assistant" time={selectedTask.updated_at}>
                      <div className="space-y-2">
                        <p className="font-medium text-xs uppercase tracking-wider text-muted-foreground/70">
                          Как понята задача
                        </p>
                        <p>{interpretation.understood}</p>
                        {interpretation.plan.length > 0 && (
                          <div className="mt-2">
                            <p className="font-medium text-xs uppercase tracking-wider text-muted-foreground/70 mb-1">
                              План
                            </p>
                            <ol className="list-decimal list-inside space-y-0.5 text-sm">
                              {interpretation.plan.map((step, i) => (
                                <li key={i}>{step}</li>
                              ))}
                            </ol>
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-muted-foreground">
                            Риск: {interpretation.risk_level === 'low' ? 'Низкий' : interpretation.risk_level === 'medium' ? 'Средний' : 'Высокий'}
                          </span>
                        </div>
                      </div>
                    </ChatBubble>
                  )}

                  {/* Progress updates */}
                  {progress && progress.map((p, i) => (
                    <ChatBubble key={`progress-${i}`} role="system">
                      <div className="flex items-center gap-2 text-sm">
                        <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />
                        <span>{p.message_ru}</span>
                        {p.pct != null && (
                          <Badge variant="secondary" className="text-[10px]">{p.pct}%</Badge>
                        )}
                      </div>
                    </ChatBubble>
                  ))}

                  {/* Event log */}
                  {taskEvents.map((evt) => (
                    <ChatBubble key={evt.id} role="system" time={evt.created_at}>
                      <div className="flex items-center gap-2 text-sm">
                        <Badge variant="secondary" className="text-[10px] shrink-0">{evt.event_type}</Badge>
                        {evt.detail && <span className="text-muted-foreground">{evt.detail}</span>}
                      </div>
                    </ChatBubble>
                  ))}

                  {/* Result */}
                  {selectedTask.status === 'done' && selectedTask.result_summary_ru && (
                    <ChatBubble role="assistant">
                      <div className="rounded-lg border border-success/30 bg-success/5 p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <CheckCircle2 className="h-4 w-4 text-success" />
                          <span className="text-sm font-medium text-success">Результат</span>
                        </div>
                        <p className="text-sm">{selectedTask.result_summary_ru}</p>
                      </div>
                    </ChatBubble>
                  )}

                  {/* Error */}
                  {selectedTask.status === 'failed' && selectedTask.error && (
                    <ChatBubble role="assistant">
                      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <XCircle className="h-4 w-4 text-destructive" />
                          <span className="text-sm font-medium text-destructive">Ошибка</span>
                        </div>
                        <p className="text-sm">{selectedTask.error}</p>
                      </div>
                    </ChatBubble>
                  )}

                  <div ref={messagesEndRef} />
                </>
              ) : null}
            </div>

            {/* Action bar at bottom */}
            <div className="shrink-0 border-t border-border-subtle bg-bg-deep p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {error && (
                <div className="mb-2 rounded-lg border border-destructive/50 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  {error}
                  <button onClick={() => setError(null)} className="ml-2 underline">Скрыть</button>
                </div>
              )}

              {/* Pending: confirm / cancel */}
              {selectedTask?.status === 'pending' && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => handleAction('confirm', { mode: 'safe' })} loading={isLoading('confirm')}>
                    <Shield className="h-3.5 w-3.5" /> Подтвердить
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleAction('confirm', { mode: 'fast' })} loading={isLoading('confirm')}>
                    <Zap className="h-3.5 w-3.5" /> Быстрый
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleAction('cancel')} loading={isLoading('cancel')}>
                    <XCircle className="h-3.5 w-3.5" /> Отменить
                  </Button>
                </div>
              )}

              {/* Confirmed: execute */}
              {selectedTask?.status === 'confirmed' && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleAction('start')} loading={isLoading('start')}>
                    <Play className="h-3.5 w-3.5" /> Запустить
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleAction('cancel')} loading={isLoading('cancel')}>
                    <XCircle className="h-3.5 w-3.5" /> Отменить
                  </Button>
                </div>
              )}

              {/* Review: approve / reject */}
              {selectedTask?.status === 'review' && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => handleAction('complete', { result_summary_ru: 'Проверка пройдена' })} loading={isLoading('complete')}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Принять
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleAction('request-review', { reason: 'Ручная проверка' })} loading={isLoading('request-review')}>
                    <AlertTriangle className="h-3.5 w-3.5" /> Ручная проверка
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleAction('fail', { error: 'Отклонено' })} loading={isLoading('fail')}>
                    <XCircle className="h-3.5 w-3.5" /> Отклонить
                  </Button>
                </div>
              )}

              {/* Draft: retry interpret */}
              {selectedTask?.status === 'draft' && (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Анализируем...</span>
                  <Button size="sm" variant="outline" onClick={() => handleAction('interpret')} loading={isLoading('interpret')}>
                    <RotateCcw className="h-3.5 w-3.5" /> Повторить
                  </Button>
                </div>
              )}

              {/* Needs manual review */}
              {selectedTask?.status === 'needs_manual_review' && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => handleAction('complete', { result_summary_ru: 'Решено вручную' })} loading={isLoading('complete')}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Решено
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleAction('fail', { error: 'Не решено' })} loading={isLoading('fail')}>
                    <XCircle className="h-3.5 w-3.5" /> Не решено
                  </Button>
                </div>
              )}

              {/* Done/failed/cancelled: new task input */}
              {(selectedTask?.status === 'done' || selectedTask?.status === 'failed' || selectedTask?.status === 'cancelled' || !selectedTask) && selectedId != null && (
                <form onSubmit={handleSubmit} className="flex gap-2">
                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Следующее сообщение..."
                    rows={1}
                    className="min-w-0 flex-1 resize-none rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit(e)
                    }}
                  />
                  <Button type="submit" size="sm" disabled={!inputText.trim() || submitting} loading={submitting}>
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Chat Bubble ───────────────────────────────────────────

function ChatBubble({
  role,
  time,
  children,
}: {
  role: 'user' | 'assistant' | 'system'
  time?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'flex',
        role === 'user' ? 'justify-end' : 'justify-start',
        role === 'system' && 'justify-center'
      )}
    >
      <div
        className={cn(
          'max-w-[85%] rounded-xl px-4 py-2.5 text-sm',
          role === 'user' && 'bg-primary/15 text-foreground',
          role === 'assistant' && 'bg-bg-elevated text-foreground',
          role === 'system' && 'bg-transparent text-muted-foreground text-xs max-w-full'
        )}
      >
        {children}
        {time && role !== 'system' && (
          <p className="mt-1 text-[10px] text-muted-foreground/60">
            {timeAgo(time)}
          </p>
        )}
      </div>
    </div>
  )
}
