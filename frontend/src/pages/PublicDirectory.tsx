import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Search, Filter, MapPin, Calendar, List, Loader2 } from 'lucide-react'
import { DirectoryMap } from '@/components/DirectoryMap'
import type { DirectoryEvent } from '@/components/directory/EventDetailModal'
import { api } from '@/lib/api'
import { FilterModal, type DirectoryFilters } from '@/components/FilterModal'
import { FilterPills } from '@/components/FilterPills'
import { cn } from '@/lib/utils'

const emptyFilters: DirectoryFilters = {
  orgType: null,
  culturalIdentity: null,
  sportType: null,
  dateRange: null,
  radius: null,
  searchQuery: '',
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

export function PublicDirectory() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [events, setEvents] = useState<DirectoryEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<DirectoryFilters>(emptyFilters)
  const [filterModalOpen, setFilterModalOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'map'>('map')

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filters.orgType) params.set('org_type', filters.orgType)
    if (filters.culturalIdentity) params.set('cultural_identity', filters.culturalIdentity)
    if (filters.sportType) params.set('sport_type', filters.sportType)
    if (filters.dateRange) params.set('date_range', filters.dateRange)
    if (filters.radius) params.set('radius', filters.radius)
    if (filters.searchQuery) params.set('search', filters.searchQuery)
    const qs = params.toString()
    try {
      const { data } = await api.get(`/events/public/directory${qs ? `?${qs}` : ''}`)
      setEvents(Array.isArray(data) ? data : [])
    } catch {
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [
    filters.orgType,
    filters.culturalIdentity,
    filters.sportType,
    filters.dateRange,
    filters.radius,
    filters.searchQuery,
  ])

  useEffect(() => {
    const delay = filters.searchQuery ? 300 : 0
    const t = setTimeout(fetchEvents, delay)
    return () => clearTimeout(t)
  }, [fetchEvents])

  // Redirect ?event=id (and payment=success) to canonical public event URL
  useEffect(() => {
    const eventId = searchParams.get('event')
    if (!eventId) return
    const payment = searchParams.get('payment') === 'success' ? '?payment=success' : ''
    navigate(`/events/${eventId}${payment}`, { replace: true })
  }, [searchParams.get('event'), searchParams.get('payment'), navigate])

  const filteredEvents = events

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <header className="flex-shrink-0 border-b border-zinc-800 p-4 space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Public Directory</h1>
          <p className="text-zinc-400 text-sm">
            Discover events from organizations across the platform
          </p>
        </div>

        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500"
              size={16}
            />
            <input
              type="text"
              placeholder="Search events..."
              value={filters.searchQuery}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, searchQuery: e.target.value }))
              }
              className="w-full h-10 pl-10 pr-4 rounded-lg bg-zinc-900 border border-zinc-700 text-white placeholder:text-zinc-500 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => setFilterModalOpen(true)}
            className={cn(
              'flex items-center gap-2 h-10 px-4 rounded-lg border transition-colors',
              filters.orgType || filters.culturalIdentity || filters.sportType || filters.dateRange || filters.radius
                ? 'bg-white text-black border-white'
                : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:text-white hover:bg-zinc-700'
            )}
          >
            <Filter size={16} />
            Filters
          </button>
        </div>

        <FilterModal
          isOpen={filterModalOpen}
          onClose={() => setFilterModalOpen(false)}
          filters={filters}
          setFilters={setFilters}
          userOrg={null}
        />

        <FilterPills filters={filters} setFilters={setFilters} />

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
              viewMode === 'list'
                ? 'bg-zinc-700 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:text-white'
            )}
          >
            <List size={16} />
            List
          </button>
          <button
            type="button"
            onClick={() => setViewMode('map')}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
              viewMode === 'map'
                ? 'bg-zinc-700 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:text-white'
            )}
          >
            <MapPin size={16} />
            Map
          </button>
        </div>
      </header>

      <div className="flex-1 min-h-0 flex flex-col">
        {loading ? (
          <div className="flex justify-center items-center flex-1">
            <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
          </div>
        ) : viewMode === 'map' ? (
          <div className="flex-1 min-h-[400px] min-w-0">
            <DirectoryMap
              events={filteredEvents}
              onViewDetails={(event) => navigate(`/events/${event.id}`)}
              fullHeight
            />
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="rounded-lg bg-zinc-900 border border-zinc-700 p-12 text-center max-w-md">
              <Calendar className="h-12 w-12 text-zinc-600 mx-auto mb-3" />
              <p className="text-zinc-400">No events found</p>
              <p className="text-sm text-zinc-500 mt-1">
                Try adjusting your filters or search
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-auto p-4">
            <div className="max-w-2xl mx-auto space-y-4">
              {filteredEvents.map((event) => (
                <div
                  key={event.id}
                  className="rounded-xl bg-zinc-900 border border-zinc-700 p-4 hover:border-zinc-600 transition-colors"
                >
                  <div className="flex gap-4">
                    {event.cover_image && (
                      <img
                        src={event.cover_image}
                        alt=""
                        className="w-24 h-24 rounded-lg object-cover shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-white">{event.title}</h3>
                      {event.organization && (
                        <div className="flex items-center gap-2 mt-0.5">
                          {event.organization.logo ? (
                            <img
                              src={event.organization.logo}
                              alt=""
                              className="w-6 h-6 rounded-full object-cover shrink-0"
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center shrink-0 text-xs font-medium text-zinc-400">
                              {event.organization.name?.charAt(0) ?? '?'}
                            </div>
                          )}
                          <p className="text-sm text-zinc-400">
                            {event.organization.name}
                            {event.organization.type && (
                              <span className="text-zinc-500">
                                {' '}
                                · {event.organization.type}
                              </span>
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
                        <p className="text-sm text-zinc-400 mt-0.5 flex items-center gap-1">
                          <MapPin size={14} />
                          <span className="truncate">{event.location}</span>
                        </p>
                      )}
                      <div className="flex gap-4 mt-2 text-xs text-zinc-500">
                        {event.is_paid ? (
                          <span>
                            ${Number(event.price ?? 0).toFixed(2)} per ticket
                          </span>
                        ) : (
                          <>
                            {(event.going_count ?? 0) > 0 && (
                              <span>{event.going_count} going</span>
                            )}
                            {(event.maybe_count ?? 0) > 0 && (
                              <span>{event.maybe_count} maybe</span>
                            )}
                          </>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate(`/events/${event.id}`)}
                        className="w-full mt-3 px-3 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-zinc-200"
                      >
                        View details
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
