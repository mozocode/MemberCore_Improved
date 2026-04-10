import { useState, useEffect } from 'react'
import { Outlet, useParams, useNavigate, useLocation } from 'react-router-dom'
import { OrganizationSidebar } from '@/components/OrganizationSidebar'
import { SignupFeedbackModal } from '@/components/SignupFeedbackModal'
import { TrialExitFeedbackModal } from '@/components/TrialExitFeedbackModal'
import { api } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2, Menu } from 'lucide-react'
import type { OrgRole } from '@/lib/permissions'

const TRIAL_DAYS = 30

function parseOrgDate(val: string | { _seconds: number } | undefined): Date | null {
  if (!val) return null
  if (typeof val === 'string') return new Date(val)
  if (typeof val === 'object' && val !== null && '_seconds' in val) {
    return new Date((val as { _seconds: number })._seconds * 1000)
  }
  return null
}

function getTrialEnd(org: OrgLayoutOrg): Date | null {
  const end = parseOrgDate(org.trial_end_date as string | { _seconds: number } | undefined)
  if (end) return end
  const start = parseOrgDate(org.trial_start_date)
  if (!start) return null
  const d = new Date(start)
  d.setDate(d.getDate() + TRIAL_DAYS)
  return d
}

function isTrialExpiredWithoutPro(org: OrgLayoutOrg): boolean {
  if (org.is_pro || org.platform_admin_owned || org.billing_exempt) return false
  const end = getTrialEnd(org)
  return end !== null && end.getTime() <= Date.now()
}

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

interface OrgLayoutOrg {
  id: string
  name: string
  location?: string
  logo?: string | null
  icon_color?: string
  dues_label?: string
  menu_hidden_pages?: string[]
  feedback_flags?: { signup_captured?: boolean; trial_exit_captured?: boolean }
  is_pro?: boolean
  platform_admin_owned?: boolean
  billing_exempt?: boolean
  billing_status?: string
  trial_start_date?: string | { _seconds: number }
  trial_end_date?: string | { _seconds: number }
}

function isBillingActiveForOrg(org: OrgLayoutOrg): boolean {
  if (org.is_pro || org.platform_admin_owned || org.billing_exempt) return true
  const status = String(org.billing_status || '').toLowerCase()
  if (status === 'active' || status === 'trial' || status === 'exempt') return true
  // Backward-compatible fallback: orgs without explicit billing_status are in trial
  // as long as trial_start_date/trial_end_date indicates the 30-day window is active.
  const trialEnd = getTrialEnd(org)
  return trialEnd !== null && trialEnd.getTime() > Date.now()
}

function isPathAllowedWhileInactive(pathname: string): boolean {
  if (pathname.includes('/calendar')) return true
  if (pathname.includes('/directory')) return true
  if (pathname.includes('/settings')) {
    if (pathname.includes('/settings/personal')) return true
    if (pathname.includes('/settings/my-tickets')) return true
    if (!pathname.includes('/settings/')) return true // settings index view
    return false
  }
  // Keep org home accessible so admins can still see billing/trial notice.
  return /^\/org\/[^/]+$/.test(pathname)
}

export function OrgLayout() {
  const { orgId } = useParams<{ orgId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const [org, setOrg] = useState<OrgLayoutOrg | null>(null)
  const [role, setRole] = useState<OrgRole>('member')
  const [unreadChatCount, setUnreadChatCount] = useState(0)
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0)
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0)
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
    if (!orgId) return
    if (role !== 'owner' && role !== 'admin') {
      setPendingApprovalsCount(0)
      return
    }
    let cancelled = false
    const fetchPendingApprovals = () => {
      api
        .get(`/organizations/${orgId}/members`, { params: { status_filter: 'pending' } })
        .then((r) => {
          if (cancelled) return
          setPendingApprovalsCount(Array.isArray(r.data) ? r.data.length : 0)
        })
        .catch(() => {
          if (!cancelled) setPendingApprovalsCount(0)
        })
    }
    fetchPendingApprovals()
    const interval = setInterval(fetchPendingApprovals, 30000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [orgId, role])

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

  useEffect(() => {
    if (!orgId || !org) return
    const billingActive = isBillingActiveForOrg(org)
    if (billingActive) return
    if (isPathAllowedWhileInactive(location.pathname)) return
    if (location.pathname.includes('/settings/')) {
      navigate(`/org/${orgId}/settings/personal`, { replace: true })
      return
    }
    navigate(`/org/${orgId}/calendar`, { replace: true })
  }, [orgId, org, location.pathname, navigate])

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
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 text-center gap-4">
        <p className="text-zinc-400 text-sm max-w-sm">
          We could not load this organization. You may have been redirected to your dashboard.
        </p>
        <button
          type="button"
          onClick={() => navigate('/user-dashboard')}
          className="text-white underline text-sm font-medium"
        >
          Go to dashboard
        </button>
      </div>
    )
  }

  const currentPageTitle = getPageTitle(location.pathname, org.name)
  const isChatPage = location.pathname.includes('/chat')
  const billingActive = isBillingActiveForOrg(org)

  // Feedback modals: for org owners and admins, one-time per org
  const isOwnerOrAdmin = role === 'owner' || role === 'admin'
  const signupCaptured = org.feedback_flags?.signup_captured === true
  const trialExitCaptured = org.feedback_flags?.trial_exit_captured === true
  const trialExpiredNoPro = isTrialExpiredWithoutPro(org)
  const showSignupModal = isOwnerOrAdmin && !signupCaptured
  const showTrialExitModal = isOwnerOrAdmin && trialExpiredNoPro && !trialExitCaptured && !showSignupModal

  return (
    <div className="h-[100dvh] lg:h-screen w-full max-w-[100vw] overflow-hidden bg-black text-white flex touch-pan-y">
      {user && orgId && (
        <>
          <SignupFeedbackModal
            open={showSignupModal}
            onClose={() => {}}
            onSubmitted={() => fetchOrg()}
            orgId={orgId}
            userId={user.id}
          />
          <TrialExitFeedbackModal
            open={showTrialExitModal}
            onClose={() => {}}
            onSubmitted={() => fetchOrg()}
            orgId={orgId}
            userId={user.id}
          />
        </>
      )}
      {/* Desktop sidebar - fixed, always visible on lg+ */}
      <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:w-64 lg:z-30 bg-black border-r border-zinc-800">
        <OrganizationSidebar
          org={org}
          role={role}
          billingActive={billingActive}
          unreadChatCount={unreadChatCount}
          unreadMessagesCount={unreadMessagesCount}
          pendingApprovalsCount={pendingApprovalsCount}
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
          billingActive={billingActive}
          unreadChatCount={unreadChatCount}
          unreadMessagesCount={unreadMessagesCount}
          pendingApprovalsCount={pendingApprovalsCount}
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
