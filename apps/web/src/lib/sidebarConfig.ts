import type { LucideIcon } from 'lucide-react'
import {
  MessageSquare,
  Mail,
  Calendar,
  MapPin,
  Users,
  DollarSign,
  FileText,
  BarChart3,
  Settings,
} from 'lucide-react'

export interface SidebarMenuItem {
  id: string
  label: string
  icon: LucideIcon
  route: string
  badge?: 'unreadChatCount' | 'unreadMessagesCount' | 'pendingApprovalsCount'
  alwaysVisible: boolean
  permission: string
}

export function getSidebarMenuItems(orgId: string, duesLabel: string): SidebarMenuItem[] {
  return [
    {
      id: 'chat',
      label: 'Chat',
      icon: MessageSquare,
      route: `/org/${orgId}/chat`,
      badge: 'unreadChatCount',
      alwaysVisible: true,
      permission: 'chat.view',
    },
    {
      id: 'messages',
      label: 'Messages',
      icon: Mail,
      route: `/org/${orgId}/messages`,
      badge: 'unreadMessagesCount',
      alwaysVisible: true,
      permission: 'chat.view',
    },
    {
      id: 'calendar',
      label: 'Calendar',
      icon: Calendar,
      route: `/org/${orgId}/calendar`,
      alwaysVisible: true,
      permission: 'events.view',
    },
    {
      id: 'directory',
      label: 'Directory',
      icon: MapPin,
      route: `/org/${orgId}/directory`,
      alwaysVisible: false,
      permission: 'directory.view',
    },
    {
      id: 'members',
      label: 'Members',
      icon: Users,
      route: `/org/${orgId}/members`,
      alwaysVisible: true,
      permission: 'members.view',
    },
    {
      id: 'dues',
      label: duesLabel,
      icon: DollarSign,
      route: `/org/${orgId}/dues`,
      alwaysVisible: false,
      permission: 'dues.view',
    },
    {
      id: 'documents',
      label: 'Documents',
      icon: FileText,
      route: `/org/${orgId}/documents`,
      alwaysVisible: false,
      permission: 'documents.view',
    },
    {
      id: 'polls',
      label: 'Polls',
      icon: BarChart3,
      route: `/org/${orgId}/polls`,
      alwaysVisible: false,
      permission: 'polls.view',
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      route: `/org/${orgId}/settings`,
      badge: 'pendingApprovalsCount',
      alwaysVisible: true,
      permission: 'settings.personal',
    },
  ]
}
