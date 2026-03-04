import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Ticket, Loader2, TicketCheck } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'

interface PublicTicketSectionProps {
  eventId: string
  price: number
  currency?: string
  maxAttendees?: number
  ticketsSold?: number
  startTime?: string
  isSoldOut?: boolean
  isPast?: boolean
  paymentSuccess?: boolean
}

export function PublicTicketSection({
  eventId,
  price,
  currency = 'usd',
  maxAttendees,
  ticketsSold = 0,
  isSoldOut,
  isPast,
  paymentSuccess,
}: PublicTicketSectionProps) {
  const { user } = useAuth()
  const isAuthenticated = !!user
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [hasTicket, setHasTicket] = useState<boolean | null>(null)

  useEffect(() => {
    if (!isAuthenticated || !eventId || isPast) {
      setHasTicket(false)
      return
    }
    const fetchHasTicket = () => {
      api
        .get(`/payments/public/event/${eventId}/my-ticket`)
        .then(() => setHasTicket(true))
        .catch(() => setHasTicket(false))
    }
    fetchHasTicket()
    const t = paymentSuccess ? setTimeout(fetchHasTicket, 1500) : undefined
    return () => { if (t != null) clearTimeout(t) }
  }, [eventId, isAuthenticated, isPast, paymentSuccess])

  const formatPrice = () => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: (currency || 'usd').toUpperCase(),
    }).format(Number(price))
  }

  const handleBuyTicket = async () => {
    if (!isAuthenticated) {
      window.location.href = `/signin?redirect=${encodeURIComponent(`/events/${eventId}`)}`
      return
    }
    setLoading(true)
    setError('')
    try {
      const { data } = await api.post('/payments/public/checkout/event', {
        event_id: eventId,
        quantity: 1,
      })
      if (data?.checkout_url) {
        window.location.href = data.checkout_url
        return
      }
      setError('Failed to start checkout.')
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Failed to start checkout. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const disabled = loading || isSoldOut || isPast

  if (hasTicket === true) {
    return (
      <Link
        to={`/events/${eventId}/my-ticket`}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors bg-white text-black hover:bg-zinc-200"
      >
        <TicketCheck className="h-5 w-5" />
        View ticket
      </Link>
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleBuyTicket}
        disabled={disabled}
        className={`
          w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors
          ${disabled ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed' : 'bg-white text-black hover:bg-zinc-200'}
          disabled:opacity-50
        `}
      >
        {loading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Processing…
          </>
        ) : isSoldOut ? (
          'Sold out'
        ) : isPast ? (
          'Event ended'
        ) : (
          <>
            <Ticket className="h-5 w-5" />
            Buy ticket – {formatPrice()}
          </>
        )}
      </button>
      {error && <p className="text-sm text-red-400 text-center mt-2">{error}</p>}
      {!isSoldOut && !isPast && maxAttendees != null && (
        <p className="text-xs text-zinc-500 text-center mt-2">
          {Math.max(0, maxAttendees - ticketsSold)} tickets remaining
        </p>
      )}
    </div>
  )
}
