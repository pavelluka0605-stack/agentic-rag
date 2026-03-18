import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import type { ChatMessage, ChatMessageMeta } from '@/types'

// ── Provider configuration ──────────────────────────────
//
// Supported provider: Anthropic (Claude)
// Required env var: ANTHROPIC_API_KEY
// Model: claude-sonnet-4-20250514 (configurable via LLM_MODEL)
//
// No OpenAI fallback — single provider, no ambiguity.
// Without ANTHROPIC_API_KEY: returns a stub response.

function getClient(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) {
    console.warn('[llm] ANTHROPIC_API_KEY not set — assistant replies will be stubs')
    return null
  }
  return new Anthropic({ apiKey: key })
}

function getModel(): string {
  return process.env.LLM_MODEL || 'claude-sonnet-4-20250514'
}

const SYSTEM_PROMPT = `Ты — ассистент в CRM-системе для мебельного бизнеса (marbomebel.ru).
Отвечай на русском языке. Будь кратким и по делу.

Когда пользователь просит выполнить конкретное действие (настроить, развернуть, исправить, обновить, создать и т.д.),
это запрос на задачу. В этом случае:
1. Кратко объясни, как ты понял запрос
2. Предложи 2-4 варианта решения с плюсами и минусами
3. Укажи, что неясно или чего не хватает для начала

Для обычных вопросов — просто отвечай содержательно.

В конце КАЖДОГО ответа добавь блок:
\`\`\`json
{"is_task_request": true/false, "understood": "краткое описание запроса", "proposals": [...], "missing": [...]}
\`\`\`

Формат proposals (только если is_task_request=true):
[{"title": "Вариант", "description": "Описание", "pros": ["плюс"], "cons": ["минус"]}]

Если is_task_request=false — proposals=[].`

export async function generateReply(
  threadMessages: ChatMessage[]
): Promise<{ content: string; metadata: ChatMessageMeta | null }> {
  const client = getClient()

  if (!client) {
    return {
      content: 'Ассистент не подключён. Добавьте ANTHROPIC_API_KEY в .env.local',
      metadata: { is_task_request: false, understood: null, proposals: [], missing: [] },
    }
  }

  const messages: Anthropic.MessageParam[] = threadMessages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))

  const response = await client.messages.create({
    model: getModel(),
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages,
  })

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('')

  const metadata = extractMetadata(text)
  const content = stripMetadataBlock(text)

  return { content, metadata }
}

// ── Metadata extraction ─────────────────────────────────

function extractMetadata(text: string): ChatMessageMeta | null {
  // Match the last ```json {...} ``` block in the response
  const match = text.match(/```json\s*(\{[\s\S]*?\})\s*```\s*$/)
  if (!match) return null
  try {
    const raw = JSON.parse(match[1])
    return {
      is_task_request: !!raw.is_task_request,
      understood: typeof raw.understood === 'string' ? raw.understood : null,
      proposals: Array.isArray(raw.proposals) ? raw.proposals.map((p: Record<string, unknown>) => ({
        title: String(p.title || ''),
        description: String(p.description || ''),
        pros: Array.isArray(p.pros) ? p.pros.map(String) : [],
        cons: Array.isArray(p.cons) ? p.cons.map(String) : [],
      })) : [],
      missing: Array.isArray(raw.missing) ? raw.missing.map(String) : [],
    }
  } catch {
    // Invalid JSON — don't break message saving
    return null
  }
}

function stripMetadataBlock(text: string): string {
  return text.replace(/\s*```json\s*\{[\s\S]*?\}\s*```\s*$/, '').trim()
}
