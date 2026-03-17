import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSolutions } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const verifiedParam = searchParams.get('verified')
    const verified = verifiedParam !== null
      ? verifiedParam === 'true'
      : undefined
    const project = searchParams.get('project') ?? undefined
    const pattern_type = searchParams.get('pattern_type') ?? undefined
    const limit = searchParams.get('limit')
      ? parseInt(searchParams.get('limit')!, 10)
      : undefined
    const offset = searchParams.get('offset')
      ? parseInt(searchParams.get('offset')!, 10)
      : undefined

    const solutions = getSolutions({ verified, project, pattern_type, limit, offset })
    return NextResponse.json(solutions)
  } catch (err) {
    console.error('[api/solutions] Error:', err)
    return NextResponse.json(
      { error: 'Failed to fetch solutions' },
      { status: 500 }
    )
  }
}
