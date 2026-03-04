import { useState, useEffect } from 'react'
import { X, Calendar, MapPin, Users, Share2, ExternalLink } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'
import { PublicRsvpSection } from './PublicRsvpSection'
import { PublicTicketSection } from './PublicTicketSection'

export interface DirectoryEvent {
  id: string
  title: string
  description?: string
  event_date?: string
  start_time?: string
  end_time?: string
  location?: string
  latitude?: number
  longitude?: number
  cover_image?: string
  is_paid?: boolean
  price?: number
  max_attendees?: number
  tickets_sold?: number
  organization?: {
    id: string
    name: string
    logo?: string
    type?: string
  }
  going_count?: number
  maybe_count?: number
}

interface EventDetailModalProps {
  event: DirectoryEvent
  onClose: () => void
}

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

export function EventDetailModal({ event, onClose }: EventDetailModalProps) {
  const { user } = useAuth()
  const isAuthenticated = !!user
  const [userRsvp, setUserRsvp] = useState<string | null>(null)
  const [attendeeCount, setAttendeeCount] = useState(
    (event.going_count ?? 0) + (event.maybe_count ?? 0)
  )

  useEffect(() => {
    if (!isAuthenticated || event.is_paid) return
    api
      .get(`/events/public/${event.id}/my-rsvp`)
      .then((r) => setUserRsvp(r.data?.status ?? null))
      .catch(() => setUserRsvp(null))
  }, [event.id, event.is_paid, isAuthenticated])

  const startDate = formatDate(event.start_time || event.event_date)
  const endDate = event.end_time ? formatDate(event.end_time) : null

  const handleShare = async () => {
    const url = `${window.location.origin}/events/${event.id}`
    if (navigator.share) {
      try {
        await navigator.share({
          title: event.title,
          text: `Check out this event: ${event.title}`,
          url,
        })
      } catch {
        // user cancelled or error
      }
    } else {
      await navigator.clipboard.writeText(url)
    }
  }

  const isPast = event.start_time
    ? new Date(event.start_time) < new Date()
    : event.event_date
      ? new Date(event.event_date) < new Date()
      : false
  const isSoldOut =
    event.max_attendees != null &&
    (event.tickets_sold ?? 0) >= event.max_attendees

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/80"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-detail-title"
    >
      <div
        className="w-full md:max-w-2xl max-h-[90vh] bg-zinc-900 rounded-t-2xl md:rounded-xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header image */}
        {event.cover_image ? (
          <div className="relative h-48 md:h-64 flex-shrink-0">
            <img
              src={event.cover_image}
              alt=""
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent" />
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full hover:bg-black/70"
            >
              <X className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="absolute top-4 right-14 p-2 bg-black/50 text-white rounded-full hover:bg-black/70"
            >
              <Share2 className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <div className="relative h-24 bg-gradient-to-r from-zinc-800 to-zinc-700 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full hover:bg-black/70"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6">
          {/* Org badge */}
          {event.organization && (
            <div className="flex items-center gap-3 mb-4">
              {event.organization.logo ? (
                <img
                  src={event.organization.logo}
                  alt=""
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center">
                  <span className="text-lg font-bold text-white">
                    {event.organization.name?.charAt(0) ?? '?'}
                  </span>
                </div>
              )}
              <div>
                <p className="text-white font-medium">{event.organization.name}</p>
                {event.organization.type && (
                  <p className="text-sm text-zinc-400">{event.organization.type}</p>
                )}
              </div>
            </div>
          )}

          <h2 id="event-detail-title" className="text-2xl font-bold text-white mb-4">
            {event.title}
          </h2>

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
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white mb-2">About</h3>
              <p className="text-zinc-300 whitespace-pre-wrap">{event.description}</p>
            </div>
          )}
        </div>

        {/* Footer: RSVP or Buy ticket */}
        <div className="flex-shrink-0 p-4 border-t border-zinc-800 bg-zinc-900">
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
    </div>
  )
}
