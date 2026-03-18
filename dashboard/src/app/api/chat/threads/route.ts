import { NextRequest, NextResponse } from 'next/server'
import { listThreads, createThread, addMessage, getThread } from '@/lib/chat-db'

// GET /api/chat/threads — list threads
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const limit = parseInt(searchParams.get('limit') || '50')
  const offset = parseInt(searchParams.get('offset') || '0')

  try {
    const threads = listThreads(limit, offset)
    return NextResponse.json(threads)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// POST /api/chat/threads — create thread + optional first message
// Body: { message?: string }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const thread = createThread()

    if (body.message && typeof body.message === 'string' && body.message.trim()) {
      addMessage(thread.id, 'user', body.message.trim())
    }

    // Re-fetch to include computed fields (last_message, message_count, title)
    const full = getThread(thread.id)
    return NextResponse.json(full, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
