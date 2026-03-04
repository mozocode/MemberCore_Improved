import { useNavigate } from 'react-router-dom'
import { Calendar as CalendarIcon, Check, X, Share2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface EventHost {
  name: string
  avatar?: string | null
  initial: string
}

export interface EventCardEvent {
  id: string
  title: string
  description?: string
  location?: string
  start_time: string
  end_time?: string
  all_day?: boolean
  cover_image?: string | null
  is_paid?: boolean
  price?: number
  event_type?: string | null
  my_rsvp?: string
  attending_count?: number
  rsvp_counts?: { yes: number; maybe: number; no: number }
  host?: EventHost
}

function formatDate(d: string, options?: Intl.DateTimeFormatOptions) {
  try {
    return new Date(d).toLocaleDateString('en-US', options ?? { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return d
  }
}

function formatTime(d: string) {
  try {
    return new Date(d).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  } catch {
    return ''
  }
}

function RSVPButton({
  status,
  current,
  onClick,
  children,
  size = 'default',
}: {
  status: string
  current?: string
  onClick: (e: React.MouseEvent) => void
  children: React.ReactNode
  size?: 'default' | 'sm'
}) {
  const selected = current === status
  return (
    <button
      type="button"
      onClick={(e) => onClick(e)}
      className={cn(
        'flex items-center justify-center gap-2 rounded-lg font-medium transition-colors',
        size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm',
        selected ? 'bg-white text-black' : 'bg-zinc-800 text-white hover:bg-zinc-700',
      )}
    >
      {children}
    </button>
  )
}

function ShareButton() {
  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ url: window.location.href, title: document.title }).catch(() => {})
    } else {
      navigator.clipboard.writeText(window.location.href).then(() => {})
    }
  }
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); handleShare() }}
      className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white"
      aria-label="Share"
    >
      <Share2 size={18} />
    </button>
  )
}

interface EventCardProps {
  event: EventCardEvent
  orgId: string
  onRSVP: (eventId: string, status: 'yes' | 'no' | null) => void
}

export function EventCard({ event, orgId, onRSVP }: EventCardProps) {
  const navigate = useNavigate()
  const handleCardClick = () => navigate(`/org/${orgId}/calendar/${event.id}`)

  const handleRsvpClick = (status: 'yes' | 'no') => (e: React.MouseEvent) => {
    e.stopPropagation()
    const newStatus = event.my_rsvp === status ? null : status
    onRSVP(event.id, newStatus)
  }

  const attendingCount = event.attending_count ?? (event.rsvp_counts ? event.rsvp_counts.yes + event.rsvp_counts.maybe : 0)
  const host = event.host ?? { name: 'Host', avatar: null, initial: 'H' }
  const dateLabel = formatDate(event.start_time, { month: 'short', day: 'numeric' })
  const fullDateLabel = formatDate(event.start_time)
  const timeLabel = event.all_day
    ? 'All day'
    : `${formatTime(event.start_time)}${event.end_time ? ` - ${formatTime(event.end_time)}` : ''}`

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={(e) => e.key === 'Enter' && handleCardClick()}
      className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden cursor-pointer hover:border-zinc-700 transition-colors"
    >
      {/* ============ MOBILE LAYOUT (< 1024px) ============ */}
      <div className="lg:hidden">
        <div className="relative w-full aspect-video bg-zinc-800">
          {event.cover_image ? (
            <img src={event.cover_image} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <CalendarIcon size={48} className="text-zinc-600" />
            </div>
          )}
          <div className="absolute top-3 left-3 px-3 py-1 bg-zinc-900/90 backdrop-blur-sm rounded-lg text-sm font-medium text-white">
            {dateLabel}
          </div>
        </div>

        <div className="flex gap-2 p-3 border-b border-zinc-800" onClick={(e) => e.stopPropagation()}>
          <RSVPButton status="yes" current={event.my_rsvp} onClick={handleRsvpClick('yes')}>
            <Check size={18} /> I'm in
          </RSVPButton>
          <RSVPButton status="no" current={event.my_rsvp} onClick={handleRsvpClick('no')}>
            <X size={18} /> Can't go
          </RSVPButton>
        </div>

        <div className="p-4">
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-lg font-bold text-white">{event.title}</h3>
            <ShareButton />
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-zinc-500 uppercase">HOST</span>
            {host.avatar ? (
              <img src={host.avatar} alt="" className="w-6 h-6 rounded-full object-cover" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-medium text-zinc-300">
                {host.initial}
              </div>
            )}
            <span className="text-sm text-zinc-300">{host.name}</span>
          </div>
          <p className="text-sm text-zinc-400 mb-1">
            {event.all_day ? `${fullDateLabel} • All day` : `${fullDateLabel} • ${timeLabel}`}
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-zinc-500">{attendingCount} attending</span>
            {event.is_paid && event.price != null && (
              <span className="text-sm font-semibold text-green-400">${event.price}</span>
            )}
            {event.event_type && (
              <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded-full">
                {event.event_type}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ============ DESKTOP LAYOUT (>= 1024px) ============ */}
      <div className="hidden lg:flex min-h-[280px]">
        <div className="relative w-[40%] bg-zinc-800 flex-shrink-0 overflow-hidden">
          {event.cover_image ? (
            <img src={event.cover_image} alt="" className="h-full w-full object-cover object-center" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <CalendarIcon size={48} className="text-zinc-600" />
            </div>
          )}
        </div>
        <div className="flex-1 p-6 flex flex-col">
          <div className="inline-block px-3 py-1 bg-zinc-800 rounded-lg text-sm font-medium text-white mb-3 self-start">
            {dateLabel}
          </div>
          <div className="flex items-start justify-between mb-3">
            <h3 className="text-xl font-bold text-white">{event.title}</h3>
            <ShareButton />
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm text-zinc-400">HOST</span>
            {host.avatar ? (
              <img src={host.avatar} alt="" className="w-6 h-6 rounded-full object-cover" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-medium text-zinc-300">
                {host.initial}
              </div>
            )}
            <span className="text-sm text-zinc-300">{host.name}</span>
          </div>
          <p className="text-sm text-zinc-400 mb-2">
            {event.all_day ? 'All day' : `${fullDateLabel} • ${timeLabel}`}
          </p>
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <span className="text-sm text-zinc-500">{attendingCount} attending</span>
            {event.is_paid && event.price != null && (
              <span className="text-sm font-semibold text-green-400">${event.price}</span>
            )}
            {event.event_type && (
              <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded-full">
                {event.event_type}
              </span>
            )}
          </div>
          <div className="flex-grow" />
          <div className="flex gap-2 mt-auto" onClick={(e) => e.stopPropagation()}>
            <RSVPButton status="yes" current={event.my_rsvp} size="sm" onClick={handleRsvpClick('yes')}>
              <Check size={16} /> I'm in
            </RSVPButton>
            <RSVPButton status="no" current={event.my_rsvp} size="sm" onClick={handleRsvpClick('no')}>
              <X size={16} /> Cannot go
            </RSVPButton>
          </div>
        </div>
      </div>
    </div>
  )
}
