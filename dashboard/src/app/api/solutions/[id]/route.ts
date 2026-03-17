import { NextResponse } from 'next/server'
import { getSolution } from '@/lib/db'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const solution = getSolution(parseInt(id, 10))
    if (!solution) {
      return NextResponse.json(
        { error: 'Solution not found' },
        { status: 404 }
      )
    }
    return NextResponse.json(solution)
  } catch (err) {
    console.error('[api/solutions/[id]] Error:', err)
    return NextResponse.json(
      { error: 'Failed to fetch solution' },
      { status: 500 }
    )
  }
}
