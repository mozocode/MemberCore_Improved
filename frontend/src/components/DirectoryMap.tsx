import { useState, useMemo, useRef, useEffect } from 'react'
import Map, { Marker, Popup } from 'react-map-gl/mapbox'
import type { MapRef } from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'
import { Calendar, MapPin } from 'lucide-react'

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

export function DirectoryMap({ events, culturalIdentityLabel, onViewDetails, fullHeight }: DirectoryMapProps) {
  const [selectedEvent, setSelectedEvent] = useState<DirectoryEvent | null>(null)
  const mapRef = useRef<MapRef | null>(null)

  useEffect(() => {
    if (selectedEvent && mapRef.current) {
      const map = mapRef.current.getMap()
      map.flyTo({
        center: [selectedEvent.longitude!, selectedEvent.latitude!],
        offset: [0, -100],
        duration: 400,
        essential: true,
      })
    }
  }, [selectedEvent])

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

        {selectedEvent && (
          <Popup
            longitude={selectedEvent.longitude!}
            latitude={selectedEvent.latitude!}
            onClose={() => setSelectedEvent(null)}
            closeButton
            closeOnClick={false}
            className="directory-popup [&_.mapboxgl-popup-content]:bg-transparent [&_.mapboxgl-popup-content]:p-0 [&_.mapboxgl-popup-content]:shadow-none"
            style={{ maxWidth: 360 }}
          >
            <div className="rounded-xl bg-zinc-900 border border-zinc-700 p-4 text-left">
              <div className="flex gap-4">
                {selectedEvent.cover_image && (
                  <img
                    src={selectedEvent.cover_image}
                    alt=""
                    className="w-24 h-24 rounded-lg object-cover shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white">{selectedEvent.title}</h3>
                  {selectedEvent.organization && (
                    <div className="flex items-center gap-2 mt-0.5">
                      {selectedEvent.organization.logo ? (
                        <img
                          src={selectedEvent.organization.logo}
                          alt=""
                          className="w-6 h-6 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center shrink-0 text-xs font-medium text-zinc-400">
                          {selectedEvent.organization.name?.charAt(0) ?? '?'}
                        </div>
                      )}
                      <p className="text-sm text-zinc-400">
                        {selectedEvent.organization.name}
                        {selectedEvent.organization.type && (
                          <span className="text-zinc-500"> · {selectedEvent.organization.type}</span>
                        )}
                      </p>
                    </div>
                  )}
                  {(selectedEvent.event_date || selectedEvent.start_time) && (
                    <p className="text-sm text-zinc-400 mt-1 flex items-center gap-1">
                      <Calendar size={14} />
                      {formatDate(selectedEvent.start_time || selectedEvent.event_date)}
                    </p>
                  )}
                  {selectedEvent.location && (
                    <p className="text-sm text-zinc-400 mt-0.5 flex items-center gap-1 truncate">
                      <MapPin size={14} />
                      {selectedEvent.location}
                    </p>
                  )}
                  <div className="flex gap-4 mt-2 text-xs text-zinc-500">
                    {selectedEvent.is_paid ? (
                      <span>${Number(selectedEvent.price ?? 0).toFixed(2)} per ticket</span>
                    ) : (
                      <>
                        {(selectedEvent.going_count ?? 0) > 0 && (
                          <span>{selectedEvent.going_count} going</span>
                        )}
                        {(selectedEvent.maybe_count ?? 0) > 0 && (
                          <span>{selectedEvent.maybe_count} maybe</span>
                        )}
                      </>
                    )}
                  </div>
                  {onViewDetails && (
                    <button
                      type="button"
                      onClick={() => onViewDetails(selectedEvent)}
                      className="w-full mt-3 px-3 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-zinc-200"
                    >
                      View details
                    </button>
                  )}
                </div>
              </div>
            </div>
          </Popup>
        )}
      </Map>

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
