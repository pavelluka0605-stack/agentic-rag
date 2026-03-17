import { NextResponse } from 'next/server'
import { getStatus } from '@/lib/control-api'

export async function GET() {
  try {
    const status = await getStatus()
    if (!status) {
      return NextResponse.json(
        { error: 'Control API not available' },
        { status: 502 }
      )
    }
    return NextResponse.json(status)
  } catch (err) {
    console.error('[api/runtime/status] Error:', err)
    return NextResponse.json(
      { error: 'Failed to fetch runtime status' },
      { status: 500 }
    )
  }
}
