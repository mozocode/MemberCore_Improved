import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { useToast } from '@/contexts/ToastContext'

export function ForgotPassword() {
  const [searchParams] = useSearchParams()
  const initialEmail = useMemo(() => (searchParams.get('email') || '').trim(), [searchParams])
  const returnTo = useMemo(() => (searchParams.get('return') || '').trim(), [searchParams])
  const signinHref = returnTo ? `/signin?return=${encodeURIComponent(returnTo)}` : '/signin'
  const [email, setEmail] = useState(initialEmail)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const { success, error: toastError } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const normalized = email.trim().toLowerCase()
    if (!normalized) return
    setLoading(true)
    setError('')
    setMessage('')
    try {
      const res = await api.post('/auth/forgot-password', { email: normalized })
      const msg = res.data?.message || 'If that email exists, a reset link has been sent.'
      setMessage(msg)
      success('Reset email sent')
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      const msg = typeof detail === 'string' ? detail : 'Unable to send reset email. Please try again.'
      setError(msg)
      toastError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      <Card className="w-full max-w-md border-zinc-800">
        <CardHeader>
          <CardTitle>Forgot password</CardTitle>
          <CardDescription>Enter your account email and we will send a reset link.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{error}</div>}
            {message && <div className="text-sm text-emerald-300 bg-emerald-500/10 p-3 rounded-md">{message}</div>}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e: any) => setEmail(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send reset link'}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-zinc-400">
            Back to{' '}
            <Link to={signinHref} className="text-white hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
