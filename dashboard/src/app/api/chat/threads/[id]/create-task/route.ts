import { NextRequest, NextResponse } from 'next/server'
import { getThread, getMessage, setMessageTaskId, addMessage } from '@/lib/chat-db'
import { controlPost } from '@/lib/control-api'

// POST /api/chat/threads/:id/create-task
// Body: { message_id: number, proposal_index: number, description: string }
// Creates a Task linked to a specific assistant message + proposal.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const threadId = parseInt(id)
  if (isNaN(threadId)) {
    return NextResponse.json({ error: 'Invalid thread ID' }, { status: 400 })
  }

  try {
    const thread = getThread(threadId)
    if (!thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
    }

    const body = await request.json()
    const { message_id, proposal_index, description } = body

    if (!message_id || proposal_index === undefined || !description) {
      return NextResponse.json(
        { error: 'message_id, proposal_index, and description are required' },
        { status: 400 }
      )
    }

    // Verify the message exists and belongs to this thread
    const msg = getMessage(message_id)
    if (!msg || msg.thread_id !== threadId) {
      return NextResponse.json({ error: 'Message not found in this thread' }, { status: 404 })
    }

    // Try creating via Control API (task pipeline)
    const taskResult = await controlPost<{ id: number }>('/api/tasks', {
      raw_input: description,
    })

    if (taskResult && taskResult.id) {
      // Link the task to the originating assistant message
      setMessageTaskId(message_id, taskResult.id)

      // Add a system message noting task creation
      addMessage(threadId, 'system', `Задача #${taskResult.id} создана: ${description}`, {
        taskId: taskResult.id,
      })

      return NextResponse.json({
        task_id: taskResult.id,
        message_id,
        proposal_index,
      }, { status: 201 })
    }

    // Control API unavailable — return error but don't fail silently
    return NextResponse.json(
      { error: 'Task pipeline unavailable. Задача не создана.' },
      { status: 503 }
    )
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
