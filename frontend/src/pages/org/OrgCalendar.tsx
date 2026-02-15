import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { Calendar, Plus, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { CreateEventModal } from '@/components/CreateEventModal'
import { EventCard, type EventCardEvent } from '@/components/EventCard'
import { cn } from '@/lib/utils'

export function OrgCalendar() {
  const { orgId } = useParams<{ orgId: string }>()
  const [events, setEvents] = useState<EventCardEvent[]>([])
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

  const now = new Date()
  const upcoming = events.filter((e) => new Date(e.start_time) >= now)
  const past = events.filter((e) => new Date(e.start_time) < now).reverse()
  const displayEvents = tab === 'upcoming' ? upcoming : past

  const groupedByMonth = displayEvents.reduce<Record<string, EventCardEvent[]>>((acc, event) => {
    const d = new Date(event.start_time)
    const monthYear = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    if (!acc[monthYear]) acc[monthYear] = []
    acc[monthYear].push(event)
    return acc
  }, {})

  const handleRSVP = useCallback(
    async (eventId: string, status: 'yes' | 'no' | null) => {
      if (!orgId) return
      try {
        if (status === null) {
          await api.delete(`/events/${orgId}/${eventId}/rsvp`)
        } else {
          await api.post(`/events/${orgId}/${eventId}/rsvp`, { status })
        }
        await fetchEvents()
      } catch {
        // keep UI state
      }
    },
    [orgId, fetchEvents],
  )

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

      <div className="flex gap-2 mb-6">
        <button
          type="button"
          onClick={() => setTab('upcoming')}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            tab === 'upcoming' ? 'bg-white text-black' : 'bg-zinc-800 text-zinc-400 hover:text-white',
          )}
        >
          Upcoming ({upcoming.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('past')}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            tab === 'past' ? 'bg-white text-black' : 'bg-zinc-800 text-zinc-400 hover:text-white',
          )}
        >
          Past ({past.length})
        </button>
      </div>

      {createModalOpen && orgId && (
        <CreateEventModal
          orgId={orgId}
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
        <div className="space-y-8">
          {Object.entries(groupedByMonth).map(([monthYear, monthEvents]) => (
            <div key={monthYear}>
              <h2 className="text-zinc-400 text-sm font-medium mb-4">{monthYear}</h2>
              <div className="space-y-4">
                {monthEvents.map((event) => (
                  <EventCard key={event.id} event={event} orgId={orgId!} onRSVP={handleRSVP} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
