import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { getHealth as getControlHealth } from '@/lib/control-api'
import type { HealthService } from '@/types'

export async function GET() {
  try {
    const services: HealthService[] = []

    // Check memory DB
    const db = getDb()
    services.push({
      name: 'memory_db',
      status: db ? 'healthy' : 'down',
      detail: db ? 'SQLite database connected (readonly)' : 'Database not available',
      lastCheck: new Date().toISOString(),
    })

    // Check control API
    let controlStatus: HealthService
    try {
      const health = await getControlHealth()
      controlStatus = {
        name: 'control_api',
        status: health ? 'healthy' : 'down',
        detail: health ? 'Control API reachable' : 'Control API not responding',
        lastCheck: new Date().toISOString(),
      }
    } catch {
      controlStatus = {
        name: 'control_api',
        status: 'down',
        detail: 'Control API unreachable',
        lastCheck: new Date().toISOString(),
      }
    }
    services.push(controlStatus)

    // Overall status
    const allHealthy = services.every((s) => s.status === 'healthy')
    const allDown = services.every((s) => s.status === 'down')
    const overall = allHealthy ? 'healthy' : allDown ? 'down' : 'degraded'

    return NextResponse.json({
      status: overall,
      services,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[api/health] Error:', err)
    return NextResponse.json(
      { error: 'Health check failed' },
      { status: 500 }
    )
  }
}
