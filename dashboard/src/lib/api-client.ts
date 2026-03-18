import type {
  MemoryStats,
  Incident,
  Solution,
  Episode,
  Decision,
  GithubEvent,
  SearchResult,
  RuntimeStatus,
  LogsResponse,
  HealthService,
  MemoryType,
  Task,
} from '@/types'
import type { ProjectInfo } from '@/lib/db'

// --- Helper ---

async function apiFetch<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, opts)
  if (!res.ok) {
    const body = await res.text()
    let message: string
    try {
      const json = JSON.parse(body)
      message = json.error || `API error ${res.status}`
    } catch {
      message = `API error ${res.status}: ${body}`
    }
    throw new Error(message)
  }
  return res.json() as Promise<T>
}

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== ''
  )
  if (entries.length === 0) return ''
  const search = new URLSearchParams()
  for (const [k, v] of entries) {
    search.set(k, String(v))
  }
  return `?${search.toString()}`
}

// --- Memory Stats ---

export async function fetchStats(): Promise<MemoryStats> {
  return apiFetch<MemoryStats>('/api/memory/stats')
}

// --- Search ---

export async function searchMemory(
  q: string,
  opts?: { tables?: MemoryType[]; project?: string; limit?: number }
): Promise<SearchResult[]> {
  const query = buildQuery({
    q,
    tables: opts?.tables?.join(','),
    project: opts?.project,
    limit: opts?.limit,
  })
  return apiFetch<SearchResult[]>(`/api/memory/search${query}`)
}

// --- Incidents ---

export async function fetchIncidents(opts?: {
  status?: string
  project?: string
  limit?: number
  offset?: number
}): Promise<Incident[]> {
  const query = buildQuery({
    status: opts?.status,
    project: opts?.project,
    limit: opts?.limit,
    offset: opts?.offset,
  })
  return apiFetch<Incident[]>(`/api/incidents${query}`)
}

export async function fetchIncident(id: number): Promise<Incident> {
  return apiFetch<Incident>(`/api/incidents/${id}`)
}

// --- Solutions ---

export async function fetchSolutions(opts?: {
  verified?: boolean
  project?: string
  pattern_type?: string
  limit?: number
  offset?: number
}): Promise<Solution[]> {
  const query = buildQuery({
    verified: opts?.verified,
    project: opts?.project,
    pattern_type: opts?.pattern_type,
    limit: opts?.limit,
    offset: opts?.offset,
  })
  return apiFetch<Solution[]>(`/api/solutions${query}`)
}

export async function fetchSolution(id: number): Promise<Solution> {
  return apiFetch<Solution>(`/api/solutions/${id}`)
}

// --- Sessions (Episodes) ---

export async function fetchSessions(opts?: {
  project?: string
  limit?: number
  offset?: number
}): Promise<Episode[]> {
  const query = buildQuery({
    project: opts?.project,
    limit: opts?.limit,
    offset: opts?.offset,
  })
  return apiFetch<Episode[]>(`/api/sessions${query}`)
}

export async function fetchSession(id: number): Promise<Episode> {
  return apiFetch<Episode>(`/api/sessions/${id}`)
}

// --- Decisions ---

export async function fetchDecisions(opts?: {
  project?: string
  limit?: number
}): Promise<Decision[]> {
  const query = buildQuery({
    project: opts?.project,
    limit: opts?.limit,
  })
  return apiFetch<Decision[]>(`/api/decisions${query}`)
}

// --- GitHub Events ---

export async function fetchGithubEvents(opts?: {
  repo?: string
  event_type?: string
  limit?: number
}): Promise<GithubEvent[]> {
  const query = buildQuery({
    repo: opts?.repo,
    event_type: opts?.event_type,
    limit: opts?.limit,
  })
  return apiFetch<GithubEvent[]>(`/api/github/events${query}`)
}

// --- Projects ---

export async function fetchProjects(): Promise<ProjectInfo[]> {
  return apiFetch<ProjectInfo[]>('/api/projects')
}

// --- Tasks ---

export async function fetchTasks(opts?: {
  status?: string
  project?: string
  limit?: number
  offset?: number
  deleted?: boolean
}): Promise<Task[]> {
  const query = buildQuery({
    status: opts?.status,
    project: opts?.project,
    limit: opts?.limit,
    offset: opts?.offset,
    deleted: opts?.deleted ? '1' : undefined,
  })
  return apiFetch<Task[]>(`/api/tasks${query}`)
}

export async function fetchDeletedTasks(opts?: {
  limit?: number
  offset?: number
}): Promise<Task[]> {
  return fetchTasks({ ...opts, deleted: true })
}

export async function permanentDeleteTask(id: number): Promise<{ id: number; deleted: boolean }> {
  return apiFetch(`/api/tasks/${id}`, { method: 'DELETE' })
}

export async function bulkSoftDelete(data: { ids?: number[]; status?: string }): Promise<{ deleted: number }> {
  return apiFetch('/api/tasks/bulk-delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export async function fetchTask(id: number, opts?: { events?: boolean }): Promise<Task> {
  const query = opts?.events ? '?events=1' : ''
  return apiFetch<Task>(`/api/tasks/${id}${query}`)
}

export async function fetchTaskStats(): Promise<{
  total: number; draft: number; pending: number; running: number; done: number; failed: number
}> {
  return apiFetch(`/api/tasks?stats=true`)
}

export async function createTask(data: {
  raw_input: string
  input_type?: 'text' | 'voice'
  voice_transcript?: string
  project?: string
}): Promise<Task> {
  return apiFetch<Task>('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export async function createVoiceTask(data: {
  audio: string       // base64-encoded audio
  project?: string
}): Promise<Task> {
  return apiFetch<Task>('/api/tasks/voice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export async function taskAction(
  id: number,
  action: string,
  data?: Record<string, unknown>
): Promise<Task> {
  return apiFetch<Task>(`/api/tasks/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...data }),
  })
}

// --- Health ---

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'down'
  services: HealthService[]
  timestamp: string
}

export async function fetchHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>('/api/health')
}

// --- Runtime ---

export async function fetchRuntimeStatus(): Promise<RuntimeStatus> {
  return apiFetch<RuntimeStatus>('/api/runtime/status')
}

export async function fetchRuntimeLogs(lines?: number): Promise<LogsResponse> {
  const query = lines ? `?lines=${lines}` : ''
  return apiFetch<LogsResponse>(`/api/runtime/logs${query}`)
}

export async function runtimeAction(
  action: 'start' | 'stop' | 'restart'
): Promise<Record<string, unknown>> {
  return apiFetch<Record<string, unknown>>(`/api/runtime/${action}`, {
    method: 'POST',
  })
}
