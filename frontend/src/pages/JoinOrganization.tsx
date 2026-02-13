import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ArrowLeft } from 'lucide-react'

export function JoinOrganization() {
  const navigate = useNavigate()
  const { code } = useParams<{ code: string }>()
  const [inviteCode, setInviteCode] = useState(code?.toUpperCase() ?? '')
  const [error, setError] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = inviteCode.trim().toUpperCase()
    if (!trimmed) {
      setError('Enter your invite code')
      return
    }
    setError('')
    if (code) {
      navigate('/user-dashboard')
    } else {
      navigate(`/join/${trimmed}`)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <nav className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <Link to="/user-dashboard" className="flex items-center gap-2 text-zinc-400 hover:text-white">
          <ArrowLeft size={20} />
          Back
        </Link>
      </nav>
      <main className="max-w-md mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold mb-2">Join an organization</h1>
        <p className="text-zinc-400 mb-6">
          Enter the invite code you received. If you have a full invite link, the code is the last part of the URL (e.g. membercore.io/join/<strong>ABC12XYZ</strong>).
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="code" className="text-zinc-300">Invite code</Label>
            <Input
              id="code"
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="e.g. ABC12XYZ"
              className="mt-1 bg-zinc-900 border-zinc-700"
              maxLength={20}
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button type="submit" className="w-full">
            {code ? 'Go to dashboard' : 'Continue'}
          </Button>
        </form>
        <p className="text-sm text-zinc-500 mt-6">
          {code
            ? 'Use the full invite link from your invitation to complete joining.'
            : 'Continuing will open the invite. You must be signed in to join.'}
        </p>
      </main>
    </div>
  )
}
