import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getEpisodes } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const project = searchParams.get('project') ?? undefined
    const limit = searchParams.get('limit')
      ? parseInt(searchParams.get('limit')!, 10)
      : undefined
    const offset = searchParams.get('offset')
      ? parseInt(searchParams.get('offset')!, 10)
      : undefined

    const episodes = getEpisodes({ project, limit, offset })
    return NextResponse.json(episodes)
  } catch (err) {
    console.error('[api/sessions] Error:', err)
    return NextResponse.json(
      { error: 'Failed to fetch sessions' },
      { status: 500 }
    )
  }
}
