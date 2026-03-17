import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getDecisions } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const project = searchParams.get('project') ?? undefined
    const limit = searchParams.get('limit')
      ? parseInt(searchParams.get('limit')!, 10)
      : undefined

    const decisions = getDecisions({ project, limit })
    return NextResponse.json(decisions)
  } catch (err) {
    console.error('[api/decisions] Error:', err)
    return NextResponse.json(
      { error: 'Failed to fetch decisions' },
      { status: 500 }
    )
  }
}
