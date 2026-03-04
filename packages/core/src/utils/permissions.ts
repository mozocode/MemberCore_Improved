import type { Channel } from '../types/message'

export function canSeeChannel(
  channel: Channel,
  userId: string,
  role: string,
): boolean {
  if (role === 'owner' || role === 'admin') return true
  if (!channel.is_restricted) return true
  if (channel.allowed_members?.includes(userId)) return true
  if (channel.allowed_roles?.includes(role)) return true
  return false
}

export function canSendToChannel(
  channel: Channel,
  userId: string,
  role: string,
): boolean {
  return canSeeChannel(channel, userId, role)
}
