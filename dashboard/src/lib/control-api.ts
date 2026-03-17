import 'server-only'
import type { RuntimeStatus, LogsResponse, MemoryStats } from '@/types'

function getBaseUrl(): string {
  return process.env.CONTROL_API_URL || 'http://127.0.0.1:3901'
}

function getHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }
  const token = process.env.CONTROL_API_TOKEN
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

async function controlFetch<T>(path: string, opts?: RequestInit): Promise<T | null> {
  const url = `${getBaseUrl()}${path}`
  try {
    const res = await fetch(url, {
      ...opts,
      headers: {
        ...getHeaders(),
        ...(opts?.headers ?? {}),
      },
    })
    if (!res.ok) {
      console.error(`[control-api] ${opts?.method ?? 'GET'} ${path} → ${res.status} ${res.statusText}`)
      return null
    }
    return (await res.json()) as T
  } catch (err) {
    console.error(`[control-api] ${opts?.method ?? 'GET'} ${path} failed:`, err)
    return null
  }
}

export async function getStatus(): Promise<RuntimeStatus | null> {
  return controlFetch<RuntimeStatus>('/api/status')
}

export async function getLogs(lines?: number): Promise<LogsResponse | null> {
  const query = lines ? `?lines=${lines}` : ''
  return controlFetch<LogsResponse>(`/api/logs${query}`)
}

export async function getMemoryStats(): Promise<MemoryStats | null> {
  return controlFetch<MemoryStats>('/api/memory')
}

export async function getHealth(): Promise<Record<string, unknown> | null> {
  return controlFetch<Record<string, unknown>>('/health')
}

export async function startRuntime(): Promise<Record<string, unknown> | null> {
  return controlFetch<Record<string, unknown>>('/api/start', { method: 'POST' })
}

export async function stopRuntime(): Promise<Record<string, unknown> | null> {
  return controlFetch<Record<string, unknown>>('/api/stop', { method: 'POST' })
}

export async function restartRuntime(): Promise<Record<string, unknown> | null> {
  return controlFetch<Record<string, unknown>>('/api/restart', { method: 'POST' })
}
