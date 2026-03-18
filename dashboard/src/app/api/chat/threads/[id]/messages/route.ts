import { NextRequest, NextResponse } from 'next/server'
import { getThread, listMessages, addMessage } from '@/lib/chat-db'
import { generateReply } from '@/lib/llm'

// GET /api/chat/threads/:id/messages
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const threadId = parseInt(id)
  if (isNaN(threadId)) {
    return NextResponse.json({ error: 'Invalid thread ID' }, { status: 400 })
  }

  const { searchParams } = request.nextUrl
  const limit = parseInt(searchParams.get('limit') || '200')
  const offset = parseInt(searchParams.get('offset') || '0')

  try {
    const thread = getThread(threadId)
    if (!thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
    }
    const messages = listMessages(threadId, limit, offset)
    return NextResponse.json(messages)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// POST /api/chat/threads/:id/messages
// Body: { role: 'user'|'assistant'|'system', content: string, task_id?: number }
// When role=user, automatically generates an assistant reply via LLM.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const threadId = parseInt(id)
  if (isNaN(threadId)) {
    return NextResponse.json({ error: 'Invalid thread ID' }, { status: 400 })
  }

  try {
    const thread = getThread(threadId)
    if (!thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
    }

    const body = await request.json()
    const { role, content, task_id } = body

    if (!role || !content) {
      return NextResponse.json({ error: 'role and content are required' }, { status: 400 })
    }
    if (!['user', 'assistant', 'system'].includes(role)) {
      return NextResponse.json({ error: 'role must be user, assistant, or system' }, { status: 400 })
    }

    // Save the user/system/assistant message
    const userMsg = addMessage(threadId, role, content.trim(), { taskId: task_id })

    // If user message, auto-generate assistant reply
    if (role === 'user') {
      const allMessages = listMessages(threadId)
      const { content: replyText, metadata } = await generateReply(allMessages)
      const assistantMsg = addMessage(threadId, 'assistant', replyText, {
        metadata: metadata ? JSON.stringify(metadata) : undefined,
      })

      // Return both messages
      return NextResponse.json({
        userMessage: userMsg,
        assistantMessage: assistantMsg,
      }, { status: 201 })
    }

    return NextResponse.json(userMsg, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
