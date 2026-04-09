import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { inviteApi } from '@/lib/api'
import { Button } from '@/components/ui/button'

interface ResolvedInvite {
  orgId: string
  orgName: string
  email: string
  firstName: string
  existingUser: boolean
}

export function InviteAccept() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const navigate = useNavigate()
  const { user, signup } = useAuth()
  const [invite, setInvite] = useState<ResolvedInvite | null>(null)
  const [resolveError, setResolveError] = useState<string | null>(null)
  const [accepting, setAccepting] = useState(false)
  const [signupLoading, setSignupLoading] = useState(false)
  const [signupError, setSignupError] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formFirstName, setFormFirstName] = useState('')
  const [formLastName, setFormLastName] = useState('')
  const [formPassword, setFormPassword] = useState('')

  useEffect(() => {
    if (!token) {
      setResolveError('Missing invite token.')
      return
    }
    inviteApi
      .resolve(token)
      .then((data) => {
        setInvite(data)
        setFormEmail(data.email)
        setFormFirstName(data.firstName || '')
        setFormLastName('')
      })
      .catch((err: { response?: { status?: number; data?: { detail?: string } } }) => {
        const detail = err.response?.data?.detail
        if (err.response?.status === 410) {
          setResolveError('This invite has already been used.')
        } else if (detail) {
          setResolveError(typeof detail === 'string' ? detail : 'This invite link is no longer valid.')
        } else {
          setResolveError('This invite link is no longer valid. Please contact your organization to request a new invite.')
        }
      })
  }, [token])

  // When existing user returns from sign-in, auto-accept and redirect.
  // Must stay before any conditional returns to preserve hook order.
  useEffect(() => {
    if (!token || !invite?.existingUser || !user) return
    if ((user.email || '').toLowerCase() !== invite.email.toLowerCase()) return
    let cancelled = false
    inviteApi
      .accept(token)
      .then((res) => {
        if (!cancelled) navigate(`/org/${res.orgId}`, { replace: true })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [token, invite, user, navigate])

  const handleJoin = async () => {
    if (!token || !invite) return
    setAccepting(true)
    try {
      const res = await inviteApi.accept(token)
      navigate(`/org/${res.orgId}`, { replace: true })
    } catch {
      setResolveError('Something went wrong. Please try again.')
    } finally {
      setAccepting(false)
    }
  }

  const handleCreateAccountAndJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token || !invite) return
    setSignupError('')
    setSignupLoading(true)
    try {
      await signup(formEmail, formFirstName, formLastName, formPassword)
      await inviteApi.accept(token)
      navigate(`/org/${invite.orgId}`, { replace: true })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setSignupError(typeof msg === 'string' ? msg : 'Could not create account. Please try again.')
    } finally {
      setSignupLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-xl bg-zinc-900 border border-zinc-700 p-8 text-center">
          <p className="text-zinc-400 mb-4">Missing invite link.</p>
          <Link to="/signin" className="text-brand-orange hover:underline">Go to Sign In</Link>
        </div>
      </div>
    )
  }

  if (resolveError) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-xl bg-zinc-900 border border-zinc-700 p-8 text-center">
          <p className="text-zinc-300 mb-4">{resolveError}</p>
          <Link to="/signin" className="text-brand-orange hover:underline">Sign in</Link>
          <span className="text-zinc-500 mx-2">or</span>
          <Link to="/" className="text-brand-orange hover:underline">Go home</Link>
        </div>
      </div>
    )
  }

  if (!invite) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <div className="text-zinc-400">Loading invite…</div>
      </div>
    )
  }

  const isLoggedInAsInviteEmail = user && (user.email || '').toLowerCase() === invite.email.toLowerCase()

  // Existing user + already signed in as this email → one-click Join
  if (invite.existingUser && isLoggedInAsInviteEmail) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-xl bg-zinc-900 border border-zinc-700 p-8 text-center">
          <h1 className="text-xl font-semibold text-white mb-2">Join {invite.orgName}</h1>
          <p className="text-zinc-400 mb-6">You’ve been invited to join this organization on MemberCore.</p>
          <Button
            onClick={handleJoin}
            disabled={accepting}
            className="w-full bg-brand-orange hover:bg-brand-orange/90 text-white"
          >
            {accepting ? 'Joining…' : `Join ${invite.orgName} on MemberCore`}
          </Button>
        </div>
      </div>
    )
  }

  // Existing user but not signed in (or wrong account) → prompt sign in
  if (invite.existingUser) {
    const signInReturn = `/invite/accept?token=${encodeURIComponent(token)}`
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-xl bg-zinc-900 border border-zinc-700 p-8 text-center">
          <h1 className="text-xl font-semibold text-white mb-2">Join {invite.orgName}</h1>
          <p className="text-zinc-400 mb-6">
            Sign in with <strong className="text-zinc-300">{invite.email}</strong> to accept this invite.
          </p>
          <Link to={`/signin?return=${encodeURIComponent(signInReturn)}`}>
            <Button className="w-full bg-brand-orange hover:bg-brand-orange/90 text-white">
              Sign in to join
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  // New user → create account form
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-xl bg-zinc-900 border border-zinc-700 p-8">
        <h1 className="text-xl font-semibold text-white mb-2">Create your account to join {invite.orgName}</h1>
        <p className="text-zinc-400 mb-6">
          {invite.orgName} invited you to MemberCore. Enter your details below to join.
        </p>
        <form onSubmit={handleCreateAccountAndJoin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Email</label>
            <input
              type="email"
              value={formEmail}
              readOnly
              className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-600 text-zinc-400 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">First name</label>
            <input
              type="text"
              value={formFirstName}
              onChange={(e) => setFormFirstName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-600 text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Last name (optional)</label>
            <input
              type="text"
              value={formLastName}
              onChange={(e) => setFormLastName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-600 text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Password</label>
            <input
              type="password"
              value={formPassword}
              onChange={(e) => setFormPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-600 text-white"
            />
          </div>
          {signupError && <p className="text-sm text-red-400">{signupError}</p>}
          <Button
            type="submit"
            disabled={signupLoading}
            className="w-full bg-brand-orange hover:bg-brand-orange/90 text-white"
          >
            {signupLoading ? 'Creating account…' : `Create account & join ${invite.orgName}`}
          </Button>
        </form>
      </div>
    </div>
  )
}
