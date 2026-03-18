import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import type { ChatMessage, ChatMessageMeta } from '@/types'

function getClient(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return null
  return new Anthropic({ apiKey: key })
}

const SYSTEM_PROMPT = `Ты — ассистент в CRM-системе для мебельного бизнеса (marbomebel.ru).
Отвечай на русском языке. Будь кратким и по делу.

Когда пользователь просит выполнить конкретное действие (настроить, развернуть, исправить, обновить и т.д.),
это запрос на задачу. В этом случае в своём ответе:
1. Кратко объясни, как ты понял запрос
2. Предложи 2-4 варианта решения с плюсами и минусами
3. Укажи, что неясно или чего не хватает для начала работы

Для обычных вопросов (что такое, как работает, покажи) — просто отвечай содержательно без вариантов.

В конце КАЖДОГО ответа добавь JSON-блок в формате:
\`\`\`json
{"is_task_request": true/false, "understood": "краткое описание", "proposals": [...], "missing": [...]}
\`\`\`

Где proposals (если is_task_request=true) — массив объектов:
{"title": "Название варианта", "description": "Описание", "pros": ["плюс1"], "cons": ["минус1"]}

Если is_task_request=false, proposals должен быть пустым массивом [].`

export async function generateReply(
  threadMessages: ChatMessage[]
): Promise<{ content: string; metadata: ChatMessageMeta | null }> {
  const client = getClient()

  if (!client) {
    // No API key — return a stub response
    return {
      content: 'LLM не настроен. Добавьте ANTHROPIC_API_KEY в .env.local для получения ответов от ассистента.',
      metadata: { is_task_request: false, understood: null, proposals: [], missing: [] },
    }
  }

  // Build message history for context
  const messages: Anthropic.MessageParam[] = threadMessages.map(m => ({
    role: m.role === 'user' ? 'user' as const : 'assistant' as const,
    content: m.content,
  })).filter(m => m.role === 'user' || m.role === 'assistant')

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages,
  })

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map(b => b.text)
    .join('')

  // Extract metadata JSON from the response
  const metadata = extractMetadata(text)
  // Strip the JSON block from the visible content
  const content = text.replace(/```json\s*\{[\s\S]*?\}\s*```/g, '').trim()

  return { content, metadata }
}

function extractMetadata(text: string): ChatMessageMeta | null {
  const match = text.match(/```json\s*(\{[\s\S]*?\})\s*```/)
  if (!match) return null
  try {
    const raw = JSON.parse(match[1])
    return {
      is_task_request: !!raw.is_task_request,
      understood: raw.understood || null,
      proposals: Array.isArray(raw.proposals) ? raw.proposals.map((p: Record<string, unknown>) => ({
        title: String(p.title || ''),
        description: String(p.description || ''),
        pros: Array.isArray(p.pros) ? p.pros.map(String) : [],
        cons: Array.isArray(p.cons) ? p.cons.map(String) : [],
      })) : [],
      missing: Array.isArray(raw.missing) ? raw.missing.map(String) : [],
    }
  } catch {
    return null
  }
}
