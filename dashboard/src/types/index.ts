// Memory layer entities matching SQLite schema

export interface Policy {
  id: number
  project: string | null
  category: 'rule' | 'constraint' | 'convention' | 'limitation'
  title: string
  content: string
  source: string
  verified: number
  active: number
  created_at: string
  updated_at: string
}

export interface Episode {
  id: number
  project: string | null
  session_id: string | null
  summary: string
  what_done: string | null
  where_stopped: string | null
  what_remains: string | null
  open_loops: string | null // JSON array
  branch: string | null
  files_changed: string | null // JSON array
  created_at: string
}

export interface Incident {
  id: number
  project: string | null
  service: string | null
  fingerprint: string
  error_message: string
  stack_trace: string | null
  failed_command: string | null
  context: string | null
  probable_cause: string | null
  failed_attempts: string | null // JSON array
  verified_fix: string | null
  fix_verified_at: string | null
  status: 'open' | 'investigating' | 'fixed' | 'wontfix' | 'duplicate'
  duplicate_of: number | null
  occurrence_count: number
  usefulness_score: number
  github_issue: string | null
  github_pr: string | null
  created_at: string
  updated_at: string
}

export interface Solution {
  id: number
  project: string | null
  service: string | null
  title: string
  description: string
  code: string | null
  commands: string | null // JSON array
  pattern_type: 'workflow' | 'command' | 'pattern' | 'playbook' | 'snippet' | 'config'
  solves_incident: number | null
  verified: number
  verified_at: string | null
  usefulness_score: number
  use_count: number
  tags: string | null // JSON array
  github_pr: string | null
  created_at: string
  updated_at: string
}

export interface Decision {
  id: number
  project: string | null
  title: string
  context: string
  chosen: string
  alternatives: string | null // JSON array
  tradeoffs: string | null
  not_doing: string | null
  revisit_trigger: string | null
  supersedes: number | null
  tags: string | null // JSON array
  created_at: string
}

export interface Context {
  id: number
  project: string | null
  category: 'code' | 'infra' | 'docs' | 'deployment' | 'summary' | 'config' | 'api'
  title: string
  content: string
  file_path: string | null
  language: string | null
  tags: string | null // JSON array
  verified: number
  created_at: string
  updated_at: string
}

export interface GithubEvent {
  id: number
  event_type: string
  action: string | null
  repo: string
  ref: string | null
  payload_summary: string | null
  linked_memory_type: string | null
  linked_memory_id: number | null
  processed: number
  created_at: string
}

// API response types

export interface MemoryStats {
  policies: number
  episodes: number
  incidents: number
  solutions: number
  decisions: number
  contexts: number
  github_events: number
  open_incidents: number
  verified_solutions: number
}

export interface RuntimeStatus {
  status: string
  tmux: {
    running: boolean
    session: string
    windows: string[]
  }
  services: Record<string, string>
  resources: {
    disk: string
    memory: string
    uptime: string
    load: string
  }
  claude: { version: string }
  logs: { today: string }
  timestamp: string
}

export interface LogsResponse {
  file: string
  count: number
  lines: string[]
}

export interface HealthService {
  name: string
  status: 'healthy' | 'degraded' | 'down' | 'unknown'
  detail: string
  lastCheck?: string
}

export type MemoryType = 'policies' | 'episodes' | 'incidents' | 'solutions' | 'decisions' | 'contexts' | 'github_events'

// Task Pipeline types
export type TaskStatus = 'draft' | 'pending' | 'confirmed' | 'running' | 'review' | 'needs_manual_review' | 'done' | 'failed' | 'cancelled'
export type TaskMode = 'fast' | 'safe'

export interface TaskInterpretation {
  understood: string
  expected_outcome: string
  affected_areas: string[]
  constraints: string[]
  plan: string[]
  risk_level: 'low' | 'medium' | 'high'
  risk_note: string
}

export interface TaskEngineeringPacket {
  title: string
  objective: string
  scope: string[]
  steps: string[]
  constraints: string[]
  acceptance_criteria: string[]
  mode: TaskMode
}

export interface TaskProgress {
  message_ru: string
  pct: number | null
  timestamp: string
}

export interface TaskRevision {
  text: string
  timestamp: string
}

export interface Task {
  id: number
  project: string | null
  raw_input: string
  input_type: 'text' | 'voice'
  voice_transcript: string | null
  interpretation: string | null       // JSON string of TaskInterpretation
  status: TaskStatus
  mode: TaskMode
  revisions: string | null            // JSON string of TaskRevision[]
  engineering_packet: string | null   // JSON string of TaskEngineeringPacket
  execution_run_id: string | null
  progress: string | null             // JSON string of TaskProgress[]
  result_summary_ru: string | null
  result_detail: string | null
  error: string | null
  telegram_notified: number
  created_at: string
  updated_at: string
}

export interface TaskEvent {
  id: number
  task_id: number
  event_type: string
  detail: string | null
  created_at: string
}

export interface SearchResult {
  _type: MemoryType
  rank: number
  id: number
  title?: string
  description?: string
  error_message?: string
  summary?: string
  content?: string
  [key: string]: unknown
}

// Chat entities (independent from Tasks)

export interface ChatThread {
  id: number
  title: string | null
  created_at: string
  updated_at: string
  last_message: string | null
  message_count: number
}

export interface ChatMessage {
  id: number
  thread_id: number
  role: 'user' | 'assistant' | 'system'
  content: string
  metadata: string | null      // JSON string of ChatMessageMeta (for structured proposals)
  task_id: number | null       // link to a spawned Task (set after explicit confirmation)
  created_at: string
}

export interface ChatProposal {
  title: string
  description: string
  pros: string[]
  cons: string[]
}

export interface ChatMessageMeta {
  is_task_request: boolean
  understood: string | null
  proposals: ChatProposal[]
  missing: string[]            // what is unclear or missing from the request
}
