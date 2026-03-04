export function formatRelativeTime(date: Date | string | null | undefined): string {
  if (!date) return ''
  const then = new Date(date)
  const now = new Date()
  const diffMs = now.getTime() - then.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'now'
  if (diffMins < 60) return `${diffMins}m`
  if (diffHours < 24) return `${diffHours}h`
  if (diffDays < 7) return `${diffDays}d`

  return then.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function formatTime(date: Date | string | null | undefined): string {
  if (!date) return ''
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
