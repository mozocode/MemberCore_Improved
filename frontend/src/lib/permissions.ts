export type OrgRole = 'owner' | 'admin' | 'member' | 'restricted'

const ROLE_PERMISSIONS: Record<OrgRole, string[]> = {
  owner: [
    'chat.view',
    'events.view',
    'directory.view',
    'members.view',
    'dues.view',
    'documents.view',
    'polls.view',
    'settings.personal',
    'org.settings',
    'events.manage',
    'dues.manage',
    'documents.manage',
  ],
  admin: [
    'chat.view',
    'events.view',
    'directory.view',
    'members.view',
    'dues.view',
    'documents.view',
    'polls.view',
    'settings.personal',
    'org.settings',
    'events.manage',
    'dues.manage',
    'documents.manage',
  ],
  member: [
    'chat.view',
    'events.view',
    'directory.view',
    'members.view',
    'dues.view',
    'documents.view',
    'polls.view',
    'settings.personal',
  ],
  restricted: ['chat.view', 'events.view', 'directory.view', 'settings.personal'],
}

export function hasPermission(role: OrgRole, permission: string): boolean {
  const permissions = ROLE_PERMISSIONS[role] ?? []
  return permissions.includes(permission)
}
