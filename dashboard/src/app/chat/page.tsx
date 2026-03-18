'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import {
  Send,
  Plus,
  MessageSquare,
  Loader2,
  Trash2,
  ArrowRight,
  ListTodo,
  ChevronLeft,
  Mic,
  MicOff,
  Paperclip,
  CheckCircle2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { timeAgo, truncate, parseJsonField } from '@/lib/utils'
import {
  fetchChatThreads,
  fetchChatMessages,
  createChatThread,
  sendChatMessage,
  deleteChatThread,
} from '@/lib/api-client'
import type { ChatThread, ChatMessage, TaskProposal } from '@/types'

// ── Task Proposal Card ──────────────────────────────────────────

function TaskProposalCard({
  proposal,
  onSubmitTask,
  submitting,
}: {
  proposal: TaskProposal
  onSubmitTask: (optionId: string) => void
  submitting: boolean
}) {
  return (
    <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-primary">
        <ListTodo className="h-4 w-4" />
        Предложение задачи
      </div>

      <p className="mb-3 text-sm text-foreground/80">{proposal.understood}</p>

      <div className="space-y-2">
        {proposal.options.map((opt) => (
          <div
            key={opt.id}
            className="rounded-md border border-border/50 bg-bg-deep/50 p-3"
          >
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm font-medium">{opt.title}</span>
              <Badge variant="secondary" className="text-[10px]">
                {opt.effort === 'low' ? 'Просто' : opt.effort === 'medium' ? 'Средне' : 'Сложно'}
              </Badge>
            </div>
            <p className="mb-2 text-xs text-muted-foreground">{opt.description}</p>

            {(opt.pros.length > 0 || opt.cons.length > 0) && (
              <div className="mb-2 grid grid-cols-2 gap-2 text-xs">
                {opt.pros.length > 0 && (
                  <div>
                    {opt.pros.map((p, i) => (
                      <div key={i} className="text-success">+ {p}</div>
                    ))}
                  </div>
                )}
                {opt.cons.length > 0 && (
                  <div>
                    {opt.cons.map((c, i) => (
                      <div key={i} className="text-destructive">- {c}</div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {proposal.ready_to_submit && (
              <Button
                size="sm"
                onClick={() => onSubmitTask(opt.id)}
                disabled={submitting}
                className="mt-1"
              >
                {submitting ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <ArrowRight className="mr-1 h-3 w-3" />
                )}
                Отправить в работу
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Message Bubble ──────────────────────────────────────────────

function MessageBubble({
  message,
  onSubmitTask,
  submitting,
}: {
  message: ChatMessage
  onSubmitTask: (optionId: string) => void
  submitting: boolean
}) {
  const isUser = message.role === 'user'
  const proposal = parseJsonField<TaskProposal>(message.task_proposal)

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-[oklch(0.18_0.008_260)] text-foreground'
        }`}
      >
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>

        {proposal && (
          <TaskProposalCard
            proposal={proposal}
            onSubmitTask={onSubmitTask}
            submitting={submitting}
          />
        )}

        <div
          className={`mt-1 text-right text-[10px] ${
            isUser ? 'text-primary-foreground/50' : 'text-muted-foreground/50'
          }`}
        >
          {timeAgo(message.created_at)}
        </div>
      </div>
    </div>
  )
}

// ── Thread List Item ────────────────────────────────────────────

function ThreadItem({
  thread,
  active,
  onClick,
  onDelete,
}: {
  thread: ChatThread
  active: boolean
  onClick: () => void
  onDelete: () => void
}) {
  return (
    <div
      onClick={onClick}
      className={`group relative cursor-pointer rounded-lg px-3 py-2.5 transition-colors ${
        active
          ? 'bg-primary/10 text-foreground'
          : 'text-muted-foreground hover:bg-[oklch(0.175_0.008_260)] hover:text-foreground'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {thread.title || 'Новый чат'}
          </p>
          {thread.last_message_preview && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground/60">
              {truncate(thread.last_message_preview, 50)}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-[10px] text-muted-foreground/40">
            {timeAgo(thread.updated_at)}
          </span>
          {thread.message_count > 0 && (
            <Badge variant="secondary" className="text-[9px] px-1 py-0">
              {thread.message_count}
            </Badge>
          )}
        </div>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        className="absolute right-1 top-1 hidden rounded p-1 text-muted-foreground/40 hover:bg-destructive/10 hover:text-destructive group-hover:block"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  )
}

// ── Main Chat Page ──────────────────────────────────────────────

export default function ChatPage() {
  // State
  const [threads, setThreads] = useState<ChatThread[]>([])
  const [activeThreadId, setActiveThreadId] = useState<number | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [submittingTask, setSubmittingTask] = useState(false)
  const [showSidebar, setShowSidebar] = useState(true)
  const [recording, setRecording] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Load threads
  const loadThreads = useCallback(async () => {
    try {
      const data = await fetchChatThreads()
      setThreads(data)
    } catch (err) {
      console.error('Failed to load threads:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadThreads()
  }, [loadThreads])

  // Load messages when thread changes
  useEffect(() => {
    if (!activeThreadId) {
      setMessages([])
      return
    }

    let cancelled = false
    async function load() {
      try {
        const msgs = await fetchChatMessages(activeThreadId!)
        if (!cancelled) setMessages(msgs)
      } catch (err) {
        console.error('Failed to load messages:', err)
      }
    }
    load()
    return () => { cancelled = true }
  }, [activeThreadId])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Create new thread
  const handleNewThread = async () => {
    try {
      const thread = await createChatThread()
      setThreads((prev) => [thread, ...prev])
      setActiveThreadId(thread.id)
      setMessages([])
      inputRef.current?.focus()
    } catch (err) {
      console.error('Failed to create thread:', err)
    }
  }

  // Send message
  const handleSend = async () => {
    const text = input.trim()
    if (!text || sending) return

    let threadId = activeThreadId

    // Auto-create thread if none
    if (!threadId) {
      try {
        const thread = await createChatThread()
        setThreads((prev) => [thread, ...prev])
        threadId = thread.id
        setActiveThreadId(threadId)
      } catch {
        return
      }
    }

    setSending(true)
    setInput('')

    try {
      // Send user message
      const userMsg = await sendChatMessage(threadId, {
        role: 'user',
        content: text,
      })
      setMessages((prev) => [...prev, userMsg])

      // Simulate assistant response (in production this calls LLM)
      const assistantMsg = await sendChatMessage(threadId, {
        role: 'assistant',
        content: `Принято. Я обработаю ваш запрос:\n\n"${truncate(text, 200)}"\n\nФормирую понимание задачи...`,
      })
      setMessages((prev) => [...prev, assistantMsg])

      // Refresh thread list
      loadThreads()
    } catch (err) {
      console.error('Failed to send message:', err)
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  // Delete thread
  const handleDeleteThread = async (id: number) => {
    try {
      await deleteChatThread(id)
      setThreads((prev) => prev.filter((t) => t.id !== id))
      if (activeThreadId === id) {
        setActiveThreadId(null)
        setMessages([])
      }
    } catch (err) {
      console.error('Failed to delete thread:', err)
    }
  }

  // Submit task from proposal
  const handleSubmitTask = async (optionId: string) => {
    setSubmittingTask(true)
    try {
      // In production: create task via API, link to thread
      const msg = await sendChatMessage(activeThreadId!, {
        role: 'assistant',
        content: `Задача создана и отправлена исполнителю (вариант: ${optionId}). Вы можете отслеживать прогресс на экране "Задачи".`,
      })
      setMessages((prev) => [...prev, msg])
    } catch (err) {
      console.error('Failed to submit task:', err)
    } finally {
      setSubmittingTask(false)
    }
  }

  // Key handler
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Toggle voice recording (placeholder)
  const toggleRecording = () => {
    setRecording(!recording)
  }

  const activeThread = threads.find((t) => t.id === activeThreadId)

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* ── Sidebar: Thread List ── */}
      <div
        className={`flex flex-col border-r border-border-subtle bg-bg-deep transition-all duration-200 ${
          showSidebar ? 'w-72' : 'w-0 overflow-hidden'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Чаты</h2>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleNewThread}
            title="Новый чат"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Thread list */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : threads.length === 0 ? (
            <div className="px-2 py-8 text-center text-xs text-muted-foreground/50">
              Нет чатов. Создайте новый.
            </div>
          ) : (
            <div className="space-y-0.5">
              {threads.map((thread) => (
                <ThreadItem
                  key={thread.id}
                  thread={thread}
                  active={thread.id === activeThreadId}
                  onClick={() => setActiveThreadId(thread.id)}
                  onDelete={() => handleDeleteThread(thread.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Main Chat Area ── */}
      <div className="flex flex-1 flex-col">
        {/* Chat header */}
        <div className="flex items-center gap-3 border-b border-border-subtle px-4 py-2.5">
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="rounded p-1 text-muted-foreground hover:bg-[oklch(0.175_0.008_260)] hover:text-foreground md:hidden"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <span className="flex-1 truncate text-sm font-medium">
            {activeThread?.title || 'Новый чат'}
          </span>

          {activeThread && (
            <div className="flex items-center gap-2">
              {/* Linked tasks indicator */}
              {activeThread.linked_task_ids && activeThread.linked_task_ids !== '[]' && (
                <Link href="/tasks">
                  <Badge variant="info" className="cursor-pointer text-[10px]">
                    <ListTodo className="mr-1 h-3 w-3" />
                    Задачи
                  </Badge>
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {!activeThreadId ? (
            <EmptyState
              icon={MessageSquare}
              title="Начните общение"
              description="Выберите чат из списка или создайте новый. Опишите задачу простым языком — ассистент поможет сформулировать и отправить в работу."
            />
          ) : messages.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <MessageSquare className="mx-auto mb-3 h-10 w-10 text-muted-foreground/20" />
                <p className="text-sm text-muted-foreground/50">
                  Напишите сообщение, чтобы начать диалог
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  onSubmitTask={handleSubmitTask}
                  submitting={submittingTask}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="border-t border-border-subtle px-4 py-3">
          <div className="flex items-end gap-2 rounded-xl border border-border/50 bg-[oklch(0.16_0.006_260)] px-3 py-2">
            <button
              className="shrink-0 rounded-lg p-1.5 text-muted-foreground/50 hover:bg-[oklch(0.2_0.008_260)] hover:text-muted-foreground"
              title="Прикрепить файл"
            >
              <Paperclip className="h-4 w-4" />
            </button>

            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Опишите задачу или задайте вопрос..."
              rows={1}
              className="max-h-32 min-h-[36px] flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
              style={{
                height: 'auto',
                overflow: input.split('\n').length > 3 ? 'auto' : 'hidden',
              }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement
                target.style.height = 'auto'
                target.style.height = Math.min(target.scrollHeight, 128) + 'px'
              }}
            />

            <button
              onClick={toggleRecording}
              className={`shrink-0 rounded-lg p-1.5 transition-colors ${
                recording
                  ? 'bg-destructive/20 text-destructive'
                  : 'text-muted-foreground/50 hover:bg-[oklch(0.2_0.008_260)] hover:text-muted-foreground'
              }`}
              title={recording ? 'Остановить запись' : 'Голосовой ввод'}
            >
              {recording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>

            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="shrink-0 rounded-lg bg-primary p-1.5 text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-30"
              title="Отправить"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>

          <p className="mt-1.5 text-center text-[10px] text-muted-foreground/30">
            Enter — отправить, Shift+Enter — новая строка
          </p>
        </div>
      </div>
    </div>
  )
}
