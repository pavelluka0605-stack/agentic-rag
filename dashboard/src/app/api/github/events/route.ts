import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getGithubEvents } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const repo = searchParams.get('repo') ?? undefined
    const event_type = searchParams.get('event_type') ?? undefined
    const limit = searchParams.get('limit')
      ? parseInt(searchParams.get('limit')!, 10)
      : undefined

    const events = getGithubEvents({ repo, event_type, limit })
    return NextResponse.json(events)
  } catch (err) {
    console.error('[api/github/events] Error:', err)
    return NextResponse.json(
      { error: 'Failed to fetch github events' },
      { status: 500 }
    )
  }
}
