import { useState, useEffect } from 'react'
import { useLocation, useParams, useNavigate } from 'react-router-dom'
import { Home, X } from 'lucide-react'
import { getSidebarMenuItems } from '@/lib/sidebarConfig'
import { hasPermission, type OrgRole } from '@/lib/permissions'
import { cn } from '@/lib/utils'

export interface Org {
  id: string
  name: string
  location?: string
  logo?: string | null
  icon_color?: string
  dues_label?: string
  menu_hidden_pages?: string[]
}

interface OrganizationSidebarProps {
  org: Org
  role: OrgRole
  billingActive?: boolean
  unreadChatCount?: number
  unreadMessagesCount?: number
  onClose?: () => void
  isMobile?: boolean
}

function getActiveSection(pathname: string): string {
  if (pathname.includes('/settings')) return 'settings'
  if (pathname.includes('/chat')) return 'chat'
  if (pathname.includes('/calendar')) return 'calendar'
  if (pathname.includes('/directory') && !pathname.includes('/settings')) return 'directory'
  if (pathname.includes('/members') && !pathname.includes('/settings')) return 'members'
  if (pathname.includes('/dues') && !pathname.includes('/settings')) return 'dues'
  if (pathname.includes('/documents') && !pathname.includes('/settings')) return 'documents'
  if (pathname.includes('/polls')) return 'polls'
  return 'home'
}

export function OrganizationSidebar({
  org,
  role,
  billingActive = true,
  unreadChatCount = 0,
  unreadMessagesCount = 0,
  onClose,
  isMobile,
}: OrganizationSidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { orgId } = useParams()
  const [duesLabel, setDuesLabel] = useState(org.dues_label || 'Dues')
  const activeSection = getActiveSection(location.pathname)

  useEffect(() => {
    setDuesLabel(org.dues_label || 'Dues')
  }, [org.dues_label])

  useEffect(() => {
    const handleLabelChange = (e: CustomEvent<{ orgId: string; label: string }>) => {
      if (e.detail.orgId === orgId) setDuesLabel(e.detail.label)
    }
    window.addEventListener('duesLabelChanged' as never, handleLabelChange as never)
    return () =>
      window.removeEventListener('duesLabelChanged' as never, handleLabelChange as never)
  }, [orgId])

  const menuItems = getSidebarMenuItems(org.id, duesLabel)

  const visibleItems = menuItems.filter((item) => {
    if (!billingActive) {
      const allowedWhileInactive = new Set(['calendar', 'directory', 'settings'])
      if (!allowedWhileInactive.has(item.id)) return false
    }
    if (role === 'restricted' && item.id === 'messages') return false
    if (!item.alwaysVisible && org.menu_hidden_pages?.includes(item.id)) return false
    if (!hasPermission(role, item.permission)) return false
    return true
  })

  const handleNav = (path: string) => {
    if (path.includes('/chat')) {
      navigate(path, { state: { forceLatestChatAt: Date.now() } })
    } else {
      navigate(path)
    }
    onClose?.()
  }

  const iconColor = org.icon_color || '#FFFFFF'

  return (
    <aside
      data-testid="org-sidebar"
      className={cn(
        'flex flex-col h-full overflow-y-auto',
        isMobile ? 'w-full bg-black' : 'w-64 bg-zinc-900/50 border-r border-zinc-800 shrink-0',
      )}
    >
      {isMobile && onClose ? (
        <div className="flex items-center justify-between px-4 py-4 min-h-[56px] border-b border-zinc-800 shrink-0">
          <button
            data-testid="back-to-orgs-btn"
            type="button"
            onClick={() => handleNav('/user-dashboard')}
            className="text-base text-zinc-400 hover:text-white min-h-[56px] min-w-[56px] -ml-2 pl-2 pr-2 flex items-center"
          >
            Back to Organizations
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-4 text-zinc-400 hover:text-white rounded-lg min-h-[56px] min-w-[56px] flex items-center justify-center"
            aria-label="Close menu"
          >
            <X size={22} />
          </button>
        </div>
      ) : (
        <button
          data-testid="back-to-orgs-btn"
          type="button"
          onClick={() => handleNav('/user-dashboard')}
          className="flex items-center gap-2 px-4 py-4 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors min-h-[56px]"
        >
          <Home size={20} />
          <span>Back to Organizations</span>
        </button>
      )}

      <div className="px-4 py-6 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'rounded-full flex items-center justify-center overflow-hidden bg-zinc-800 shrink-0',
              isMobile ? 'w-10 h-10' : 'w-12 h-12',
            )}
            style={{ backgroundColor: org.logo ? 'transparent' : undefined }}
          >
            {org.logo ? (
              <img src={org.logo} alt={org.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-xl font-bold" style={{ color: iconColor }}>
                {org.name.charAt(0)}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <h2 data-testid="org-name" className="text-lg font-bold text-white truncate">
              {org.name}
            </h2>
            {org.location && (
              <p className="text-sm text-zinc-400 truncate">{org.location}</p>
            )}
          </div>
        </div>
      </div>

      <nav className="flex-1 py-2">
        {visibleItems.map((item) => {
          const isActive = activeSection === item.id
          const showBadge =
            (item.badge === 'unreadChatCount' && unreadChatCount > 0) ||
            (item.badge === 'unreadMessagesCount' && unreadMessagesCount > 0)
          const badgeCount = item.badge === 'unreadChatCount' ? unreadChatCount : item.badge === 'unreadMessagesCount' ? unreadMessagesCount : 0
          const Icon = item.icon

          return (
            <button
              key={item.id}
              data-testid={`nav-${item.id}`}
              data-mobile-nav-item
              type="button"
              onClick={() => handleNav(item.route)}
              className={cn(
                'w-full flex items-center gap-3 px-4 min-h-[56px] transition-colors',
                isMobile ? 'py-5 text-lg' : 'py-4 text-base',
                isActive
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50',
              )}
            >
              <div className="relative shrink-0">
                <Icon size={20} style={{ color: iconColor }} />
                {showBadge && (
                  <span
                    className={cn(
                      'absolute -top-2 -right-2 min-w-[18px] h-[18px] text-white text-xs font-bold rounded-full flex items-center justify-center px-1',
                      item.badge === 'unreadMessagesCount' ? 'bg-blue-500' : 'bg-red-500',
                    )}
                  >
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </span>
                )}
              </div>
              <span className="flex-1 text-left">{item.label}</span>
              {showBadge && !isActive && (
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse shrink-0" />
              )}
            </button>
          )
        })}
      </nav>

    </aside>
  )
}
