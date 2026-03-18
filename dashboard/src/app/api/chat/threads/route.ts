import { NextRequest, NextResponse } from 'next/server'
import { listThreads, createThread, addMessage, getThread, listMessages } from '@/lib/chat-db'
import { generateReply } from '@/lib/llm'

// GET /api/chat/threads
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const limit = parseInt(searchParams.get('limit') || '50')
  const offset = parseInt(searchParams.get('offset') || '0')

  try {
    return NextResponse.json(listThreads(limit, offset))
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// POST /api/chat/threads — create thread + first message + assistant reply
// Body: { message?: string }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const thread = createThread()

    let assistantMessage = null

    if (body.message && typeof body.message === 'string' && body.message.trim()) {
      addMessage(thread.id, 'user', body.message.trim())

      // Generate assistant reply for the first message
      const allMessages = listMessages(thread.id)
      const { content, metadata } = await generateReply(allMessages)
      assistantMessage = addMessage(thread.id, 'assistant', content, {
        metadata: metadata ? JSON.stringify(metadata) : undefined,
      })
    }

    const full = getThread(thread.id)
    return NextResponse.json({
      thread: full,
      assistantMessage,
    }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
