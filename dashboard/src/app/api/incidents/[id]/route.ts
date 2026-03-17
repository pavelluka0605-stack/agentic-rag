import { NextResponse } from 'next/server'
import { getIncident } from '@/lib/db'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const incident = getIncident(parseInt(id, 10))
    if (!incident) {
      return NextResponse.json(
        { error: 'Incident not found' },
        { status: 404 }
      )
    }
    return NextResponse.json(incident)
  } catch (err) {
    console.error('[api/incidents/[id]] Error:', err)
    return NextResponse.json(
      { error: 'Failed to fetch incident' },
      { status: 500 }
    )
  }
}
