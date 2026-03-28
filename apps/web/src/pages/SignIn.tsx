import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { GoogleLogin } from '@react-oauth/google'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { Loader2 } from 'lucide-react'

function safeReturnPath(returnParam: string | null): string | null {
  if (!returnParam || typeof returnParam !== 'string') return null
  const path = decodeURIComponent(returnParam).replace(/^\/+/, '/')
  if (
    path.startsWith('/org/') ||
    path.startsWith('/join') ||
    path.startsWith('/invite/') ||
    path.startsWith('/super-admin')
  ) {
    return path
  }
  return null
}

export function SignIn() {
  const [searchParams] = useSearchParams()
  const returnTo = safeReturnPath(searchParams.get('return'))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signin, signinWithGoogle } = useAuth()
  const { success, error: toastError } = useToast()
  const navigate = useNavigate()
  const googleEnabled = !!import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signin(email, password)
      success('Welcome back!')
      navigate(returnTo || '/user-dashboard')
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string }; status?: number }; message?: string; code?: string }
      const detail = e.response?.data?.detail
      const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      if (e.code === 'ECONNABORTED' || e.message?.includes('timeout')) {
        setError(
          isLocalDev
            ? 'Request timed out. Check that the backend is running: in the project root run "cd backend && source venv/bin/activate && uvicorn app.main:app --reload --port 8001". Then open http://localhost:8001/api/health in your browser to confirm.'
            : 'Request timed out. Please try again in a moment.'
        )
      } else if (e.message === 'Network Error' || e.code === 'ERR_NETWORK') {
        setError(
          isLocalDev
            ? 'Cannot reach the backend. Start it with: cd backend && source venv/bin/activate && uvicorn app.main:app --reload --port 8001'
            : 'Unable to reach the server. Please check your connection and try again.'
        )
      } else if (e.response?.status === 500) {
        setError('Something went wrong on our end. Please try again later.')
      } else {
        const msg = detail || e.message || 'Sign in failed'
        setError(msg)
        toastError(msg)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <Card className="w-full max-w-md border-zinc-800">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Enter your credentials to access your account</CardDescription>
        </CardHeader>
        <CardContent>
          {googleEnabled && (
            <>
              <div className="mb-4 flex justify-center">
                <GoogleLogin
                  onSuccess={async (credentialResponse) => {
                    const idToken = credentialResponse.credential
                    if (!idToken) {
                      setError('Google sign in failed. Please try again.')
                      return
                    }
                    setError('')
                    setLoading(true)
                    try {
                      await signinWithGoogle(idToken)
                      success('Welcome back!')
                      navigate(returnTo || '/user-dashboard')
                    } catch (err: any) {
                      const msg = err?.response?.data?.detail || err?.message || 'Google sign in failed'
                      setError(msg)
                      toastError(msg)
                    } finally {
                      setLoading(false)
                    }
                  }}
                  onError={() => setError('Google sign in failed. Please try again.')}
                />
              </div>
              <div className="mb-4 flex items-center gap-2">
                <div className="h-px flex-1 bg-zinc-800" />
                <span className="text-xs uppercase tracking-wide text-zinc-500">or</span>
                <div className="h-px flex-1 bg-zinc-800" />
              </div>
            </>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Link
              to="/forgot-password"
              className="text-sm text-zinc-400 hover:text-white block"
            >
              Forgot password?
            </Link>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sign in'}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-zinc-400">
            Don't have an account?{' '}
            <Link to="/signup" className="text-white hover:underline">
              Sign up
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
