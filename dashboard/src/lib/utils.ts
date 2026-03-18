import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Ensure UTC timestamps from SQLite (no timezone marker) are parsed correctly */
function ensureUtc(dateStr: string): string {
  // SQLite datetime('now') returns "YYYY-MM-DD HH:MM:SS" without Z
  // new Date() would interpret that as local time → wrong offset
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(dateStr)) {
    return dateStr.replace(' ', 'T') + 'Z'
  }
  return dateStr
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  try {
    const d = new Date(ensureUtc(dateStr))
    return d.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

export function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '—'
  const now = Date.now()
  const then = new Date(ensureUtc(dateStr)).getTime()
  const diff = now - then
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'только что'
  if (mins < 60) return `${mins} мин назад`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} ч назад`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} дн назад`
  return formatDate(dateStr)
}

export function parseJsonField<T>(value: string | null): T | null {
  if (!value) return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

export function truncate(str: string, len: number = 100): string {
  if (str.length <= len) return str
  return str.slice(0, len) + '...'
}
