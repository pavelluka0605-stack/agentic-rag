import { NextResponse } from 'next/server'
import { getStats } from '@/lib/db'

export async function GET() {
  try {
    const stats = getStats()
    return NextResponse.json(stats)
  } catch (err) {
    console.error('[api/memory/stats] Error:', err)
    return NextResponse.json(
      { error: 'Failed to fetch memory stats' },
      { status: 500 }
    )
  }
}
