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

// Chat types
export interface ChatThread {
  id: number
  title: string | null
  status: 'active' | 'archived'
  last_message_preview: string | null
  message_count: number
  linked_task_ids: string | null  // JSON array of task IDs
  created_at: string
  updated_at: string
}

export interface ChatMessage {
  id: number
  thread_id: number
  role: 'user' | 'assistant'
  content: string
  task_proposal: string | null     // JSON: proposed task formulation
  attachments: string | null       // JSON array of { name, type, url }
  created_at: string
}

export interface TaskProposal {
  understood: string               // "Вот как я понял задачу"
  options: TaskProposalOption[]
  ready_to_submit: boolean
}

export interface TaskProposalOption {
  id: string
  title: string
  description: string
  pros: string[]
  cons: string[]
  effort: 'low' | 'medium' | 'high'
}

// Task Pipeline types
export type TaskStatus =
  | 'draft'
  | 'discussion'
  | 'ready_for_execution'
  | 'executing'
  | 'verifying'
  | 'needs_input'
  | 'done'
  | 'failed'
  | 'canceled'
  | 'trashed'
  // Legacy statuses (backward compat with existing data)
  | 'pending'
  | 'confirmed'
  | 'running'
  | 'review'
  | 'needs_manual_review'
  | 'cancelled'
export type TaskMode = 'fast' | 'safe'

export interface TaskOption {
  id: string
  title: string
  description: string
  pros: string[]
  cons: string[]
  effort: 'low' | 'medium' | 'high'
  speed: 'fast' | 'medium' | 'slow'
  risk: 'low' | 'medium' | 'high'
  recommended: boolean
  recommendation_reason?: string
}

export interface TaskInterpretation {
  understood: string
  expected_outcome: string
  affected_areas: string[]
  constraints: string[]
  plan?: string[]
  options?: TaskOption[]
  risk_level: 'low' | 'medium' | 'high'
  risk_note: string
}

export interface TaskPhaseStep {
  text_ru: string
  status: 'pending' | 'active' | 'done' | 'blocked'
  ts: string | null
}

export interface TaskPhase {
  id: string
  name_ru: string
  status: 'pending' | 'active' | 'done' | 'blocked'
  steps: TaskPhaseStep[]
}

export interface TaskEngineeringPacket {
  title: string
  objective: string
  scope: string[]
  steps: string[]
  constraints: string[]
  acceptance_criteria: string[]
  not_doing?: string[]
  phases?: Array<{ id: string; name_ru: string; steps_ru: string[] }>
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
  chat_thread_id: number | null
  raw_input: string
  input_type: 'text' | 'voice'
  voice_transcript: string | null
  interpretation: string | null       // JSON string of TaskInterpretation
  chosen_option: string | null        // JSON string of TaskOption
  status: TaskStatus
  mode: TaskMode
  revisions: string | null            // JSON string of TaskRevision[]
  engineering_packet: string | null   // JSON string of TaskEngineeringPacket
  execution_phases: string | null     // JSON string of TaskPhase[]
  execution_run_id: string | null
  progress: string | null             // JSON string of TaskProgress[]
  result_summary_ru: string | null
  result_detail: string | null
  error: string | null
  telegram_notified: number
  deleted_at: string | null
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
