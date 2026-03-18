import { NextRequest, NextResponse } from 'next/server'
import { getChatMessages, addChatMessage, getChatThread } from '@/lib/chat-db'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const threadId = parseInt(id)
  if (isNaN(threadId)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
  }

  const { searchParams } = request.nextUrl
  const limit = parseInt(searchParams.get('limit') || '100')
  const offset = parseInt(searchParams.get('offset') || '0')
  const before = searchParams.get('before') ? parseInt(searchParams.get('before')!) : undefined

  const messages = getChatMessages(threadId, { limit, offset, before })
  return NextResponse.json(messages)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const threadId = parseInt(id)
  if (isNaN(threadId)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
  }

  const thread = getChatThread(threadId)
  if (!thread) {
    return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
  }

  try {
    const body = await request.json()
    if (!body.role || !body.content) {
      return NextResponse.json({ error: 'role and content are required' }, { status: 400 })
    }

    const message = addChatMessage({
      thread_id: threadId,
      role: body.role,
      content: body.content,
      task_proposal: body.task_proposal ? JSON.stringify(body.task_proposal) : undefined,
      attachments: body.attachments ? JSON.stringify(body.attachments) : undefined,
    })

    if (!message) {
      return NextResponse.json({ error: 'Failed to add message' }, { status: 500 })
    }

    return NextResponse.json(message, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
