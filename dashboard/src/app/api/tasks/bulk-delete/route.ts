import { NextRequest, NextResponse } from 'next/server'
import { controlPost } from '@/lib/control-api'

// POST /api/tasks/bulk-delete — bulk soft delete (proxy to Control API)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const result = await controlPost('/api/tasks/bulk-delete', body)
    if (!result) {
      return NextResponse.json({ error: 'Control API unavailable' }, { status: 503 })
    }
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
