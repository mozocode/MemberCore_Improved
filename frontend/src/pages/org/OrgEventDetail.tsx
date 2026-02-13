import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Calendar,
  MapPin,
  Loader2,
  ArrowLeft,
  Users,
  DollarSign,
  Check,
  HelpCircle,
  X,
  Pencil,
  Trash2,
} from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { CreateEventModal } from '@/components/CreateEventModal'

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

  const role = (myRole ?? '').toLowerCase()
  const isAdmin = role === 'admin' || role === 'owner'
  const isCreator = Boolean(event && user?.id && event.created_by === user.id)
  const canEditEvent = isAdmin || isCreator

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

  const totalRsvp =
    (event.rsvp_counts?.yes ?? 0) + (event.rsvp_counts?.maybe ?? 0) + (event.rsvp_counts?.no ?? 0)

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

      <h1 className="text-2xl font-bold text-white mb-2">{event.title}</h1>

      <div className="flex flex-wrap gap-4 text-zinc-400 mb-4">
        <span className="flex items-center gap-2">
          <Calendar size={18} />
          {formatDate(event.start_time)}
          {!event.all_day && formatTime(event.start_time) && (
            <span> · {formatTime(event.start_time)}</span>
          )}
        </span>
        {event.location && (
          <span className="flex items-center gap-2">
            <MapPin size={18} />
            {event.location}
          </span>
        )}
        {event.is_paid && event.price != null && (
          <span className="flex items-center gap-2">
            <DollarSign size={18} />
            ${event.price}
          </span>
        )}
      </div>

      {event.description && (
        <div className="rounded-xl bg-zinc-900 border border-zinc-700 p-4 mb-6">
          <p className="text-zinc-300 whitespace-pre-wrap">{event.description}</p>
        </div>
      )}

      <div className="rounded-xl bg-zinc-900 border border-zinc-700 p-4 mb-6">
        <h3 className="font-semibold text-white mb-3">RSVP</h3>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => handleRsvp('yes')}
            disabled={rsvpLoading}
            className={cn(
              'flex items-center gap-2',
              event.my_rsvp === 'yes'
                ? 'bg-green-500/20 border-green-500/50 text-green-400'
                : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700',
            )}
          >
            <Check size={18} />
            Going {event.my_rsvp === 'yes' && '(✓)'}
          </Button>
          <Button
            variant="outline"
            onClick={() => handleRsvp('maybe')}
            disabled={rsvpLoading}
            className={cn(
              'flex items-center gap-2',
              event.my_rsvp === 'maybe'
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700',
            )}
          >
            <HelpCircle size={18} />
            Maybe {event.my_rsvp === 'maybe' && '(✓)'}
          </Button>
          <Button
            variant="outline"
            onClick={() => handleRsvp('no')}
            disabled={rsvpLoading}
            className={cn(
              'flex items-center gap-2',
              event.my_rsvp === 'no'
                ? 'bg-red-500/20 border-red-500/50 text-red-400'
                : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700',
            )}
          >
            <X size={18} />
            Cannot Go {event.my_rsvp === 'no' && '(✓)'}
          </Button>
        </div>
        <p className="text-sm text-zinc-500 mt-2">
          {event.rsvp_counts?.yes ?? 0} going · {event.rsvp_counts?.maybe ?? 0} maybe · {event.rsvp_counts?.no ?? 0} cannot go
        </p>
      </div>

      {totalRsvp > 0 && event.attendees && (
        <div className="rounded-xl bg-zinc-900 border border-zinc-700 p-4">
          <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
            <Users size={18} />
            Attendees
          </h3>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-green-400 font-medium mb-2">
                Going ({event.rsvp_counts?.yes ?? 0})
              </p>
              <div className="space-y-2">
                {event.attendees.yes?.map((a) => (
                  <div key={a.user_id} className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-sm text-zinc-300">
                      {a.initial}
                    </div>
                    <span className="text-sm text-zinc-300 truncate">{a.name}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm text-amber-400 font-medium mb-2">
                Maybe ({event.rsvp_counts?.maybe ?? 0})
              </p>
              <div className="space-y-2">
                {event.attendees.maybe?.map((a) => (
                  <div key={a.user_id} className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-sm text-zinc-300">
                      {a.initial}
                    </div>
                    <span className="text-sm text-zinc-300 truncate">{a.name}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm text-red-400 font-medium mb-2">
                Cannot Go ({event.rsvp_counts?.no ?? 0})
              </p>
              <div className="space-y-2">
                {event.attendees.no?.map((a) => (
                  <div key={a.user_id} className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-sm text-zinc-300">
                      {a.initial}
                    </div>
                    <span className="text-sm text-zinc-300 truncate">{a.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

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
