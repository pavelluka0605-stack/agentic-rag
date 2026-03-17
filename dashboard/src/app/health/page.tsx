'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Activity,
  Server,
  Database,
  Cpu,
  HardDrive,
  MemoryStick,
  Clock,
  Play,
  Square,
  RotateCw,
  RefreshCw,
  Terminal,
  Wifi,
  WifiOff,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StatusDot } from '@/components/ui/status-dot'
import { Loading } from '@/components/ui/loading'
import { EmptyState } from '@/components/ui/empty-state'
import { cn, timeAgo } from '@/lib/utils'
import type { RuntimeStatus, HealthService } from '@/types'

interface HealthData {
  status: 'healthy' | 'degraded' | 'down'
  services: HealthService[]
  timestamp: string
}

export default function SystemHealthPage() {
  const [health, setHealth] = useState<HealthData | null>(null)
  const [runtime, setRuntime] = useState<RuntimeStatus | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [logsOpen, setLogsOpen] = useState(false)

  const fetchAll = useCallback(async () => {
    try {
      const [healthRes, runtimeRes, logsRes] = await Promise.allSettled([
        fetch('/api/health'),
        fetch('/api/runtime/status'),
        fetch('/api/runtime/logs?lines=50'),
      ])

      if (healthRes.status === 'fulfilled' && healthRes.value.ok) {
        setHealth(await healthRes.value.json())
      }
      if (runtimeRes.status === 'fulfilled' && runtimeRes.value.ok) {
        setRuntime(await runtimeRes.value.json())
      }
      if (logsRes.status === 'fulfilled' && logsRes.value.ok) {
        const data = await logsRes.value.json()
        setLogs(data.lines || [])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load health data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
    const interval = setInterval(fetchAll, 30_000)
    return () => clearInterval(interval)
  }, [fetchAll])

  const handleAction = async (action: 'start' | 'stop' | 'restart') => {
    setActionLoading(action)
    try {
      const res = await fetch(`/api/runtime/${action}`, { method: 'POST' })
      if (!res.ok) throw new Error(`Action failed: ${res.status}`)
      // Refetch after action
      setTimeout(fetchAll, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loading size="lg" />
      </div>
    )
  }

  const overallStatus = health?.status || 'unknown'
  const statusColor = overallStatus === 'healthy' ? 'text-success' : overallStatus === 'degraded' ? 'text-warning' : 'text-destructive'
  const controlApiDown = health?.services?.some(s => s.name === 'control_api' && s.status === 'down') ?? true

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Health"
        description="Runtime status, services, and remote control"
        badge={
          <Badge variant={overallStatus === 'healthy' ? 'success' : overallStatus === 'degraded' ? 'warning' : 'destructive'}>
            {overallStatus}
          </Badge>
        }
      />

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">dismiss</button>
        </div>
      )}

      {/* Remote Control */}
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Terminal className="h-4 w-4 text-primary" />
            Remote Control
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAction('start')}
              loading={actionLoading === 'start'}
              disabled={!!actionLoading || controlApiDown}
              className="border-success/30 text-success hover:bg-success/10"
              title={controlApiDown ? 'Control API unavailable' : undefined}
            >
              <Play className="h-3.5 w-3.5" />
              Start
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAction('stop')}
              loading={actionLoading === 'stop'}
              disabled={!!actionLoading || controlApiDown}
              className="border-destructive/30 text-destructive hover:bg-destructive/10"
              title={controlApiDown ? 'Control API unavailable' : undefined}
            >
              <Square className="h-3.5 w-3.5" />
              Stop
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAction('restart')}
              loading={actionLoading === 'restart'}
              disabled={!!actionLoading || controlApiDown}
              className="border-warning/30 text-warning hover:bg-warning/10"
              title={controlApiDown ? 'Control API unavailable' : undefined}
            >
              <RotateCw className="h-3.5 w-3.5" />
              Restart
            </Button>
            <div className="mx-2 hidden h-6 w-px bg-border-subtle sm:block" />
            <Button
              size="sm"
              variant="ghost"
              loading={refreshing}
              onClick={() => { setRefreshing(true); fetchAll().finally(() => setRefreshing(false)) }}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>

          {/* Runtime status summary */}
          {runtime && (
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-lg bg-bg-inset p-3">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
                  <Cpu className="h-3 w-3" />
                  Load
                </div>
                <p className="mt-1 font-mono text-sm font-medium">{runtime.resources?.load || '—'}</p>
              </div>
              <div className="rounded-lg bg-bg-inset p-3">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
                  <MemoryStick className="h-3 w-3" />
                  Memory
                </div>
                <p className="mt-1 font-mono text-sm font-medium">{runtime.resources?.memory || '—'}</p>
              </div>
              <div className="rounded-lg bg-bg-inset p-3">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
                  <HardDrive className="h-3 w-3" />
                  Disk
                </div>
                <p className="mt-1 font-mono text-sm font-medium">{runtime.resources?.disk || '—'}</p>
              </div>
              <div className="rounded-lg bg-bg-inset p-3">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
                  <Clock className="h-3 w-3" />
                  Uptime
                </div>
                <p className="mt-1 font-mono text-sm font-medium">{runtime.resources?.uptime || '—'}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Services */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Server className="h-4 w-4 text-muted-foreground" />
            Services
          </CardTitle>
        </CardHeader>
        <CardContent>
          {health?.services && health.services.length > 0 ? (
            <div className="space-y-2">
              {health.services.map((svc) => (
                <div
                  key={svc.name}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-border-subtle px-3 py-3 sm:flex-nowrap sm:gap-3 sm:px-4"
                >
                  <StatusDot status={svc.status as 'healthy' | 'degraded' | 'down' | 'unknown'} />
                  <span className="font-medium text-sm">{svc.name}</span>
                  <span className="hidden flex-1 truncate text-sm text-muted-foreground sm:inline">{svc.detail}</span>
                  <Badge variant={svc.status === 'healthy' ? 'success' : svc.status === 'down' ? 'destructive' : 'warning'}>
                    {svc.status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={WifiOff}
              title="No service data"
              description="Service health data is not available"
            />
          )}

          {/* Runtime services from Control API */}
          {runtime?.services && Object.keys(runtime.services).length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">VPS Services</p>
              {Object.entries(runtime.services).map(([name, status]) => (
                <div
                  key={name}
                  className="flex items-center gap-3 rounded-lg border border-border-subtle px-4 py-3"
                >
                  <StatusDot status={status === 'running' ? 'healthy' : 'down'} />
                  <span className="font-medium text-sm">{name}</span>
                  <span className="flex-1" />
                  <Badge variant={status === 'running' ? 'success' : 'destructive'}>
                    {status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tmux session */}
      {runtime?.tmux && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Terminal className="h-4 w-4 text-muted-foreground" />
              Tmux Session
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 mb-3">
              <StatusDot status={runtime.tmux.running ? 'active' : 'down'} />
              <span className="text-sm font-medium">{runtime.tmux.session || 'No session'}</span>
              <Badge variant={runtime.tmux.running ? 'success' : 'secondary'}>
                {runtime.tmux.running ? 'Running' : 'Stopped'}
              </Badge>
            </div>
            {runtime.tmux.windows && runtime.tmux.windows.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {runtime.tmux.windows.map((win, i) => (
                  <span key={i} className="rounded bg-bg-inset px-2 py-1 font-mono text-xs">
                    {win}
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Logs */}
      <Card>
        <button
          onClick={() => setLogsOpen(!logsOpen)}
          className="flex w-full items-center gap-2 p-6 pb-3 text-left transition-colors hover:bg-bg-overlay rounded-t-lg"
        >
          {logsOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          <span className="text-sm font-semibold">Runtime Logs</span>
          <Badge variant="secondary">{logs.length} lines</Badge>
        </button>
        {logsOpen && (
          <CardContent>
            {logs.length > 0 ? (
              <pre className="max-h-80 overflow-auto rounded-md bg-bg-inset p-4 font-mono text-xs leading-relaxed">
                {logs.join('\n')}
              </pre>
            ) : (
              <p className="text-sm text-muted-foreground">No logs available</p>
            )}
          </CardContent>
        )}
      </Card>

      {/* Last check time */}
      {health?.timestamp && (
        <p className="text-xs text-muted-foreground/50 text-center">
          Last check: {timeAgo(health.timestamp)} &middot; Auto-refresh every 30s
        </p>
      )}
    </div>
  )
}
