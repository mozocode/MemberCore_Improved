import { useState } from 'react'
import { Check, HelpCircle, Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'

interface PublicRsvpSectionProps {
  eventId: string
  userRsvp: string | null
  onRsvpChange: (status: string | null) => void
}

export function PublicRsvpSection({ eventId, userRsvp, onRsvpChange }: PublicRsvpSectionProps) {
  const { user } = useAuth()
  const isAuthenticated = !!user
  const [loading, setLoading] = useState(false)

  const handleRsvp = async (status: string) => {
    if (!isAuthenticated) {
      const redirect = `/signin?redirect=${encodeURIComponent(`/events/${eventId}`)}`
      window.location.href = redirect
      return
    }
    setLoading(true)
    try {
      await api.post(`/events/public/${eventId}/rsvp`, { status })
      onRsvpChange(status)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = async () => {
    if (!isAuthenticated) return
    setLoading(true)
    try {
      await api.delete(`/events/public/${eventId}/rsvp`)
      onRsvpChange(null)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  const currentStatus = userRsvp

  if (currentStatus) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Check className="h-5 w-5 text-green-400" />
          <span className="text-white">
            {currentStatus === 'yes' ? "You're going!" : 'You responded Maybe'}
          </span>
        </div>
        <div className="flex gap-2">
          {currentStatus !== 'yes' && (
            <Button
              onClick={() => handleRsvp('yes')}
              disabled={loading}
              className="flex-1 bg-white text-black hover:bg-zinc-200"
            >
              Going
            </Button>
          )}
          {currentStatus !== 'maybe' && (
            <Button
              onClick={() => handleRsvp('maybe')}
              disabled={loading}
              variant="outline"
              className="flex-1 bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700"
            >
              Maybe
            </Button>
          )}
          <Button
            onClick={handleCancel}
            disabled={loading}
            variant="outline"
            className="text-red-400 border-red-400/30 hover:bg-red-400/10"
          >
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-2">
      <Button
        onClick={() => handleRsvp('yes')}
        disabled={loading}
        className="flex-1 flex items-center justify-center gap-2 bg-white text-black hover:bg-zinc-200"
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <>
            <Check className="h-5 w-5" />
            Going
          </>
        )}
      </Button>
      <Button
        onClick={() => handleRsvp('maybe')}
        disabled={loading}
        variant="outline"
        className="flex-1 flex items-center justify-center gap-2 bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700"
      >
        <HelpCircle className="h-5 w-5" />
        Maybe
      </Button>
    </div>
  )
}
