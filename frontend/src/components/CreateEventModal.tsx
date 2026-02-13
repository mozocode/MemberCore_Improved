import { useState, useRef, useEffect } from 'react'
import { X, MapPin, ImagePlus, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const EVENT_TYPES = [
  'Anniversary',
  'Ride-out',
  'Meeting',
  'Fundraiser',
  'Party/Social',
  'Community service',
  'Show/Competition',
] as const

const LOCATION_PRIVACY_OPTIONS = [
  { value: 'immediate', label: 'Exact address visible immediately' },
  { value: 'after_rsvp', label: 'Exact address visible after RSVP' },
  { value: 'city_only', label: 'City only (hide exact address)' },
] as const

const MAX_COVER_WIDTH = 1200
const COVER_QUALITY = 0.85

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      let { width, height } = img
      if (width > MAX_COVER_WIDTH) {
        height = (height * MAX_COVER_WIDTH) / width
        width = MAX_COVER_WIDTH
      }
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas not available'))
        return
      }
      ctx.drawImage(img, 0, 0, width, height)
      try {
        const dataUrl = canvas.toDataURL('image/jpeg', COVER_QUALITY)
        resolve(dataUrl)
      } catch (e) {
        reject(e)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }
    img.src = url
  })
}

interface MapboxFeature {
  id: string
  place_name: string
  center: [number, number]
}

function LocationSearchModal({
  onSelect,
  onClose,
}: {
  onSelect: (placeName: string, lng: number, lat: number) => void
  onClose: () => void
}) {
  const token = import.meta.env.VITE_MAPBOX_TOKEN
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MapboxFeature[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (!query.trim() || !token) {
      setResults([])
      return
    }
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}&types=address,place,poi&limit=5`
        )
        const data = await res.json()
        setResults(Array.isArray(data.features) ? data.features : [])
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [query, token])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} aria-hidden />
      <div className="relative z-10 w-full max-w-md rounded-xl bg-zinc-900 border border-zinc-700 shadow-xl">
        <div className="flex items-center justify-between p-3 border-b border-zinc-700">
          <h4 className="font-semibold text-white">Add location</h4>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400">
            <X size={18} />
          </button>
        </div>
        <div className="p-3">
          {!token ? (
            <p className="text-sm text-zinc-500">Mapbox token not configured. Enter address manually in the form.</p>
          ) : (
            <>
              <Input
                placeholder="Search for an address..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="bg-zinc-800 border-zinc-700 mb-2"
                autoFocus
              />
              {searching && (
                <div className="flex items-center gap-2 text-sm text-zinc-400 py-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Searching...
                </div>
              )}
              <ul className="max-h-48 overflow-y-auto space-y-1">
                {!searching && results.map((f) => (
                  <li key={f.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(f.place_name, f.center[0], f.center[1])
                        onClose()
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-zinc-800 text-sm text-white"
                    >
                      {f.place_name}
                    </button>
                  </li>
                ))}
                {!searching && query && results.length === 0 && (
                  <li className="text-sm text-zinc-500 py-2">No results</li>
                )}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function isoToLocalDate(iso: string | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function isoToLocalTime(iso: string | undefined): string {
  if (!iso) return '12:00'
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

interface CreateEventModalProps {
  orgId: string
  onClose: () => void
  onCreated: () => void
  /** When editing, pass event id and the existing event to prefill the form. */
  eventId?: string
  initialEvent?: Record<string, unknown>
  onUpdated?: () => void
}

export function CreateEventModal({ orgId, onClose, onCreated, eventId, initialEvent, onUpdated }: CreateEventModalProps) {
  const isEdit = Boolean(eventId && initialEvent)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [latitude, setLatitude] = useState<number | null>(null)
  const [longitude, setLongitude] = useState<number | null>(null)
  const [locationPrivacy, setLocationPrivacy] = useState<string>('immediate')
  const [startDate, setStartDate] = useState('')
  const [startTime, setStartTime] = useState('12:00')
  const [allDay, setAllDay] = useState(false)
  const [showEnd, setShowEnd] = useState(false)
  const [endDate, setEndDate] = useState('')
  const [endTime, setEndTime] = useState('13:00')
  const [coverImage, setCoverImage] = useState<string | null>(null)
  const [isPublicDirectory, setIsPublicDirectory] = useState(false)
  const [eventType, setEventType] = useState('')
  const [isPaid, setIsPaid] = useState(false)
  const [price, setPrice] = useState('')
  const [maxAttendees, setMaxAttendees] = useState('')
  const [locationModalOpen, setLocationModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Prefill form when editing
  useEffect(() => {
    if (!initialEvent || !isEdit) return
    setTitle((initialEvent.title as string) ?? '')
    setDescription((initialEvent.description as string) ?? '')
    setLocation((initialEvent.location as string) ?? '')
    setLatitude((initialEvent.latitude as number) ?? null)
    setLongitude((initialEvent.longitude as number) ?? null)
    setLocationPrivacy((initialEvent.location_privacy as string) ?? 'immediate')
    const startIso = initialEvent.start_time as string | undefined
    const endIso = initialEvent.end_time as string | undefined
    setStartDate(isoToLocalDate(startIso))
    setStartTime(isoToLocalTime(startIso))
    setAllDay(Boolean(initialEvent.all_day))
    setShowEnd(Boolean(endIso))
    setEndDate(isoToLocalDate(endIso))
    setEndTime(isoToLocalTime(endIso))
    setCoverImage((initialEvent.cover_image as string) ?? null)
    setIsPublicDirectory(Boolean(initialEvent.is_public_directory))
    setEventType((initialEvent.event_type as string) ?? '')
    setIsPaid(Boolean(initialEvent.is_paid))
    setPrice(initialEvent.price != null ? String(initialEvent.price) : '')
    setMaxAttendees(initialEvent.max_attendees != null ? String(initialEvent.max_attendees) : '')
  }, [initialEvent, isEdit])

  // When start date changes and we have showEnd, keep end date in sync if it was same as start
  useEffect(() => {
    if (showEnd && startDate && (!endDate || endDate < startDate)) {
      setEndDate(startDate)
    }
  }, [startDate, showEnd, endDate])

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    try {
      const dataUrl = await compressImage(file)
      setCoverImage(dataUrl)
    } catch {
      setError('Failed to process image')
    }
    e.target.value = ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!title.trim()) {
      setError('Title is required')
      return
    }
    if (!startDate) {
      setError('Start date is required')
      return
    }
    if (isPublicDirectory) {
      if (!location.trim()) {
        setError('Location is required for public directory events')
        return
      }
    }
    if (isPaid && (!price || parseFloat(price) < 0)) {
      setError('Price is required for paid events')
      return
    }

    const [sh, sm] = allDay ? [12, 0] : startTime.split(':').map(Number)
    const startDateTime = new Date(new Date(startDate).setHours(sh ?? 12, sm ?? 0, 0, 0)).toISOString()
    let endDateTime: string | undefined
    if (showEnd && endDate) {
      const [eh, em] = allDay ? [23, 59] : endTime.split(':').map(Number)
      endDateTime = new Date(new Date(endDate).setHours(eh ?? 23, em ?? 59, 0, 0)).toISOString()
    }

    const payload = {
      title: title.trim(),
      description: description.trim() || undefined,
      location: location.trim() || undefined,
      latitude: latitude ?? undefined,
      longitude: longitude ?? undefined,
      location_privacy: locationPrivacy,
      start_time: startDateTime,
      end_time: endDateTime,
      all_day: allDay,
      cover_image: coverImage || undefined,
      is_public_directory: isPublicDirectory,
      event_type: eventType.trim() || undefined,
      is_paid: isPaid,
      price: isPaid && price ? parseFloat(price) : undefined,
      max_attendees: maxAttendees ? parseInt(maxAttendees, 10) : undefined,
    }
    setLoading(true)
    try {
      if (isEdit && eventId) {
        await api.put(`/events/${orgId}/${eventId}`, payload)
        onUpdated?.()
      } else {
        await api.post(`/events/${orgId}`, payload)
        onCreated()
      }
      onClose()
    } catch (err: unknown) {
      setError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || (isEdit ? 'Failed to update event' : 'Failed to create event'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden />
      <div className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-zinc-900 border border-zinc-700">
        <div className="flex items-center justify-between p-4 border-b border-zinc-700">
          <h3 className="text-lg font-semibold text-white">{isEdit ? 'Edit Event' : 'Create Event'}</h3>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="text-sm text-red-400 bg-red-500/10 p-3 rounded-lg">{error}</div>
          )}

          {/* Cover photo */}
          <div>
            <Label className="text-zinc-300">Cover photo</Label>
            {coverImage ? (
              <div className="mt-1 relative rounded-lg overflow-hidden border border-zinc-700 bg-zinc-800 aspect-video max-h-40">
                <img src={coverImage} alt="Cover" className="w-full h-full object-cover" />
                <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 hover:opacity-100 transition-opacity">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="bg-zinc-800 border-zinc-600 text-white"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="bg-zinc-800 border-zinc-600 text-white"
                    onClick={() => setCoverImage(null)}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-1 w-full rounded-lg border border-dashed border-zinc-600 bg-zinc-800/50 hover:bg-zinc-800 flex items-center justify-center gap-2 py-8 text-zinc-400"
              >
                <ImagePlus size={24} />
                <span>Add cover photo</span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleCoverChange}
            />
          </div>

          <div>
            <Label htmlFor="title" className="text-zinc-300">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Event title"
              maxLength={200}
              className="mt-1 bg-zinc-800 border-zinc-700"
            />
          </div>
          <div>
            <Label htmlFor="description" className="text-zinc-300">Description</Label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Event description"
              rows={3}
              className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white"
            />
          </div>

          {/* Date / time */}
          <div className="space-y-3">
            <Label className="text-zinc-300">Date & time</Label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="startDate" className="text-zinc-400 text-xs">Start date *</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1 bg-zinc-800 border-zinc-700"
                />
              </div>
              <div>
                <Label htmlFor="startTime" className="text-zinc-400 text-xs">Start time</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  disabled={allDay}
                  className="mt-1 bg-zinc-800 border-zinc-700"
                />
                <label className="flex items-center gap-2 mt-2 text-sm text-zinc-400">
                  <input
                    type="checkbox"
                    checked={allDay}
                    onChange={(e) => setAllDay(e.target.checked)}
                    className="rounded border-zinc-600"
                  />
                  All day
                </label>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-zinc-400">
              <input
                type="checkbox"
                checked={showEnd}
                onChange={(e) => {
                  setShowEnd(e.target.checked)
                  if (e.target.checked && startDate && !endDate) setEndDate(startDate)
                }}
                className="rounded border-zinc-600"
              />
              Ends
            </label>
            {showEnd && (
              <div className="grid grid-cols-2 gap-3 pl-4 border-l-2 border-zinc-700">
                <div>
                  <Label htmlFor="endDate" className="text-zinc-400 text-xs">End date</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate}
                    className="mt-1 bg-zinc-800 border-zinc-700"
                  />
                </div>
                <div>
                  <Label htmlFor="endTime" className="text-zinc-400 text-xs">End time</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    disabled={allDay}
                    className="mt-1 bg-zinc-800 border-zinc-700"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Location */}
          <div>
            <Label className="text-zinc-300">Location</Label>
            <p className="text-xs text-zinc-500 mt-0.5">Optional for private events. Required for directory publishing.</p>
            <div className="mt-1 flex gap-2">
              <button
                type="button"
                onClick={() => setLocationModalOpen(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 text-sm"
              >
                <MapPin size={16} />
                {location ? (location.length > 40 ? location.slice(0, 40) + '…' : location) : 'Add location'}
              </button>
              {location && (
                <button
                  type="button"
                  onClick={() => {
                    setLocation('')
                    setLatitude(null)
                    setLongitude(null)
                  }}
                  className="px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700 text-sm"
                >
                  Remove
                </button>
              )}
            </div>
            {location && (
              <div className="mt-2">
                <Label className="text-zinc-400 text-xs">Location privacy</Label>
                <select
                  value={locationPrivacy}
                  onChange={(e) => setLocationPrivacy(e.target.value)}
                  className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white"
                >
                  {LOCATION_PRIVACY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Visibility */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-zinc-400">
              <input
                type="checkbox"
                checked={isPublicDirectory}
                onChange={(e) => setIsPublicDirectory(e.target.checked)}
                className="rounded border-zinc-600"
              />
              Public in directory
            </label>
            <p className="text-xs text-zinc-500">Public events appear in the directory and can be discovered by anyone.</p>
            {isPublicDirectory && (
              <div>
                <Label htmlFor="eventType" className="text-zinc-300">Event type</Label>
                <select
                  id="eventType"
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white"
                >
                  <option value="">Select type</option>
                  {EVENT_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Paid event */}
          <div>
            <label className="flex items-center gap-2 text-sm text-zinc-400">
              <input
                type="checkbox"
                checked={isPaid}
                onChange={(e) => setIsPaid(e.target.checked)}
                className="rounded border-zinc-600"
              />
              Paid event
            </label>
            <p className="text-xs text-zinc-500 mt-0.5">Paid events require a Pro organization or 30-day trial. They appear in Event Options for check-in and refunds.</p>
            {isPaid && (
              <div className="mt-2">
                <Label htmlFor="price" className="text-zinc-300">Price ($) *</Label>
                <Input
                  id="price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                  className="mt-1 bg-zinc-800 border-zinc-700 w-32"
                />
              </div>
            )}
          </div>

          {/* Max attendees */}
          <div>
            <Label htmlFor="maxAttendees" className="text-zinc-300">Max attendees</Label>
            <Input
              id="maxAttendees"
              type="number"
              min="1"
              value={maxAttendees}
              onChange={(e) => setMaxAttendees(e.target.value)}
              placeholder="Optional"
              className="mt-1 bg-zinc-800 border-zinc-700 w-32"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 bg-white text-black hover:bg-zinc-200"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : isEdit ? 'Save Changes' : 'Create Event'}
            </Button>
          </div>
        </form>
      </div>

      {locationModalOpen && (
        <LocationSearchModal
          onSelect={(placeName, lng, lat) => {
            setLocation(placeName)
            setLongitude(lng)
            setLatitude(lat)
          }}
          onClose={() => setLocationModalOpen(false)}
        />
      )}
    </div>
  )
}
