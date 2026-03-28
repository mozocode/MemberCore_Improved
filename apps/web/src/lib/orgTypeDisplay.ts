export function normalizeOrgTypeLabel(type?: string | null): string {
  const raw = (type || '').trim()
  if (!raw) return ''
  if (raw === 'Trade Union / Guild') return 'Union / Guild'
  return raw
}
