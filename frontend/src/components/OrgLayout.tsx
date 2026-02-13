import { useState, useEffect } from 'react'
import { Outlet, useParams, useNavigate, useLocation } from 'react-router-dom'
import { OrganizationSidebar } from '@/components/OrganizationSidebar'
import { api } from '@/lib/api'
import { Loader2, Menu } from 'lucide-react'
import type { OrgRole } from '@/lib/permissions'

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
    const handleNewMessage = (e: CustomEvent<{ orgId: string }>) => {
      if (e.detail.orgId === orgId && !location.pathname.includes('/chat')) {
        setUnreadChatCount((prev) => prev + 1)
      }
    }
    window.addEventListener('newChatMessage' as never, handleNewMessage as never)
    return () =>
      window.removeEventListener('newChatMessage' as never, handleNewMessage as never)
  }, [orgId, location.pathname])

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

  return (
    <div className="min-h-screen bg-black text-white flex">
      <div className="hidden md:block sticky top-0 h-screen">
        <OrganizationSidebar
          org={org}
          role={role}
          unreadChatCount={unreadChatCount}
        />
      </div>

      {mobileMenuOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden
          />
          <div className="md:hidden fixed inset-y-0 left-0 z-50">
            <OrganizationSidebar
              org={org}
              role={role}
              unreadChatCount={unreadChatCount}
              onClose={() => setMobileMenuOpen(false)}
              isMobile
            />
          </div>
        </>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden sticky top-0 z-30 h-14 bg-zinc-900 border-b border-zinc-800 flex items-center px-4">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 text-zinc-400 hover:text-white"
          >
            <Menu size={24} />
          </button>
          <h1 className="ml-3 text-lg font-semibold text-white truncate">{org.name}</h1>
        </header>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
