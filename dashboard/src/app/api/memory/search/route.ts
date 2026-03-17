import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { searchMemory } from '@/lib/db'
import type { MemoryType } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const q = searchParams.get('q')

    if (!q) {
      return NextResponse.json(
        { error: 'Missing required parameter: q' },
        { status: 400 }
      )
    }

    const tablesParam = searchParams.get('tables')
    const tables = tablesParam
      ? (tablesParam.split(',') as MemoryType[])
      : undefined
    const project = searchParams.get('project') ?? undefined
    const limit = searchParams.get('limit')
      ? parseInt(searchParams.get('limit')!, 10)
      : undefined

    const results = searchMemory(q, { tables, project, limit })
    return NextResponse.json(results)
  } catch (err) {
    console.error('[api/memory/search] Error:', err)
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    )
  }
}
