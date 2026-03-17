import { NextResponse } from 'next/server'
import { getEpisode } from '@/lib/db'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const episode = getEpisode(parseInt(id, 10))
    if (!episode) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }
    return NextResponse.json(episode)
  } catch (err) {
    console.error('[api/sessions/[id]] Error:', err)
    return NextResponse.json(
      { error: 'Failed to fetch session' },
      { status: 500 }
    )
  }
}
