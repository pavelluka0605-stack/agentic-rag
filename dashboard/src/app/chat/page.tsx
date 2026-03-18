'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Send,
  Plus,
  MessageSquare,
  Loader2,
  ListTodo,
  CheckCircle2,
  ThumbsUp,
  ThumbsDown,
  HelpCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loading } from '@/components/ui/loading'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'
import { timeAgo, truncate, parseJsonField } from '@/lib/utils'
import {
  fetchChatThreads,
  fetchChatThread,
  fetchChatMessages,
  createChatThread,
  sendChatMessage,
  createTaskFromChat,
} from '@/lib/api-client'
import type { ChatThread, ChatMessage, ChatMessageMeta } from '@/types'

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

  const [threads, setThreads] = useState<ChatThread[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<number | null>(() => {
    const p = searchParams.get('thread')
    return p ? parseInt(p, 10) || null : null
  })
  const [selectedThread, setSelectedThread] = useState<ChatThread | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [threadNotFound, setThreadNotFound] = useState(false)

  const [inputText, setInputText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [taskCreating, setTaskCreating] = useState<string | null>(null) // "msgId-proposalIdx"

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // ── Load threads ──────────────────────────────────────

  const loadThreads = useCallback(async () => {
    try {
      setThreads(await fetchChatThreads({ limit: 50 }))
    } catch { /* silent */ } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadThreads()
    const interval = setInterval(loadThreads, 10000)
    return () => clearInterval(interval)
  }, [loadThreads])

  // ── Load thread + messages ────────────────────────────

  const loadThread = useCallback(async (id: number) => {
    setDetailLoading(true)
    setThreadNotFound(false)
    try {
      const [thread, msgs] = await Promise.all([
        fetchChatThread(id),
        fetchChatMessages(id),
      ])
      setSelectedThread(thread)
      setMessages(msgs)
    } catch (err) {
      if (String(err).includes('404') || String(err).includes('not found')) {
        setThreadNotFound(true)
      }
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedId != null) {
      loadThread(selectedId)
    } else {
      setSelectedThread(null)
      setMessages([])
    }
  }, [selectedId, loadThread])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Send message ──────────────────────────────────────

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const text = inputText.trim()
    if (!text || submitting) return
    setSubmitting(true)
    setError(null)

    try {
      if (selectedId != null) {
        const result = await sendChatMessage(selectedId, 'user', text)
        // API returns { userMessage, assistantMessage } for user messages
        if ('userMessage' in result) {
          setMessages(prev => [
            ...prev,
            result.userMessage,
            ...(result.assistantMessage ? [result.assistantMessage] : []),
          ])
        } else {
          setMessages(prev => [...prev, result as ChatMessage])
        }
        setInputText('')
        await loadThreads()
      } else {
        // Create new thread — API returns thread + assistant reply
        const { thread, assistantMessage } = await createChatThread(text)
        setInputText('')
        await loadThreads()
        setSelectedId(thread.id)
        router.replace(`/chat?thread=${thread.id}`, { scroll: false })
        // Load the full message list (user msg + assistant reply)
        if (thread.id) {
          const msgs = await fetchChatMessages(thread.id)
          setMessages(msgs)
          setSelectedThread(thread)
        }
      }
    } catch (err) {
      setError(`Ошибка: ${err}`)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Create task from proposal ─────────────────────────

  async function handleCreateTask(messageId: number, proposalIndex: number, description: string) {
    if (!selectedId) return
    const key = `${messageId}-${proposalIndex}`
    setTaskCreating(key)
    try {
      await createTaskFromChat(selectedId, messageId, proposalIndex, description)
      // Reload messages to see the system message about task creation
      const msgs = await fetchChatMessages(selectedId)
      setMessages(msgs)
      await loadThreads()
    } catch (err) {
      setError(`Ошибка создания задачи: ${err}`)
    } finally {
      setTaskCreating(null)
    }
  }

  // ── Navigation ────────────────────────────────────────

  function selectThread(id: number) {
    setSelectedId(id)
    setError(null)
    setThreadNotFound(false)
    router.replace(`/chat?thread=${id}`, { scroll: false })
  }

  function goBack() {
    setSelectedId(null)
    setSelectedThread(null)
    setMessages([])
    setError(null)
    setThreadNotFound(false)
    router.replace('/chat', { scroll: false })
  }

  // ── Render ────────────────────────────────────────────

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] min-w-0 overflow-hidden">

      {/* ── Thread list ────────────────────────────────── */}
      <div
        className={cn(
          'flex min-w-0 flex-col border-r border-border-subtle bg-bg-deep',
          selectedId != null ? 'hidden md:flex' : 'flex w-full',
          'md:w-80 md:shrink-0'
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border-subtle px-4">
          <h2 className="text-sm font-semibold">Чаты</h2>
          <button
            onClick={() => { goBack(); textareaRef.current?.focus() }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            title="Новый чат"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex h-32 items-center justify-center"><Loading size="sm" /></div>
          ) : !threads || threads.length === 0 ? (
            <div className="px-4 py-8">
              <EmptyState icon={MessageSquare} title="Нет чатов" description="Напишите сообщение, чтобы начать" />
            </div>
          ) : (
            <div className="divide-y divide-border-subtle/50">
              {threads.map((thread) => (
                <button
                  key={thread.id}
                  onClick={() => selectThread(thread.id)}
                  className={cn(
                    'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors',
                    selectedId === thread.id ? 'bg-primary/10 border-l-2 border-l-primary' : 'hover:bg-[oklch(0.175_0.008_260)]'
                  )}
                >
                  <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{thread.title || 'Новый чат'}</p>
                    <div className="mt-1 flex items-center gap-2">
                      {thread.last_message && (
                        <span className="truncate text-[11px] text-muted-foreground">{truncate(thread.last_message, 40)}</span>
                      )}
                      <span className="shrink-0 text-[11px] text-muted-foreground/60">{timeAgo(thread.updated_at)}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-border-subtle p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {error && selectedId == null && (
            <div className="mb-2 rounded-lg border border-destructive/50 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {error}
              <button onClick={() => setError(null)} className="ml-2 underline">Скрыть</button>
            </div>
          )}
          <form onSubmit={handleSend} className="flex gap-2">
            <textarea
              ref={textareaRef}
              value={selectedId == null ? inputText : ''}
              onChange={(e) => { if (selectedId == null) setInputText(e.target.value) }}
              placeholder="Новое сообщение..."
              rows={1}
              disabled={selectedId != null}
              className="min-w-0 flex-1 resize-none rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30 disabled:opacity-50"
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend(e) }}
            />
            <Button type="submit" size="sm" disabled={selectedId != null || !inputText.trim() || submitting} loading={submitting}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>

      {/* ── Chat area ──────────────────────────────────── */}
      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col bg-bg-surface',
          selectedId != null ? 'flex' : 'hidden md:flex'
        )}
      >
        {selectedId == null ? (
          <div className="flex flex-1 flex-col items-center justify-center p-6">
            <div className="w-full max-w-lg space-y-6">
              <div className="text-center">
                <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground/30" />
                <h2 className="mt-3 text-lg font-semibold">Новый чат</h2>
                <p className="mt-1 text-sm text-muted-foreground">Напишите сообщение — Claude разберётся</p>
              </div>
              <form onSubmit={handleSend} className="space-y-3">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Напишите сообщение..."
                  rows={3}
                  className="w-full resize-none rounded-lg border border-border-subtle bg-bg-deep px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend(e) }}
                />
                <Button type="submit" disabled={!inputText.trim() || submitting} loading={submitting} className="w-full">
                  <Send className="h-4 w-4" /> Отправить
                </Button>
              </form>
            </div>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border-subtle px-4">
              <button onClick={goBack} className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground md:hidden">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{selectedThread?.title || '...'}</p>
                <span className="text-[11px] text-muted-foreground">{selectedThread ? `${selectedThread.message_count} сообщ.` : ''}</span>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {threadNotFound ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <MessageSquare className="h-12 w-12 text-muted-foreground/30" />
                  <h3 className="mt-3 text-sm font-medium">Чат не найден</h3>
                  <p className="mt-1 text-xs text-muted-foreground">Чат #{selectedId} не существует или был удалён</p>
                  <Button size="sm" variant="outline" className="mt-4" onClick={goBack}>
                    <ArrowLeft className="h-3.5 w-3.5" /> К списку чатов
                  </Button>
                </div>
              ) : detailLoading && messages.length === 0 ? (
                <div className="flex h-32 items-center justify-center"><Loading size="sm" /></div>
              ) : (
                <>
                  {messages.map((msg) => (
                    <ChatBubble
                      key={msg.id}
                      message={msg}
                      onCreateTask={handleCreateTask}
                      taskCreating={taskCreating}
                    />
                  ))}
                  {submitting && (
                    <div className="flex justify-start">
                      <div className="flex items-center gap-2 rounded-xl bg-bg-elevated px-4 py-2.5 text-sm text-muted-foreground">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Думаю...
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input */}
            <div className="shrink-0 border-t border-border-subtle bg-bg-deep p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {error && (
                <div className="mb-2 rounded-lg border border-destructive/50 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  {error}
                  <button onClick={() => setError(null)} className="ml-2 underline">Скрыть</button>
                </div>
              )}
              <form onSubmit={handleSend} className="flex gap-2">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Напишите сообщение..."
                  rows={1}
                  className="min-w-0 flex-1 resize-none rounded-lg border border-border-subtle bg-bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                  onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend(e) }}
                />
                <Button type="submit" size="sm" disabled={!inputText.trim() || submitting} loading={submitting}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Chat Bubble ───────────────────────────────────────────

function ChatBubble({
  message,
  onCreateTask,
  taskCreating,
}: {
  message: ChatMessage
  onCreateTask: (messageId: number, proposalIndex: number, description: string) => void
  taskCreating: string | null
}) {
  const { role, content, metadata: metaStr, task_id } = message
  const meta = parseJsonField<ChatMessageMeta>(metaStr ?? null)

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
        <div className="whitespace-pre-wrap">{content}</div>

        {/* Render proposals if this is a task-request response */}
        {meta && meta.is_task_request && meta.proposals.length > 0 && (
          <div className="mt-3 space-y-2 border-t border-border-subtle/50 pt-3">
            <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
              <ListTodo className="h-3.5 w-3.5" />
              Варианты решения
            </p>
            {meta.proposals.map((proposal, i) => {
              const isCreating = taskCreating === `${message.id}-${i}`
              const alreadyLinked = task_id != null
              return (
                <div key={i} className="rounded-lg border border-border-subtle/50 bg-bg-deep/50 p-3 space-y-1.5">
                  <p className="text-sm font-medium">{proposal.title}</p>
                  <p className="text-xs text-muted-foreground">{proposal.description}</p>
                  {proposal.pros.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {proposal.pros.map((p, j) => (
                        <span key={j} className="inline-flex items-center gap-1 text-[10px] text-success">
                          <ThumbsUp className="h-2.5 w-2.5" /> {p}
                        </span>
                      ))}
                    </div>
                  )}
                  {proposal.cons.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {proposal.cons.map((c, j) => (
                        <span key={j} className="inline-flex items-center gap-1 text-[10px] text-warning">
                          <ThumbsDown className="h-2.5 w-2.5" /> {c}
                        </span>
                      ))}
                    </div>
                  )}
                  {!alreadyLinked && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-1.5"
                      onClick={() => onCreateTask(message.id, i, `${proposal.title}: ${proposal.description}`)}
                      loading={isCreating}
                      disabled={!!taskCreating}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Создать задачу
                    </Button>
                  )}
                  {alreadyLinked && (
                    <Badge variant="success" className="mt-1.5">
                      <CheckCircle2 className="h-3 w-3" /> Задача создана
                    </Badge>
                  )}
                </div>
              )
            })}

            {meta.missing.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {meta.missing.map((m, i) => (
                  <span key={i} className="inline-flex items-center gap-1 text-[10px] text-info">
                    <HelpCircle className="h-2.5 w-2.5" /> {m}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {message.created_at && role !== 'system' && (
          <p className="mt-1 text-[10px] text-muted-foreground/60">{timeAgo(message.created_at)}</p>
        )}
      </div>
    </div>
  )
}
