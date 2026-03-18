import { NextRequest, NextResponse } from 'next/server'
import { getTasks, getTaskStats, getDeletedTaskCount } from '@/lib/db'
import { controlPost } from '@/lib/control-api'

// GET /api/tasks — list tasks (reads from local SQLite)
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const status = searchParams.get('status') || undefined
  const project = searchParams.get('project') || undefined
  const limit = parseInt(searchParams.get('limit') || '20')
  const offset = parseInt(searchParams.get('offset') || '0')
  const deleted = searchParams.get('deleted') === '1'

  try {
    if (searchParams.get('stats') === 'true') {
      return NextResponse.json(getTaskStats())
    }
    const tasks = getTasks({ status, project, limit, offset, deleted })
    const res = NextResponse.json(tasks)
    if (!deleted) {
      res.headers.set('X-Trash-Count', String(getDeletedTaskCount()))
    }
    return res
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// POST /api/tasks — create a new task (proxies to Control API)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const result = await controlPost('/api/tasks', body)
    if (!result) {
      return NextResponse.json({ error: 'Control API unavailable' }, { status: 503 })
    }
    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
