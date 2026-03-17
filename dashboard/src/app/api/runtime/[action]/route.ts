import { NextResponse } from 'next/server'
import { startRuntime, stopRuntime, restartRuntime } from '@/lib/control-api'

const ACTIONS: Record<string, () => Promise<Record<string, unknown> | null>> = {
  start: startRuntime,
  stop: stopRuntime,
  restart: restartRuntime,
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ action: string }> }
) {
  try {
    const { action } = await params

    const handler = ACTIONS[action]
    if (!handler) {
      return NextResponse.json(
        { error: `Unknown action: ${action}. Valid actions: start, stop, restart` },
        { status: 400 }
      )
    }

    const result = await handler()
    if (!result) {
      return NextResponse.json(
        { error: 'Control API not available' },
        { status: 502 }
      )
    }
    return NextResponse.json(result)
  } catch (err) {
    console.error('[api/runtime/[action]] Error:', err)
    return NextResponse.json(
      { error: 'Runtime action failed' },
      { status: 500 }
    )
  }
}
