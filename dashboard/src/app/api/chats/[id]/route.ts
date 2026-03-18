import { NextRequest, NextResponse } from 'next/server'
import { getChatThread, updateChatThread, deleteChatThread, getTasksForThread } from '@/lib/chat-db'

export async function GET(
  _request: NextRequest,
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

  const linkedTasks = getTasksForThread(threadId)
  return NextResponse.json({ ...thread, linkedTasks })
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

  try {
    const body = await request.json()
    const thread = updateChatThread(threadId, body)
    if (!thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
    }
    return NextResponse.json(thread)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const threadId = parseInt(id)
  if (isNaN(threadId)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
  }

  const deleted = deleteChatThread(threadId)
  return NextResponse.json({ deleted })
}
