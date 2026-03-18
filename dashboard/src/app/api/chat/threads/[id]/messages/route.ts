import { NextRequest, NextResponse } from 'next/server'
import { getThread, listMessages, addMessage } from '@/lib/chat-db'

// GET /api/chat/threads/:id/messages — list messages in thread
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

// POST /api/chat/threads/:id/messages — add message to thread
// Body: { role: 'user'|'assistant'|'system', content: string, task_id?: number }
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

    const message = addMessage(threadId, role, content.trim(), task_id)
    return NextResponse.json(message, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
