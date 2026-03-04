import type { MemberRole } from '../types/organization'

export const ROLE_LABELS: Record<MemberRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
  restricted: 'Restricted',
}

export const ROLE_HIERARCHY: MemberRole[] = ['owner', 'admin', 'member', 'restricted']

export function isAdminOrAbove(role: string): boolean {
  return role === 'owner' || role === 'admin'
}

export function canManageMembers(role: string): boolean {
  return role === 'owner' || role === 'admin'
}

export function canManageChannels(role: string): boolean {
  return role === 'owner' || role === 'admin'
}

export function canPin(role: string): boolean {
  return role === 'owner' || role === 'admin'
}
