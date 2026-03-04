import { useState, useMemo, useRef, useEffect } from 'react'
import Map, { Marker } from 'react-map-gl/mapbox'
import type { MapRef } from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'
import { Calendar } from 'lucide-react'
import { EventOverlayCard } from '@/components/EventOverlayCard'

interface EventOrg {
  id: string
  name: string
  logo?: string
  type?: string
  icon_color?: string
}

export interface DirectoryEvent {
  id: string
  title: string
  description?: string
  event_date?: string
  start_time?: string
  location?: string
  latitude?: number
  longitude?: number
  cover_image?: string
  is_paid?: boolean
  price?: number
  max_attendees?: number
  tickets_sold?: number
  organization?: EventOrg
  going_count?: number
  maybe_count?: number
}

interface DirectoryMapProps {
  events: DirectoryEvent[]
  culturalIdentityLabel?: string
  /** When provided, popup shows a "View Details" button that opens the full event modal */
  onViewDetails?: (event: DirectoryEvent) => void
  /** If true, map fills container height (use when parent has flex-1) */
  fullHeight?: boolean
}

const DEFAULT_CENTER = { longitude: -98.5795, latitude: 39.8283, zoom: 4 }

export function DirectoryMap({ events, culturalIdentityLabel, onViewDetails, fullHeight }: DirectoryMapProps) {
  const [selectedEvent, setSelectedEvent] = useState<DirectoryEvent | null>(null)
  const mapRef = useRef<MapRef | null>(null)

  // ESC closes card; no map movement on marker click
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedEvent(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const rawToken = import.meta.env.VITE_MAPBOX_TOKEN
  const isPlaceholder =
    !rawToken ||
    /^pk\.your_|^pk\.example|^your_|^example|PASTE_YOUR_MAPBOX_TOKEN/i.test(
      String(rawToken).trim(),
    )
  const mapboxToken = isPlaceholder ? undefined : rawToken

  const mappableEvents = useMemo(
    () => events.filter((e) => e.latitude != null && e.longitude != null),
    [events],
  )

  const initialViewState = useMemo(() => {
    if (mappableEvents.length === 0) return DEFAULT_CENTER
    if (mappableEvents.length === 1) {
      const e = mappableEvents[0]
      return {
        longitude: e.longitude!,
        latitude: e.latitude!,
        zoom: 10,
      }
    }
    const lngs = mappableEvents.map((e) => e.longitude!)
    const lats = mappableEvents.map((e) => e.latitude!)
    const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2
    const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2
    return {
      longitude: centerLng,
      latitude: centerLat,
      zoom: 8,
    }
  }, [mappableEvents])

  if (!mapboxToken) {
    return (
      <div className={`${fullHeight ? 'h-full' : 'h-[400px]'} rounded-lg bg-zinc-900 border border-zinc-700 flex items-center justify-center text-zinc-500`}>
        <div className="text-center">
          <p>Map requires a valid Mapbox token</p>
          <p className="text-sm mt-1">
            Set VITE_MAPBOX_TOKEN in .env (get a token at account.mapbox.com)
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={`relative ${fullHeight ? 'h-full' : 'h-[400px]'} rounded-lg overflow-hidden border border-zinc-700`}>
      <Map
        ref={mapRef}
        mapboxAccessToken={mapboxToken}
        initialViewState={initialViewState}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
      >
        {mappableEvents.map((event) => (
          <Marker
            key={event.id}
            longitude={event.longitude!}
            latitude={event.latitude!}
            anchor="bottom"
            onClick={(e) => {
              e.originalEvent.stopPropagation()
              setSelectedEvent(event)
            }}
          >
            <div
              className="w-8 h-8 bg-white rounded-full flex items-center justify-center cursor-pointer hover:scale-110 transition-transform border-2"
              style={{
                borderColor: event.organization?.icon_color || '#fff',
              }}
            >
              <Calendar className="w-4 h-4 text-zinc-800" />
            </div>
          </Marker>
        ))}

      </Map>

      {/* Centered event card overlay (no Mapbox popup, no map movement) */}
      {selectedEvent && (
        <>
          <div
            className="absolute inset-0 bg-black/40 z-10"
            onClick={() => setSelectedEvent(null)}
            aria-hidden
          />
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none flex justify-center items-center"
            style={{ width: '100%', height: '100%' }}
          >
            <div className="pointer-events-auto">
              <EventOverlayCard
                event={selectedEvent}
                onClose={() => setSelectedEvent(null)}
                onView={onViewDetails}
              />
            </div>
          </div>
        </>
      )}

      <div className="absolute bottom-4 left-4 bg-zinc-900/90 rounded-lg px-3 py-2 text-xs">
        <p className="text-white font-medium">
          {mappableEvents.length} events on map
        </p>
        {culturalIdentityLabel && (
          <p className="text-zinc-400">Filtered by: {culturalIdentityLabel}</p>
        )}
      </div>
    </div>
  )
}
