import { NextRequest, NextResponse } from 'next/server'
import { getThread } from '@/lib/chat-db'

// GET /api/chat/threads/:id — get single thread
export async function GET(
  _request: NextRequest,
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
    return NextResponse.json(thread)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
