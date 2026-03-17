import { NextResponse } from 'next/server'
import { getStatus } from '@/lib/control-api'

export async function GET() {
  try {
    const status = await getStatus()
    if (!status) {
      // Return degraded status instead of 502 — let the UI show "unavailable" gracefully
      return NextResponse.json({
        status: 'unavailable',
        tmux: { running: false, session: 'unknown', windows: [] },
        services: {},
        resources: { disk: '—', memory: '—', uptime: '—', load: '—' },
        claude: { version: 'unavailable' },
        logs: { today: '0 lines' },
        timestamp: new Date().toISOString(),
        _note: 'Control API not reachable',
      })
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
