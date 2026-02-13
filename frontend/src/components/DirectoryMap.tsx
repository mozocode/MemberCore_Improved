import { useState, useMemo } from 'react'
import Map, { Marker, Popup } from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'
import { Calendar } from 'lucide-react'

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
}

interface DirectoryMapProps {
  events: DirectoryEvent[]
  culturalIdentityLabel?: string
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

export function DirectoryMap({ events, culturalIdentityLabel }: DirectoryMapProps) {
  const [selectedEvent, setSelectedEvent] = useState<DirectoryEvent | null>(null)

  const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN

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
      <div className="h-[400px] rounded-lg bg-zinc-900 border border-zinc-700 flex items-center justify-center text-zinc-500">
        <div className="text-center">
          <p>Map requires VITE_MAPBOX_TOKEN</p>
          <p className="text-sm mt-1">Add it to your .env file</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-[400px] rounded-lg overflow-hidden border border-zinc-700">
      <Map
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
            className="directory-popup"
            style={{ maxWidth: 280 }}
          >
            <div className="text-zinc-900 p-1">
              <h4 className="font-semibold text-sm">{selectedEvent.title}</h4>
              {selectedEvent.organization && (
                <p className="text-xs text-zinc-600 mt-0.5">
                  {selectedEvent.organization.name}
                  {selectedEvent.organization.type && (
                    <span> · {selectedEvent.organization.type}</span>
                  )}
                </p>
              )}
              {selectedEvent.event_date && (
                <p className="text-xs text-zinc-500 mt-1 flex items-center gap-1">
                  <Calendar size={12} />
                  {formatDate(selectedEvent.event_date)}
                </p>
              )}
              {selectedEvent.location && (
                <p className="text-xs text-zinc-500 mt-0.5 truncate">
                  {selectedEvent.location}
                </p>
              )}
              <div className="flex gap-3 mt-2 text-xs text-zinc-500">
                {(selectedEvent.going_count ?? 0) > 0 && (
                  <span>{selectedEvent.going_count} going</span>
                )}
                {(selectedEvent.maybe_count ?? 0) > 0 && (
                  <span>{selectedEvent.maybe_count} maybe</span>
                )}
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
