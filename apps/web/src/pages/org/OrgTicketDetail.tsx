import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Calendar, MapPin, Ticket, CheckCircle } from 'lucide-react'
import QRCode from 'react-qr-code'
import { api } from '@/lib/api'

interface TicketDetail {
  ticket_id: string
  short_code?: string
  event_id: string
  event_title: string
  event_start_time?: string
  event_end_time?: string
  event_location?: string
  event_cover_image?: string
  organization_id: string
  organization_name: string
  status: string
  checked_in: boolean
  checked_in_at?: string
  amount: number
  amount_cents?: number
  quantity: number
  purchased_at?: string
  qr_code?: string
}

export function OrgTicketDetail() {
  const { orgId, ticketId } = useParams<{ orgId: string; ticketId: string }>()
  const navigate = useNavigate()
  const [ticket, setTicket] = useState<TicketDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!orgId || !ticketId) return
    api
      .get(`/payments/${orgId}/tickets/${ticketId}`)
      .then((r) => setTicket(r.data))
      .catch(() => setTicket(null))
      .finally(() => setLoading(false))
  }, [orgId, ticketId])

  const formatDate = (dateString?: string) => {
    if (!dateString) return null
    const d = new Date(dateString)
    return {
      day: d.toLocaleDateString(undefined, { weekday: 'long' }),
      date: d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }),
      time: d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
    }
  }

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-zinc-600 border-t-white rounded-full animate-spin" />
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <Ticket className="h-16 w-16 text-zinc-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Ticket not found</h2>
          <button
            type="button"
            onClick={() => navigate(`/org/${orgId}/settings`, { replace: true })}
            className="text-blue-400 hover:text-blue-300"
          >
            Back to My Tickets
          </button>
        </div>
      </div>
    )
  }

  const eventDate = formatDate(ticket.event_start_time)
  const isPast = ticket.event_start_time ? new Date(ticket.event_start_time) < new Date() : false

  return (
    <div className="min-h-screen bg-black">
      <header className="border-b border-zinc-800 bg-black sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 text-zinc-400 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold text-white">Ticket</h1>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900">
          {/* QR or status */}
          <div className={`p-8 ${isPast ? 'bg-zinc-800/50' : 'bg-white'}`}>
            <div className="flex justify-center">
              {ticket.checked_in ? (
                <div className="text-center">
                  <CheckCircle className="h-24 w-24 text-green-500 mx-auto mb-2" />
                  <p className="text-green-600 font-medium">Checked in</p>
                </div>
              ) : isPast ? (
                <div className="text-center">
                  <Ticket className="h-24 w-24 text-zinc-500 mx-auto mb-2" />
                  <p className="text-zinc-500">Event ended</p>
                </div>
              ) : (
                <div className="bg-white p-4 rounded-xl">
                  <QRCode value={ticket.ticket_id} size={180} level="H" />
                </div>
              )}
            </div>
          </div>

          <div className="relative">
            <div className="absolute left-0 w-6 h-6 bg-black rounded-full -translate-x-1/2" />
            <div className="absolute right-0 w-6 h-6 bg-black rounded-full translate-x-1/2" />
            <div className="border-t-2 border-dashed border-zinc-700 mx-6" />
          </div>

          <div className="p-6 space-y-6">
            <div className="text-center">
              <p className="text-sm text-zinc-400 mb-1">{ticket.organization_name}</p>
              <h2 className="text-xl font-bold text-white">{ticket.event_title}</h2>
            </div>

            {eventDate && (
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-zinc-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-white font-medium">{eventDate.day}</p>
                  <p className="text-zinc-400 text-sm">
                    {eventDate.date} at {eventDate.time}
                  </p>
                </div>
              </div>
            )}

            {ticket.event_location && (
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-zinc-400 mt-0.5 shrink-0" />
                <p className="text-white">{ticket.event_location}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-800">
              <div>
                <p className="text-xs text-zinc-500 uppercase mb-1">Ticket #</p>
                <p className="text-white font-mono text-sm">{ticket.short_code ?? `${ticket.ticket_id.slice(0, 8)}…`}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500 uppercase mb-1">Quantity</p>
                <p className="text-white">{ticket.quantity} ticket(s)</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500 uppercase mb-1">Amount paid</p>
                <p className="text-white">{formatPrice(ticket.amount)}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500 uppercase mb-1">Status</p>
                <p className={ticket.checked_in ? 'text-green-400' : 'text-blue-400'}>
                  {ticket.checked_in ? 'Checked in' : 'Valid'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <Link
          to={`/org/${ticket.organization_id}/calendar/${ticket.event_id}`}
          className="block text-center text-blue-400 hover:text-blue-300 mt-6"
        >
          View event
        </Link>
      </div>
    </div>
  )
}
