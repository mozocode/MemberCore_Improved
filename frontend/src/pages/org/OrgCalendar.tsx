import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Calendar,
  Plus,
  Loader2,
  MapPin,
  Users,
  DollarSign,
  ChevronRight,
} from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { CreateEventModal } from '@/components/CreateEventModal'
import { cn } from '@/lib/utils'

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
}

export function OrgCalendar() {
  const { orgId } = useParams<{ orgId: string }>()
  const navigate = useNavigate()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming')
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [myRole, setMyRole] = useState<string | null>(null)

  const fetchEvents = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    try {
      const { data } = await api.get(`/events/${orgId}`)
      setEvents(data)
    } catch {
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  useEffect(() => {
    if (!orgId) return
    api.get(`/organizations/${orgId}/members/me`).then((r) => setMyRole(r.data.role)).catch(() => setMyRole(null))
  }, [orgId])

  const formatDate = (d?: string) => {
    if (!d) return ''
    try {
      const dt = new Date(d)
      return dt.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
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

  const now = new Date()
  const upcoming = events.filter((e) => new Date(e.start_time) >= now)
  const past = events.filter((e) => new Date(e.start_time) < now).reverse()
  const displayEvents = tab === 'upcoming' ? upcoming : past
  const canCreate = myRole === 'owner' || myRole === 'admin'

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h2 className="text-xl font-semibold text-white">Calendar</h2>
        {canCreate && (
          <Button
            onClick={() => setCreateModalOpen(true)}
            className="bg-white text-black hover:bg-zinc-200"
          >
            <Plus size={18} />
            <span className="ml-2">Create Event</span>
          </Button>
        )}
      </div>

      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setTab('upcoming')}
          className={cn(
            'px-4 py-2 rounded-lg text-sm',
            tab === 'upcoming' ? 'bg-white text-black' : 'bg-zinc-800 text-zinc-400 hover:text-white',
          )}
        >
          Upcoming ({upcoming.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('past')}
          className={cn(
            'px-4 py-2 rounded-lg text-sm',
            tab === 'past' ? 'bg-white text-black' : 'bg-zinc-800 text-zinc-400 hover:text-white',
          )}
        >
          Past ({past.length})
        </button>
      </div>

      {createModalOpen && (
        <CreateEventModal
          orgId={orgId!}
          onClose={() => setCreateModalOpen(false)}
          onCreated={() => {
            setCreateModalOpen(false)
            fetchEvents()
          }}
        />
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
        </div>
      ) : displayEvents.length === 0 ? (
        <div className="rounded-lg bg-zinc-900 border border-zinc-700 p-12 text-center">
          <Calendar className="h-12 w-12 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400">No {tab} events</p>
          {canCreate && tab === 'upcoming' && (
            <Button
              variant="outline"
              onClick={() => setCreateModalOpen(true)}
              className="mt-4 bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700"
            >
              Create Event
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {displayEvents.map((event) => (
            <button
              key={event.id}
              type="button"
              onClick={() => navigate(`/org/${orgId}/calendar/${event.id}`)}
              className="w-full text-left rounded-xl bg-zinc-900 border border-zinc-700 p-4 hover:border-zinc-600 transition-colors flex gap-4"
            >
              {event.cover_image && (
                <img
                  src={event.cover_image}
                  alt=""
                  className="w-24 h-24 rounded-lg object-cover shrink-0"
                />
              )}
              {!event.cover_image && (
                <div className="w-24 h-24 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
                  <Calendar className="h-10 w-10 text-zinc-500" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-white truncate">{event.title}</h3>
                <p className="text-sm text-zinc-400 mt-0.5">
                  {formatDate(event.start_time)}
                  {!event.all_day && formatTime(event.start_time) && (
                    <span> · {formatTime(event.start_time)}</span>
                  )}
                </p>
                {event.location && (
                  <p className="text-sm text-zinc-500 mt-0.5 flex items-center gap-1">
                    <MapPin size={14} />
                    {event.location}
                  </p>
                )}
                <div className="flex gap-4 mt-2">
                  {(event.rsvp_counts?.yes ?? 0) + (event.rsvp_counts?.maybe ?? 0) > 0 && (
                    <span className="text-xs text-zinc-500 flex items-center gap-1">
                      <Users size={12} />
                      {(event.rsvp_counts?.yes ?? 0) + (event.rsvp_counts?.maybe ?? 0)} attending
                    </span>
                  )}
                  {event.is_paid && event.price && (
                    <span className="text-xs text-zinc-500 flex items-center gap-1">
                      <DollarSign size={12} />
                      ${event.price}
                    </span>
                  )}
                  {event.my_rsvp && (
                    <span className="text-xs px-2 py-0.5 rounded bg-zinc-700 text-zinc-300">
                      {event.my_rsvp === 'yes' ? 'Going' : event.my_rsvp === 'maybe' ? 'Maybe' : 'Cannot go'}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-zinc-500 shrink-0 self-center" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
