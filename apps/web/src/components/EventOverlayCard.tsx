import { Calendar, MapPin, X, DollarSign } from 'lucide-react'
import { normalizeOrgTypeLabel } from '@/lib/orgTypeDisplay'
import { cn } from '@/lib/utils'

interface EventOrg {
  id: string
  name: string
  logo?: string
  type?: string
  icon_color?: string
}

export interface EventOverlayCardEvent {
  id: string
  title: string
  event_date?: string
  start_time?: string
  location?: string
  cover_image?: string
  is_paid?: boolean
  price?: number
  organization?: EventOrg
  going_count?: number
  maybe_count?: number
}

function formatDate(d?: string) {
  if (!d) return ''
  try {
    return new Date(d).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return d
  }
}

interface EventOverlayCardProps {
  event: EventOverlayCardEvent
  onClose: () => void
  onView?: (event: EventOverlayCardEvent) => void
}

export function EventOverlayCard({ event, onClose, onView }: EventOverlayCardProps) {
  return (
    <div
      className={cn(
        'event-overlay-card rounded-xl bg-zinc-900 border border-zinc-700 shadow-xl overflow-hidden transition-colors w-[calc(100%-2rem)] max-w-[520px]',
        onView && 'cursor-pointer hover:border-zinc-600',
      )}
      onClick={() => onView?.(event)}
      role="dialog"
      aria-label="Event details"
    >
      <div className="flex gap-4 p-4">
        {event.cover_image ? (
          <img
            src={event.cover_image}
            alt=""
            className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg object-cover shrink-0"
          />
        ) : (
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg bg-zinc-800 shrink-0 flex items-center justify-center">
            <Calendar className="w-8 h-8 sm:w-10 sm:h-10 text-zinc-600" />
          </div>
        )}
        <div className="flex-1 min-w-0 relative">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onClose()
            }}
            className="absolute top-0 right-0 p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
          <h3 className="font-semibold text-white pr-6">{event.title}</h3>
          {event.organization && (
            <div className="flex items-center gap-2 mt-0.5">
              {event.organization.logo ? (
                <img
                  src={event.organization.logo}
                  alt=""
                  className="w-5 h-5 rounded-full object-cover shrink-0"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-zinc-700 flex items-center justify-center shrink-0 text-[10px] font-medium text-zinc-400">
                  {event.organization.name?.charAt(0) ?? '?'}
                </div>
              )}
              <p className="text-sm text-zinc-400">
                {event.organization.name}
                {event.organization.type && (
                  <span className="text-zinc-500"> · {normalizeOrgTypeLabel(event.organization.type)}</span>
                )}
              </p>
            </div>
          )}
          {(event.event_date || event.start_time) && (
            <p className="text-sm text-zinc-400 mt-1 flex items-center gap-1">
              <Calendar size={14} />
              {formatDate(event.start_time || event.event_date)}
            </p>
          )}
          {event.location && (
            <p className="text-sm text-zinc-400 mt-0.5 flex items-center gap-1 truncate">
              <MapPin size={14} />
              {event.location}
            </p>
          )}
          <div className="flex items-center justify-between gap-3 mt-3">
            <div className="flex items-center gap-3 min-w-0">
              {event.is_paid ? (
                <p className="text-sm text-amber-400 flex items-center gap-1">
                  <DollarSign size={14} />
                  ${Number(event.price ?? 0).toFixed(2)} per ticket
                </p>
              ) : (
                <div className="flex gap-3 text-xs text-zinc-500">
                  {(event.going_count ?? 0) > 0 && (
                    <span>{event.going_count} going</span>
                  )}
                  {(event.maybe_count ?? 0) > 0 && (
                    <span>{event.maybe_count} maybe</span>
                  )}
                </div>
              )}
            </div>
            {onView && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onView(event)
                }}
                className="shrink-0 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                View
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
