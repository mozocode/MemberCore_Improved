import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  Calendar,
  Clock,
  MapPin,
  Loader2,
  ArrowLeft,
  Users,
  Check,
  HelpCircle,
  X,
  Pencil,
  Trash2,
  Download,
  Ticket,
  CreditCard,
} from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { CreateEventModal } from '@/components/CreateEventModal'
import { getDisplayName } from '@/lib/displayName'

interface Attendee {
  user_id: string
  name: string
  initial: string
  avatar?: string
}

interface Event {
  id: string
  title: string
  description?: string
  location?: string
  start_time: string
  end_time?: string
  all_day?: boolean
  cover_image?: string
  is_paid?: boolean
  price?: number
  tickets_sold?: number
  max_attendees?: number
  event_type?: string
  my_rsvp?: string
  rsvp_counts?: { yes: number; maybe: number; no: number }
  attendees?: { yes: Attendee[]; maybe: Attendee[]; no: Attendee[] }
  created_by?: string
}

export function OrgEventDetail() {
  const { orgId, eventId } = useParams<{ orgId: string; eventId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [rsvpLoading, setRsvpLoading] = useState(false)
  const [myRole, setMyRole] = useState<string | null>(null)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [coverImageLoaded, setCoverImageLoaded] = useState(false)
  const [coverImageError, setCoverImageError] = useState(false)
  const [hasTicket, setHasTicket] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  const [exportingCsv, setExportingCsv] = useState(false)

  const fetchEvent = () => {
    if (!orgId || !eventId) return
    setLoading(true)
    api
      .get(`/events/${orgId}/${eventId}`)
      .then((r) => setEvent(r.data))
      .catch(() => setEvent(null))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!orgId || !eventId) return
    fetchEvent()
  }, [orgId, eventId])

  useEffect(() => {
    setCoverImageLoaded(false)
    setCoverImageError(false)
  }, [eventId])

  useEffect(() => {
    if (!orgId) return
    api
      .get(`/organizations/${orgId}/members/me`)
      .then((r) => setMyRole(String(r.data?.role ?? 'member')))
      .catch(() => setMyRole(null))
  }, [orgId])

  const refetchHasTicket = () => {
    if (!orgId || !eventId) return
    api
      .get(`/payments/${orgId}/my-tickets`)
      .then((r) => {
        const tickets = Array.isArray(r.data) ? r.data : []
        const has = tickets.some((t: { event_id?: string }) => t.event_id === eventId)
        setHasTicket(has)
      })
      .catch(() => setHasTicket(false))
  }

  useEffect(() => {
    refetchHasTicket()
  }, [orgId, eventId])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sessionId = params.get('session_id')
    if (params.get('payment') !== 'success' || !sessionId || !orgId) return
    window.history.replaceState({}, '', window.location.pathname)
    let t1: ReturnType<typeof setTimeout> | undefined
    let t2: ReturnType<typeof setTimeout> | undefined
    api
      .post(`/payments/${orgId}/confirm-event-ticket?session_id=${encodeURIComponent(sessionId)}`)
      .then(() => {
        refetchHasTicket()
        t1 = setTimeout(refetchHasTicket, 2000)
        t2 = setTimeout(refetchHasTicket, 4500)
      })
      .catch(() => refetchHasTicket())
    return () => {
      if (t1) clearTimeout(t1)
      if (t2) clearTimeout(t2)
    }
  }, [orgId])

  const role = (myRole ?? '').toLowerCase()
  const isAdmin = role === 'admin' || role === 'owner'
  const isCreator = Boolean(event && user?.id && event.created_by === user.id)
  const canEditEvent = isAdmin || isCreator

  const handleBuyTicket = async () => {
    if (!orgId || !eventId || !event || !user) return
    setCheckoutError('')
    setCheckoutLoading(true)
    try {
      const { data } = await api.post<{ checkout_url: string }>(`/payments/${orgId}/checkout/event`, {
        event_id: eventId,
        quantity: 1,
      })
      if (data.checkout_url) window.location.href = data.checkout_url
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed to start checkout'
      setCheckoutError(msg)
    } finally {
      setCheckoutLoading(false)
    }
  }

  const isSoldOut = Boolean(
    event?.max_attendees != null &&
    (event?.tickets_sold ?? 0) >= event.max_attendees,
  )
  const isPastEvent = event?.start_time ? new Date(event.start_time) < new Date() : false

  const handleDeleteEvent = async () => {
    if (!orgId || !eventId || !event || !window.confirm(`Delete "${event.title}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      await api.delete(`/events/${orgId}/${eventId}`)
      navigate(`/org/${orgId}/calendar`)
    } catch (e) {
      console.error(e)
    } finally {
      setDeleting(false)
    }
  }

  const handleRsvp = async (status: 'yes' | 'maybe' | 'no') => {
    if (!orgId || !eventId || !event) return
    const newStatus = event.my_rsvp === status ? null : status
    setRsvpLoading(true)
    try {
      if (newStatus === null) {
        await api.delete(`/events/${orgId}/${eventId}/rsvp`)
        setEvent((prev) =>
          prev ? { ...prev, my_rsvp: undefined } : null,
        )
      } else {
        await api.post(`/events/${orgId}/${eventId}/rsvp`, { status: newStatus })
        setEvent((prev) =>
          prev ? { ...prev, my_rsvp: newStatus } : null,
        )
      }
      // Refetch to get updated counts
      const { data } = await api.get(`/events/${orgId}/${eventId}`)
      setEvent(data)
    } catch (e) {
      console.error(e)
    } finally {
      setRsvpLoading(false)
    }
  }

  const formatDate = (d?: string) => {
    if (!d) return ''
    try {
      return new Date(d).toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    } catch {
      return d
    }
  }

  const formatTime = (d?: string) => {
    if (!d) return ''
    try {
      return new Date(d).toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      })
    } catch {
      return ''
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
      </div>
    )
  }

  if (!event) {
    return (
      <div className="p-6 text-center">
        <p className="text-zinc-400">Event not found</p>
        <Button
          variant="outline"
          onClick={() => navigate(`/org/${orgId}/calendar`)}
          className="mt-4 bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700"
        >
          Back to Calendar
        </Button>
      </div>
    )
  }

  const goingCount = event.rsvp_counts?.yes ?? 0
  const maybeCount = event.rsvp_counts?.maybe ?? 0
  const notGoingCount = event.rsvp_counts?.no ?? 0

  const handleExportCsv = async () => {
    if (!orgId || !eventId) return
    setExportingCsv(true)
    try {
      const { data } = await api.get(`/events/${orgId}/${eventId}/export/csv`, { responseType: 'blob' })
      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = `attendees-${eventId.slice(0, 8)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error(e)
    } finally {
      setExportingCsv(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-4">
        <button
          type="button"
          onClick={() => navigate(`/org/${orgId}/calendar`)}
          className="flex items-center gap-2 text-zinc-400 hover:text-white"
        >
          <ArrowLeft size={20} />
          Back to Calendar
        </button>
        {canEditEvent && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditModalOpen(true)}
              className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700"
            >
              <Pencil size={16} className="mr-1" />
              Edit
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDeleteEvent}
              disabled={deleting}
              className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:text-red-400 hover:border-red-500/50"
            >
              <Trash2 size={16} className="mr-1" />
              Delete
            </Button>
          </div>
        )}
      </div>

      {event.cover_image && !coverImageError && (
        <div
          className="rounded-xl overflow-hidden mb-6 bg-zinc-900 flex items-center justify-center min-h-[200px]"
          data-testid="event-cover-container"
        >
          {!coverImageLoaded && (
            <div className="animate-pulse bg-zinc-800 w-full min-h-[200px] rounded-xl" aria-hidden />
          )}
          <img
            src={event.cover_image}
            alt={event.title}
            className={`max-w-full max-h-[70vh] w-auto h-auto object-contain ${!coverImageLoaded ? 'hidden' : ''}`}
            onLoad={() => setCoverImageLoaded(true)}
            onError={() => setCoverImageError(true)}
            data-testid="event-cover-image"
          />
        </div>
      )}

      {/* Event info card */}
      <div className="bg-zinc-900/50 rounded-xl p-6 border border-zinc-800 mb-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <h1 className="text-2xl lg:text-3xl font-bold text-white">{event.title}</h1>
          {canEditEvent && (
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={() => setEditModalOpen(true)} className="bg-zinc-800 border-zinc-700 text-zinc-300">
                <Pencil size={16} className="mr-1" /> Edit
              </Button>
              <Button variant="outline" size="sm" onClick={handleDeleteEvent} disabled={deleting} className="bg-zinc-800 border-zinc-700 text-red-400">
                <Trash2 size={16} className="mr-1" /> Delete
              </Button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 text-zinc-300 mb-2">
          <Calendar size={18} className="text-zinc-500 shrink-0" />
          <span>{formatDate(event.start_time)}</span>
        </div>
        <div className="flex items-center gap-2 text-zinc-300 mb-2">
          <Clock size={18} className="text-zinc-500 shrink-0" />
          <span>
            {event.all_day ? 'All day' : `${formatTime(event.start_time)}${event.end_time ? ` - ${formatTime(event.end_time)}` : ''}`}
          </span>
        </div>
        {event.location && (
          <div className="flex items-center gap-2 text-zinc-300 mb-4">
            <MapPin size={18} className="text-zinc-500 shrink-0" />
            <span>{event.location}</span>
          </div>
        )}
        {event.is_paid && event.price != null && (
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg font-semibold text-green-400">${event.price}</span>
            <span className="text-sm text-zinc-500">per person</span>
          </div>
        )}
        {event.event_type && (
          <span className="inline-block px-3 py-1 bg-purple-500/20 text-purple-400 text-sm font-medium rounded-full mb-4">
            {event.event_type}
          </span>
        )}
        {event.description && (
          <div className="border-t border-zinc-800 pt-4 mt-4">
            <p className="text-zinc-300 whitespace-pre-wrap">{event.description}</p>
          </div>
        )}
      </div>

      {/* RSVP section - color-coded when selected */}
      <div className="bg-zinc-900/50 rounded-xl p-6 border border-zinc-800 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">Your Response</h2>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => handleRsvp('yes')}
            disabled={rsvpLoading}
            className={cn(
              'flex-1 min-w-[100px] flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors',
              event.my_rsvp === 'yes' ? 'bg-green-500 text-white' : 'bg-zinc-800 text-white hover:bg-zinc-700',
            )}
          >
            <Check size={18} /> Going
          </button>
          <button
            type="button"
            onClick={() => handleRsvp('maybe')}
            disabled={rsvpLoading}
            className={cn(
              'flex-1 min-w-[100px] flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors',
              event.my_rsvp === 'maybe' ? 'bg-yellow-500 text-black' : 'bg-zinc-800 text-white hover:bg-zinc-700',
            )}
          >
            <HelpCircle size={18} /> Maybe
          </button>
          <button
            type="button"
            onClick={() => handleRsvp('no')}
            disabled={rsvpLoading}
            className={cn(
              'flex-1 min-w-[100px] flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors',
              event.my_rsvp === 'no' ? 'bg-red-500 text-white' : 'bg-zinc-800 text-white hover:bg-zinc-700',
            )}
          >
            <X size={18} /> Cannot Go
          </button>
        </div>
      </div>

      {/* Ticket section - paid events only */}
      {event.is_paid && (
        <div className="bg-zinc-900/50 rounded-xl p-6 border border-zinc-800 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Ticket size={20} className="text-green-400" />
                <h2 className="text-lg font-semibold text-white">Event Ticket</h2>
              </div>
              <p className="text-sm text-zinc-400">
                {hasTicket ? 'You have a ticket for this event' : `$${Number(event.price).toFixed(2)} per person`}
              </p>
              {event.max_attendees != null && !hasTicket && !isSoldOut && (
                <p className="text-xs text-zinc-500 mt-1">
                  {event.max_attendees - (event.tickets_sold ?? 0)} tickets remaining
                </p>
              )}
            </div>
            {hasTicket ? (
              <Link
                to={`/org/${orgId}/settings/my-tickets`}
                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black hover:bg-zinc-200 rounded-lg font-semibold transition-colors"
              >
                <Ticket size={18} />
                View Your Ticket
              </Link>
            ) : (
              <div>
                <Button
                  onClick={handleBuyTicket}
                  disabled={!user || checkoutLoading || isSoldOut || isPastEvent}
                  className="flex items-center gap-2 px-6 py-3 bg-white text-black hover:bg-zinc-200 font-semibold"
                >
                  {checkoutLoading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Processing…
                    </>
                  ) : isSoldOut ? (
                    'Sold Out'
                  ) : isPastEvent ? (
                    'Event Ended'
                  ) : (
                    <>
                      <CreditCard size={18} />
                      Buy Ticket – ${Number(event.price).toFixed(2)}
                    </>
                  )}
                </Button>
                {checkoutError && <p className="text-sm text-red-400 mt-2">{checkoutError}</p>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Attendees section */}
      <div className="bg-zinc-900/50 rounded-xl p-6 border border-zinc-800">
        <div className="flex items-center gap-2 mb-4">
          <Users size={20} className="text-zinc-500" />
          <h2 className="text-lg font-semibold text-white">Attendees</h2>
        </div>
        <div className="grid grid-cols-3 gap-4 text-center mb-6">
          <div className="bg-zinc-800/50 rounded-lg p-3">
            <p className="text-2xl font-bold text-green-500">{goingCount}</p>
            <p className="text-sm text-zinc-400">Going</p>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-3">
            <p className="text-2xl font-bold text-yellow-500">{maybeCount}</p>
            <p className="text-sm text-zinc-400">Maybe</p>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-3">
            <p className="text-2xl font-bold text-red-500">{notGoingCount}</p>
            <p className="text-sm text-zinc-400">Cannot Go</p>
          </div>
        </div>
        {isAdmin && (goingCount > 0 || maybeCount > 0) && (
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={exportingCsv}
            className="w-full mb-4 flex items-center justify-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-zinc-300"
          >
            <Download size={16} /> {exportingCsv ? 'Exporting…' : 'Export Attendees CSV'}
          </button>
        )}
        {goingCount > 0 && event.attendees?.yes && (
          <div className="mb-4">
            <h3 className="text-sm font-medium text-zinc-400 mb-2">Going ({event.attendees.yes.length})</h3>
            <div className="flex flex-wrap gap-2">
              {event.attendees.yes.map((a) => (
                <div key={a.user_id} className="flex items-center gap-2 bg-zinc-800 rounded-full px-3 py-1.5">
                  {a.avatar ? (
                    <img src={a.avatar} alt="" className="w-6 h-6 rounded-full object-cover" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center text-xs font-medium text-green-500">
                      {a.initial}
                    </div>
                  )}
                  <span className="text-sm text-zinc-200">{getDisplayName(a.name, null)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {maybeCount > 0 && event.attendees?.maybe && (
          <div className="mb-4">
            <h3 className="text-sm font-medium text-zinc-400 mb-2">Maybe ({event.attendees.maybe.length})</h3>
            <div className="flex flex-wrap gap-2">
              {event.attendees.maybe.map((a) => (
                <div key={a.user_id} className="flex items-center gap-2 bg-zinc-800 rounded-full px-3 py-1.5">
                  {a.avatar ? (
                    <img src={a.avatar} alt="" className="w-6 h-6 rounded-full object-cover" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-yellow-500/20 flex items-center justify-center text-xs font-medium text-yellow-500">
                      {a.initial}
                    </div>
                  )}
                  <span className="text-sm text-zinc-200">{getDisplayName(a.name, null)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {goingCount === 0 && maybeCount === 0 && notGoingCount === 0 && (
          <p className="text-zinc-500 text-center py-4">No responses yet. Be the first to RSVP!</p>
        )}
      </div>

      {editModalOpen && orgId && eventId && event && (
        <CreateEventModal
          orgId={orgId}
          eventId={eventId}
          initialEvent={event as unknown as Record<string, unknown>}
          onClose={() => setEditModalOpen(false)}
          onCreated={() => {}}
          onUpdated={() => {
            setEditModalOpen(false)
            fetchEvent()
          }}
        />
      )}
    </div>
  )
}
