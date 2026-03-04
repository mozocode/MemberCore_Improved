export interface GetDisplayNameOptions {
  /** If true, use full name when no nickname; otherwise use first name only. */
  fullNameFallback?: boolean
}

/**
 * Resolve display name: nickname (in this org) if set, else first name only. Never full name.
 * Used in chat, member directory, events, polls, messages, etc.
 */
export function getDisplayName(
  realName: string | null | undefined,
  nickname: string | null | undefined,
  options: GetDisplayNameOptions = {}
): string {
  if (nickname != null && String(nickname).trim()) return String(nickname).trim()
  if (realName != null && String(realName).trim()) {
    const name = String(realName).trim()
    return options.fullNameFallback ? name : name.split(/\s+/)[0] || name
  }
  return 'Unknown'
}

/**
 * Avatar fallback: first character of display name, uppercase.
 */
export function getAvatarFallback(realName: string | null | undefined, nickname: string | null | undefined): string {
  return getDisplayName(realName, nickname).charAt(0).toUpperCase()
}
