import { NextRequest, NextResponse } from 'next/server'
import { getTask } from '@/lib/db'
import { controlPost } from '@/lib/control-api'

// GET /api/tasks/:id — read task from SQLite
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const task = getTask(parseInt(id))
  if (!task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  }
  return NextResponse.json(task)
}

// POST /api/tasks/:id — proxy actions to Control API
// Body must include { action: 'interpret' | 'revise' | 'confirm' | 'cancel' | 'start' | 'progress' | 'complete' | 'fail', ...data }
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const body = await request.json()
    const { action, ...data } = body
    if (!action) {
      return NextResponse.json({ error: 'action is required' }, { status: 400 })
    }

    const validActions = ['interpret', 'revise', 'confirm', 'cancel', 'start', 'progress', 'complete', 'fail']
    if (!validActions.includes(action)) {
      return NextResponse.json({ error: `Invalid action: ${action}` }, { status: 400 })
    }

    const result = await controlPost(`/api/tasks/${id}/${action}`, data)
    if (!result) {
      return NextResponse.json({ error: 'Control API unavailable' }, { status: 503 })
    }
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
