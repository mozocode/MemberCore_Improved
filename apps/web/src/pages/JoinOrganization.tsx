import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { LogIn, UserPlus, Loader2, Users } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'

type OrgPublic = {
  id: string
  name: string
  description?: string
  logo?: string
  icon_color?: string
  invite_code?: string
}

const API_BASE = import.meta.env.VITE_BACKEND_URL || '/api'

type JoinOrganizationProps = { slug?: string }

export function JoinOrganization({ slug: slugProp }: JoinOrganizationProps = {}) {
  const params = useParams<{ slug?: string; code?: string }>()
  const slug = slugProp ?? params.slug
  const code = params.code
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()

  const [organization, setOrganization] = useState<OrgPublic | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [membershipPending, setMembershipPending] = useState(false)

  const isAuthenticated = !!user

  useEffect(() => {
    if (!slug && !code) {
      setLoading(false)
      return
    }

    const fetchOrganization = async () => {
      try {
        const url = slug
          ? `${API_BASE}/organizations/by-slug/${encodeURIComponent(slug)}`
          : `${API_BASE}/organizations/by-invite/${encodeURIComponent(code!)}`
        const res = await fetch(url)
        if (!res.ok) {
          if (res.status === 404) {
            setError('Organization not found. The link may be invalid or expired.')
          } else {
            setError('Failed to load organization')
          }
          setLoading(false)
          return
        }
        const data = await res.json()
        setOrganization(data)
      } catch {
        setError('Failed to load organization')
      } finally {
        setLoading(false)
      }
    }

    fetchOrganization()
  }, [slug, code])

  const handleJoin = async () => {
    if (!organization) return

    if (!isAuthenticated) {
      const returnUrl = window.location.pathname
      navigate(`/signin?return=${encodeURIComponent(returnUrl)}`)
      return
    }

    setJoining(true)
    setJoinError('')

    try {
      const joinByCode = organization.invite_code
        ? api.post(`/organizations/join/${organization.invite_code}`)
        : api.post(`/organizations/${organization.id}/join`)

      const { data } = await joinByCode

      if (data.status === 'pending') {
        setMembershipPending(true)
      } else {
        navigate(`/org/${organization.id}`)
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string }; status?: number } }
      const detail = e.response?.data?.detail as string | undefined

      if (e.response?.status === 401) {
        const returnUrl = window.location.pathname
        navigate(`/signin?return=${encodeURIComponent(returnUrl)}`)
        return
      }
      if (detail?.toLowerCase().includes('already a member')) {
        navigate(`/org/${organization.id}`)
        return
      }
      if (detail?.toLowerCase().includes('pending')) {
        setMembershipPending(true)
        return
      }
      setJoinError(detail || 'Failed to join organization')
    } finally {
      setJoining(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-white animate-spin" />
      </div>
    )
  }

  // /join with no code: show form to enter code
  if (!slug && !code) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="bg-zinc-900 rounded-2xl p-8 max-w-md w-full border border-zinc-800">
          <h1 className="text-2xl font-bold text-white mb-2">Join an organization</h1>
          <p className="text-gray-400 text-sm mb-6">
            Enter the invite code you received, or use the full invite link (e.g. membercore.io/join/<strong>ABC12345</strong>).
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const value = (e.currentTarget.elements.namedItem('code') as HTMLInputElement)?.value?.trim().toUpperCase()
              if (value) navigate(`/join/${value}`)
            }}
            className="space-y-4"
          >
            <input
              name="code"
              type="text"
              placeholder="e.g. ABC12345"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder:text-zinc-500"
              maxLength={20}
            />
            <button type="submit" className="w-full bg-white hover:bg-gray-100 text-black font-medium py-3 rounded-lg">
              Continue
            </button>
          </form>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="bg-zinc-900 rounded-2xl p-8 max-w-md w-full text-center border border-zinc-800">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-xl font-semibold text-white mb-2">Organization Not Found</h1>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg"
          >
            Go to Home
          </button>
        </div>
      </div>
    )
  }

  if (!organization) return null

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="bg-zinc-900 rounded-2xl p-8 max-w-md w-full border border-zinc-800">
        <div className="text-center mb-8">
          {organization.logo ? (
            <img
              src={organization.logo}
              alt={organization.name}
              className="w-20 h-20 rounded-full mx-auto mb-4 object-cover"
            />
          ) : (
            <div
              className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center text-2xl font-bold"
              style={{
                backgroundColor: `${organization.icon_color || '#3f3f46'}20`,
                color: organization.icon_color || '#3f3f46',
              }}
            >
              {organization.name.charAt(0).toUpperCase()}
            </div>
          )}
          <h1 className="text-2xl font-bold text-white mb-2">{organization.name}</h1>
          {organization.description && (
            <p className="text-gray-400 text-sm">{organization.description}</p>
          )}
        </div>

        <div className="space-y-4">
          {membershipPending ? (
            <>
              <div className="bg-brand-orange/20 border border-brand-orange/30 rounded-lg p-4 text-center">
                <p className="text-brand-orange font-medium">Your membership is pending approval</p>
                <p className="text-gray-400 text-sm mt-2">
                  The organization owner will review your request. You&apos;ll be notified once approved.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/user-dashboard')}
                className="w-full flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white font-medium py-3 rounded-lg"
              >
                Go to Dashboard
              </button>
            </>
          ) : (
            <>
              <p className="text-center text-gray-400 text-sm">
                You&apos;ve been invited to join this organization
              </p>

              {joinError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center">
                  <p className="text-red-400 text-sm">{joinError}</p>
                </div>
              )}

              {isAuthenticated ? (
                <button
                  type="button"
                  onClick={handleJoin}
                  disabled={joining}
                  className="w-full flex items-center justify-center gap-2 bg-white hover:bg-gray-100 text-black font-medium py-3 rounded-lg disabled:opacity-50"
                >
                  {joining ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <UserPlus size={18} />
                      Join Organization
                    </>
                  )}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const returnUrl = window.location.pathname
                      navigate(`/signin?return=${encodeURIComponent(returnUrl)}`)
                    }}
                    className="w-full flex items-center justify-center gap-2 bg-white hover:bg-gray-100 text-black font-medium py-3 rounded-lg"
                  >
                    <LogIn size={18} />
                    Sign In to Join
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const returnUrl = window.location.pathname
                      navigate(`/signup?return=${encodeURIComponent(returnUrl)}`)
                    }}
                    className="w-full flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white font-medium py-3 rounded-lg"
                  >
                    <UserPlus size={18} />
                    Create Account to Join
                  </button>
                  <p className="text-center text-gray-500 text-xs">
                    Sign in or create an account to request membership
                  </p>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
