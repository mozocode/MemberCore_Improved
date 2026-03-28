import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { Loader2, MoreVertical, LogOut } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { adminApi } from '@/lib/api'

const NAV_ITEMS = [
  { path: '/super-admin', label: 'Overview' },
  { path: '/super-admin/growth', label: 'Growth & revenue' },
  { path: '/super-admin/activation', label: 'Activation' },
  { path: '/super-admin/acquisition', label: 'Acquisition & CAC' },
  { path: '/super-admin/users', label: 'Users' },
  { path: '/super-admin/organizations', label: 'Organizations' },
  { path: '/super-admin/verification', label: 'Verification' },
  { path: '/super-admin/club-type-requests', label: 'Organization type requests' },
  { path: '/super-admin/billing', label: 'Billing' },
  { path: '/super-admin/feedback', label: 'Feedback' },
  { path: '/super-admin/reports', label: 'Reports' },
]

export function AdminLayout({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode
  title: string
  subtitle?: string
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, loading: authLoading, signout } = useAuth()
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showMenu, setShowMenu] = useState(false)

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/signin')
      return
    }
    if (!user) return
    // Fast path: trust server-provided /auth/me admin flag to avoid blocking UI
    // on a second network call every time this layout mounts.
    if (user.is_platform_admin) {
      setIsAdmin(true)
      setLoading(false)
      // Keep an async server verification in the background so revoked access
      // still redirects without making the initial render feel stuck.
      adminApi.verifyAccess().catch(() => navigate('/user-dashboard'))
      return
    }

    let done = false
    const finish = (fn: () => void) => {
      if (done) return
      done = true
      fn()
    }
    const timeout = window.setTimeout(() => {
      finish(() => navigate('/user-dashboard'))
    }, 12000)

    adminApi
      .verifyAccess()
      .then(() => finish(() => {
        setIsAdmin(true)
        setLoading(false)
      }))
      .catch(() => finish(() => navigate('/user-dashboard')))
      .finally(() => window.clearTimeout(timeout))
  }, [user, authLoading, navigate])

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
      </div>
    )
  }
  if (!isAdmin) return null

  return (
    <div className="min-h-screen bg-[#0f1117] text-white flex">
      <aside className="w-64 border-r border-gray-800 p-4 flex flex-col">
        <div className="mb-6">
          <div className="text-xs text-gray-500 mb-1">Signed in as</div>
          <div className="text-sm text-white truncate">{user?.email}</div>
        </div>
        <nav className="flex-1 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`block px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive ? 'bg-gray-800 text-white' : 'text-gray-400 hover:bg-gray-800/50 hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      </aside>
      <main className="flex-1 p-8 relative">
        <div className="absolute top-8 right-8 flex items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 rounded-lg hover:bg-gray-800 text-gray-400"
            >
              <MoreVertical className="h-5 w-5" />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 mt-1 py-1 w-48 bg-[#1a1d24] border border-gray-800 rounded-lg shadow-xl z-20">
                  <button
                    type="button"
                    onClick={() => { signout(); navigate('/signin') }}
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-300 hover:bg-gray-800"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        <div className="max-w-6xl mx-auto">
          <header className="mb-6">
            <h1 className="text-2xl font-semibold text-white">{title}</h1>
            {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
          </header>
          {children}
        </div>
      </main>
    </div>
  )
}
