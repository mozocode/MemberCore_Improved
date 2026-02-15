import { useState, useEffect } from 'react'
import { useParams, useLocation, Link } from 'react-router-dom'
import { ArrowLeft, Calendar, MapPin, Users, Share2, ExternalLink, Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'
import { PublicRsvpSection } from '@/components/directory/PublicRsvpSection'
import { PublicTicketSection } from '@/components/directory/PublicTicketSection'
import type { DirectoryEvent } from '@/components/directory/EventDetailModal'

function formatDate(dateStr?: string) {
  if (!dateStr) return null
  try {
    const d = new Date(dateStr)
    return {
      day: d.toLocaleDateString(undefined, { weekday: 'long' }),
      date: d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }),
      time: d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
    }
  } catch {
    return null
  }
}

export function PublicEventDetail() {
  const { eventId } = useParams<{ eventId: string }>()
  const location = useLocation()
  const { user } = useAuth()
  const backToDirectoryUrl =
    (location.state as { fromOrgDirectory?: boolean; orgId?: string } | null)?.fromOrgDirectory &&
    (location.state as { orgId?: string }).orgId
      ? `/org/${(location.state as { orgId: string }).orgId}/directory`
      : '/directory'
  const isAuthenticated = !!user
  const [event, setEvent] = useState<DirectoryEvent | null>(null)
  const [loading, setLoading] = useState(true)
  const [userRsvp, setUserRsvp] = useState<string | null>(null)
  const [attendeeCount, setAttendeeCount] = useState(0)

  useEffect(() => {
    if (!eventId) return
    setLoading(true)
    api
      .get(`/events/public/directory/${eventId}`)
      .then((r) => {
        setEvent(r.data)
        setAttendeeCount((r.data?.going_count ?? 0) + (r.data?.maybe_count ?? 0))
      })
      .catch(() => setEvent(null))
      .finally(() => setLoading(false))
  }, [eventId])

  useEffect(() => {
    if (!isAuthenticated || !eventId || !event?.id || event.is_paid) return
    api
      .get(`/events/public/${eventId}/my-rsvp`)
      .then((r) => setUserRsvp(r.data?.status ?? null))
      .catch(() => setUserRsvp(null))
  }, [eventId, event?.id, event?.is_paid, isAuthenticated])

  const handleShare = async () => {
    const url = `${window.location.origin}/events/${eventId}`
    if (navigator.share) {
      try {
        await navigator.share({
          title: event?.title ?? 'Event',
          text: `Check out this event: ${event?.title ?? ''}`,
          url,
        })
      } catch {
        // user cancelled or error
      }
    } else {
      await navigator.clipboard.writeText(url)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-zinc-500" />
      </div>
    )
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6">
        <p className="text-zinc-400 mb-4">Event not found</p>
        <Link to={backToDirectoryUrl} className="text-white hover:text-zinc-300 flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Directory
        </Link>
      </div>
    )
  }

  const startDate = formatDate(event.start_time || event.event_date)
  const endDate = event.end_time ? formatDate(event.end_time) : null
  const isPast = event.start_time
    ? new Date(event.start_time) < new Date()
    : event.event_date
      ? new Date(event.event_date) < new Date()
      : false
  const isSoldOut =
    event.max_attendees != null && (event.tickets_sold ?? 0) >= event.max_attendees

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-black/95 backdrop-blur">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            to={backToDirectoryUrl}
            className="p-2 -ml-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 flex items-center gap-2"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="font-medium">Back to Directory</span>
          </Link>
          <button
            type="button"
            onClick={handleShare}
            className="ml-auto p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
            aria-label="Share"
          >
            <Share2 className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto pb-24">
        {event.cover_image ? (
          <div className="aspect-[2/1] w-full bg-zinc-900">
            <img
              src={event.cover_image}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="h-48 bg-gradient-to-r from-zinc-800 to-zinc-700" />
        )}

        <div className="px-4 py-6">
          {event.organization && (
            <div className="flex items-center gap-3 mb-4">
              {event.organization.logo ? (
                <img
                  src={event.organization.logo}
                  alt=""
                  className="w-12 h-12 rounded-full object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-zinc-700 flex items-center justify-center">
                  <span className="text-xl font-bold text-white">
                    {event.organization.name?.charAt(0) ?? '?'}
                  </span>
                </div>
              )}
              <div className="min-w-0">
                <p className="text-white font-medium truncate">{event.organization.name}</p>
                {event.organization.type && (
                  <p className="text-sm text-zinc-400">{event.organization.type}</p>
                )}
                <Link
                  to={`/org/${event.organization.id}`}
                  className="text-sm text-blue-400 hover:text-blue-300 mt-0.5 inline-flex items-center gap-1"
                >
                  View Organization
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </div>
          )}

          <h1 className="text-2xl md:text-3xl font-bold text-white mb-4">
            {event.title}
          </h1>

          {startDate && (
            <div className="flex items-start gap-3 mb-3">
              <Calendar className="h-5 w-5 text-zinc-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-white">
                  {startDate.day}, {startDate.date}
                </p>
                <p className="text-zinc-400 text-sm">
                  {startDate.time}
                  {endDate && ` – ${endDate.time}`}
                </p>
              </div>
            </div>
          )}

          {event.location && (
            <div className="flex items-start gap-3 mb-3">
              <MapPin className="h-5 w-5 text-zinc-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-white">{event.location}</p>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 text-sm hover:text-blue-300 inline-flex items-center gap-1 mt-1"
                >
                  Get directions
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 mb-6">
            <Users className="h-5 w-5 text-zinc-400" />
            <p className="text-zinc-400">
              {event.is_paid
                ? `${event.tickets_sold ?? 0} tickets sold`
                : `${attendeeCount} attending`}
              {event.max_attendees != null &&
                ` · ${Math.max(0, event.max_attendees - (event.tickets_sold ?? attendeeCount))} spots left`}
            </p>
          </div>

          {event.description && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-white mb-2">About this event</h2>
              <p className="text-zinc-300 whitespace-pre-wrap">{event.description}</p>
            </div>
          )}

          <div className="border-t border-zinc-800 pt-6">
            {event.is_paid ? (
              <PublicTicketSection
                eventId={event.id}
                price={event.price ?? 0}
                maxAttendees={event.max_attendees}
                ticketsSold={event.tickets_sold ?? 0}
                startTime={event.start_time || event.event_date}
                isSoldOut={isSoldOut}
                isPast={isPast}
              />
            ) : (
              <PublicRsvpSection
                eventId={event.id}
                userRsvp={userRsvp}
                onRsvpChange={(status) => {
                  setUserRsvp(status)
                  if (status === 'yes') setAttendeeCount((c) => c + 1)
                  else if (userRsvp === 'yes') setAttendeeCount((c) => Math.max(0, c - 1))
                }}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
