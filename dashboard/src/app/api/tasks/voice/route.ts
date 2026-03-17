import { NextRequest, NextResponse } from 'next/server'
import { controlPost } from '@/lib/control-api'

// POST /api/tasks/voice — send base64 audio to Control API for Whisper + task creation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    if (!body.audio) {
      return NextResponse.json({ error: 'audio (base64) is required' }, { status: 400 })
    }
    const result = await controlPost('/api/tasks/voice', body)
    if (!result) {
      return NextResponse.json({ error: 'Control API unavailable' }, { status: 503 })
    }
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
