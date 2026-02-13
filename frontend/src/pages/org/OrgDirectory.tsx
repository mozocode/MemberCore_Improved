import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { Search, Filter, MapPin, Calendar, Sparkles, Loader2 } from 'lucide-react'
import { DirectoryMap } from '@/components/DirectoryMap'
import { api } from '@/lib/api'
import { FilterModal, type DirectoryFilters } from '@/components/FilterModal'
import { FilterPills } from '@/components/FilterPills'
import { getIdentityLabel } from '@/lib/culturalIdentities'
import { cn } from '@/lib/utils'

interface Org {
  id: string
  name: string
  type?: string
  cultural_identity?: string
  sport_type?: string
}

interface EventOrg {
  id: string
  name: string
  logo?: string
  type?: string
  icon_color?: string
}

interface DirectoryEvent {
  id: string
  title: string
  description?: string
  event_date?: string
  location?: string
  latitude?: number
  longitude?: number
  organization?: EventOrg
  going_count?: number
  maybe_count?: number
  cover_image?: string
}

const emptyFilters: DirectoryFilters = {
  orgType: null,
  culturalIdentity: null,
  sportType: null,
  dateRange: null,
  radius: null,
  searchQuery: '',
}

export function OrgDirectory() {
  const { orgId } = useParams<{ orgId: string }>()
  const [userOrg, setUserOrg] = useState<Org | null>(null)
  const [events, setEvents] = useState<DirectoryEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<DirectoryFilters>(emptyFilters)
  const [autoFilterApplied, setAutoFilterApplied] = useState(false)
  const [filterModalOpen, setFilterModalOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list')

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

  useEffect(() => {
    if (!orgId) return
    api
      .get(`/organizations/${orgId}`)
      .then((res) => setUserOrg(res.data))
      .catch(() => setUserOrg(null))
  }, [orgId])

  useEffect(() => {
    if (userOrg && !autoFilterApplied) {
      const autoFilters: Partial<DirectoryFilters> = {}
      if (userOrg.cultural_identity && userOrg.cultural_identity !== 'none') {
        autoFilters.culturalIdentity = userOrg.cultural_identity
      }
      if (userOrg.type === 'Sports Club' && userOrg.sport_type) {
        autoFilters.sportType = userOrg.sport_type
        autoFilters.orgType = 'Sports Club'
      }
      if (['Fraternity', 'Sorority'].includes(userOrg.type || '')) {
        autoFilters.orgType = userOrg.type
      }
      if (Object.keys(autoFilters).length > 0) {
        setFilters((prev) => ({ ...prev, ...autoFilters }))
        setAutoFilterApplied(true)
      }
    }
  }, [userOrg, autoFilterApplied])

  const handleShowAll = () => {
    setFilters(emptyFilters)
    setAutoFilterApplied(false)
  }

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

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white mb-1">Public Directory</h2>
        <p className="text-sm text-zinc-400">
          Discover events from organizations across the platform
        </p>
      </div>

      <div className="flex gap-3 mb-4">
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
          className="flex items-center gap-2 h-10 px-4 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-700"
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
        userOrg={userOrg}
      />

      <FilterPills filters={filters} setFilters={setFilters} />

      {autoFilterApplied && (
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-yellow-400 shrink-0" />
            <span className="text-sm text-zinc-300">
              Showing events from your community
              {filters.culturalIdentity && (
                <> ({getIdentityLabel(filters.culturalIdentity)})</>
              )}
            </span>
          </div>
          <button
            type="button"
            onClick={handleShowAll}
            className="text-xs text-zinc-400 hover:text-white underline shrink-0"
          >
            Show all events
          </button>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setViewMode('list')}
          className={cn(
            'px-4 py-2 rounded-lg text-sm',
            viewMode === 'list'
              ? 'bg-white text-black'
              : 'bg-zinc-800 text-zinc-400 hover:text-white',
          )}
        >
          List View
        </button>
        <button
          type="button"
          onClick={() => setViewMode('map')}
          className={cn(
            'px-4 py-2 rounded-lg text-sm flex items-center gap-2',
            viewMode === 'map'
              ? 'bg-white text-black'
              : 'bg-zinc-800 text-zinc-400 hover:text-white',
          )}
        >
          <MapPin size={16} />
          Map View
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
        </div>
      ) : viewMode === 'map' ? (
        <DirectoryMap
          events={events}
          culturalIdentityLabel={
            filters.culturalIdentity
              ? getIdentityLabel(filters.culturalIdentity)
              : undefined
          }
        />
      ) : events.length === 0 ? (
        <div className="rounded-lg bg-zinc-900 border border-zinc-700 p-12 text-center">
          <Calendar className="h-12 w-12 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400">No events found</p>
          <p className="text-sm text-zinc-500 mt-1">
            Try adjusting your filters or search query
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((event) => (
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
                    <p className="text-sm text-zinc-400 mt-0.5">
                      {event.organization.name}
                      {event.organization.type && (
                        <span className="text-zinc-500"> · {event.organization.type}</span>
                      )}
                    </p>
                  )}
                  {event.event_date && (
                    <p className="text-sm text-zinc-400 mt-1 flex items-center gap-1">
                      <Calendar size={14} />
                      {formatDate(event.event_date)}
                    </p>
                  )}
                  {event.location && (
                    <p className="text-sm text-zinc-400 mt-0.5 flex items-center gap-1">
                      <MapPin size={14} />
                      {event.location}
                    </p>
                  )}
                  <div className="flex gap-4 mt-2 text-xs text-zinc-500">
                    {(event.going_count ?? 0) > 0 && (
                      <span>{event.going_count} going</span>
                    )}
                    {(event.maybe_count ?? 0) > 0 && (
                      <span>{event.maybe_count} maybe</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
