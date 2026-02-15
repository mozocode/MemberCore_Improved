import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2 } from 'lucide-react'

function safeReturnPath(returnParam: string | null): string | null {
  if (!returnParam || typeof returnParam !== 'string') return null
  const path = decodeURIComponent(returnParam).replace(/^\/+/, '/')
  if (path.startsWith('/org/') || path.startsWith('/join')) return path
  return null
}

export function SignIn() {
  const [searchParams] = useSearchParams()
  const returnTo = safeReturnPath(searchParams.get('return'))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signin } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signin(email, password)
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
        setError(detail || e.message || 'Sign in failed')
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
