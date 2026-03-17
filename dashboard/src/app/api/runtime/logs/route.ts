import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getLogs } from '@/lib/control-api'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const linesParam = searchParams.get('lines')
    const lines = linesParam ? parseInt(linesParam, 10) : undefined

    const logs = await getLogs(lines)
    if (!logs) {
      // Return empty logs instead of 502 — Control API is down but UI should still work
      return NextResponse.json({ lines: [], message: 'Control API not reachable' })
    }
    return NextResponse.json(logs)
  } catch (err) {
    console.error('[api/runtime/logs] Error:', err)
    return NextResponse.json(
      { error: 'Failed to fetch runtime logs' },
      { status: 500 }
    )
  }
}
