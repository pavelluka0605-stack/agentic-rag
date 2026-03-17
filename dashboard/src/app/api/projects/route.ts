import { NextResponse } from 'next/server'
import { getProjects } from '@/lib/db'

export async function GET() {
  try {
    const projects = getProjects()
    return NextResponse.json(projects)
  } catch (err) {
    console.error('[api/projects] Error:', err)
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    )
  }
}
