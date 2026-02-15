import { useState, useEffect } from 'react'
import { Outlet, useParams, useNavigate, useLocation } from 'react-router-dom'
import { OrganizationSidebar } from '@/components/OrganizationSidebar'
import { api } from '@/lib/api'
import { Loader2, Menu } from 'lucide-react'
import type { OrgRole } from '@/lib/permissions'

function getPageTitle(pathname: string, orgName: string): string {
  if (pathname.includes('/chat')) return 'Chat'
  if (pathname.includes('/messages')) return 'Messages'
  if (pathname.includes('/calendar')) return 'Calendar'
  if (pathname.includes('/directory')) return 'Directory'
  if (pathname.includes('/members')) return 'Members'
  if (pathname.includes('/dues')) return 'Dues'
  if (pathname.includes('/documents')) return 'Documents'
  if (pathname.includes('/polls')) return 'Polls'
  if (pathname.includes('/settings')) return 'Settings'
  return orgName
}

interface Org {
  id: string
  name: string
  location?: string
  logo?: string | null
  icon_color?: string
  dues_label?: string
  menu_hidden_pages?: string[]
}

export function OrgLayout() {
  const { orgId } = useParams<{ orgId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const [org, setOrg] = useState<Org | null>(null)
  const [role, setRole] = useState<OrgRole>('member')
  const [unreadChatCount, setUnreadChatCount] = useState(0)
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const fetchOrg = () => {
    if (!orgId) return
    api
      .get(`/organizations/${orgId}`)
      .then((orgRes) => setOrg(orgRes.data))
      .catch(() => setOrg(null))
  }

  useEffect(() => {
    if (!orgId) return
    Promise.all([
      api.get(`/organizations/${orgId}`),
      api.get(`/organizations/${orgId}/members/me`),
    ])
      .then(([orgRes, memberRes]) => {
        setOrg(orgRes.data)
        setRole(memberRes.data.role || 'member')
      })
      .catch(() => {
        setOrg(null)
        navigate('/user-dashboard')
      })
      .finally(() => setLoading(false))
  }, [orgId, navigate])

  useEffect(() => {
    const handleOrgUpdated = (e: CustomEvent<{ orgId: string }>) => {
      if (e.detail.orgId === orgId) fetchOrg()
    }
    window.addEventListener('orgUpdated', handleOrgUpdated as EventListener)
    return () => window.removeEventListener('orgUpdated', handleOrgUpdated as EventListener)
  }, [orgId])

  useEffect(() => {
    if (location.pathname.includes('/chat')) {
      setUnreadChatCount(0)
      if (orgId) localStorage.setItem(`unreadChat_${orgId}`, '0')
    }
  }, [location.pathname, orgId])

  useEffect(() => {
    if (location.pathname.includes('/messages')) {
      setUnreadMessagesCount(0)
    }
  }, [location.pathname])

  useEffect(() => {
    if (!orgId) return
    function fetchUnreadMessages() {
      if (location.pathname.includes('/messages')) return
      api
        .get(`/organizations/${orgId}/dm/conversations`)
        .then((r) => {
          if (location.pathname.includes('/messages')) return
          const list = Array.isArray(r.data) ? r.data : []
          const total = list.reduce((sum: number, c: { unread_count?: number }) => sum + (c.unread_count ?? 0), 0)
          setUnreadMessagesCount(total)
        })
        .catch(() => setUnreadMessagesCount(0))
    }
    fetchUnreadMessages()
    const interval = setInterval(fetchUnreadMessages, 30000)
    return () => clearInterval(interval)
  }, [orgId, location.pathname])

  useEffect(() => {
    const handleNewMessage = (e: CustomEvent<{ orgId: string }>) => {
      if (e.detail.orgId === orgId && !location.pathname.includes('/chat')) {
        setUnreadChatCount((prev) => prev + 1)
      }
    }
    window.addEventListener('newChatMessage' as never, handleNewMessage as never)
    return () =>
      window.removeEventListener('newChatMessage' as never, handleNewMessage as never)
  }, [orgId, location.pathname])

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  // Prevent body scroll so header and chat stay fixed; no page-level scroll on mobile
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
      </div>
    )
  }

  if (!org) {
    return null
  }

  const currentPageTitle = getPageTitle(location.pathname, org.name)
  const isChatPage = location.pathname.includes('/chat')

  return (
    <div className="h-[100dvh] lg:h-screen w-full max-w-[100vw] overflow-hidden bg-black text-white flex touch-pan-y">
      {/* Desktop sidebar - fixed, always visible on lg+ */}
      <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:w-64 lg:z-30 bg-black border-r border-zinc-800">
        <OrganizationSidebar
          org={org}
          role={role}
          unreadChatCount={unreadChatCount}
          unreadMessagesCount={unreadMessagesCount}
        />
      </aside>

      {/* Mobile overlay backdrop */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/50"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden
        />
      )}

      {/* Mobile slide-out drawer */}
      <div
        className={`
          lg:hidden fixed top-0 left-0 h-full w-72 z-50
          bg-black border-r border-zinc-800
          transform transition-transform duration-300 ease-in-out
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <OrganizationSidebar
          org={org}
          role={role}
          unreadChatCount={unreadChatCount}
          unreadMessagesCount={unreadMessagesCount}
          onClose={() => setMobileMenuOpen(false)}
          isMobile
        />
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0 max-w-full overflow-x-hidden lg:ml-64">
        {/* Mobile header - hamburger + title */}
        <header className="lg:hidden sticky top-0 z-40 h-14 min-h-[44px] pt-[env(safe-area-inset-top)] bg-black border-b border-zinc-800 flex items-center px-4 shrink-0">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="p-3 -ml-3 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Open menu"
          >
            <Menu size={28} />
          </button>
          <h1 className="flex-1 ml-2 text-lg font-semibold text-white truncate min-w-0">
            {currentPageTitle}
          </h1>
          <div id="chat-header-extra" className="flex shrink-0 items-center justify-end gap-2 min-w-0 relative" />
        </header>

        <main
          className={
            isChatPage
              ? 'flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden pt-0'
              : 'flex-1 overflow-auto overflow-x-hidden pt-0'
          }
        >
          {isChatPage ? (
            <Outlet />
          ) : (
            <div className="p-4 md:p-6 lg:p-8">
              <Outlet />
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
