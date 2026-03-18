import { NextRequest, NextResponse } from 'next/server'
import { getChatThreads, createChatThread } from '@/lib/chat-db'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const status = searchParams.get('status') || undefined
  const limit = parseInt(searchParams.get('limit') || '50')
  const offset = parseInt(searchParams.get('offset') || '0')

  try {
    const threads = getChatThreads({ status, limit, offset })
    return NextResponse.json(threads)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const thread = createChatThread(body.title)
    if (!thread) {
      return NextResponse.json({ error: 'Failed to create thread' }, { status: 500 })
    }
    return NextResponse.json(thread, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
