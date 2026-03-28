import { useState, useEffect, useCallback } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Calendar, Plus, Loader2 } from 'lucide-react'
import { useGoogleLogin } from '@react-oauth/google'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { CreateEventModal } from '@/components/CreateEventModal'
import { EventCard, type EventCardEvent } from '@/components/EventCard'
import { cn } from '@/lib/utils'
import { useToast } from '@/contexts/ToastContext'

interface GoogleCalendarOption {
  id: string
  summary: string
  primary: boolean
}
interface AutoSyncStatus {
  enabled: boolean
  calendar_id?: string | null
  last_synced_at?: string | null
  last_error?: string | null
}

function toDateInputValue(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function toIsoAtStartOfDay(localDate: string): string | null {
  if (!localDate) return null
  const d = new Date(`${localDate}T00:00:00`)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

function toIsoAtEndOfDay(localDate: string): string | null {
  if (!localDate) return null
  const d = new Date(`${localDate}T23:59:59`)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

function GoogleCalendarImportModal({
  open,
  calendars,
  loading,
  selectedCalendarId,
  fromDate,
  toDate,
  mergeExisting,
  onChangeCalendar,
  onChangeFromDate,
  onChangeToDate,
  onChangeMergeExisting,
  onClose,
  onImport,
  autoSyncStatus,
  autoSyncLoading,
  onEnableAutoSync,
  onDisableAutoSync,
}: {
  open: boolean
  calendars: GoogleCalendarOption[]
  loading: boolean
  selectedCalendarId: string
  fromDate: string
  toDate: string
  mergeExisting: boolean
  onChangeCalendar: (v: string) => void
  onChangeFromDate: (v: string) => void
  onChangeToDate: (v: string) => void
  onChangeMergeExisting: (v: boolean) => void
  onClose: () => void
  onImport: () => void
  autoSyncStatus: AutoSyncStatus | null
  autoSyncLoading: boolean
  onEnableAutoSync: () => void
  onDisableAutoSync: () => void
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} aria-hidden />
      <div className="relative z-10 w-full max-w-md rounded-xl bg-zinc-900 border border-zinc-700 shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-zinc-700">
          <h3 className="text-base font-semibold text-white">Import Google Calendar</h3>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-white text-sm">
            Close
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm text-zinc-300 mb-1">Calendar</label>
            <select
              value={selectedCalendarId}
              onChange={(e) => onChangeCalendar(e.target.value)}
              className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white"
            >
              {calendars.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.summary}{c.primary ? ' (Primary)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-zinc-300 mb-1">From</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => onChangeFromDate(e.target.value)}
                className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-300 mb-1">To</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => onChangeToDate(e.target.value)}
                className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-zinc-400">
            <input
              type="checkbox"
              checked={mergeExisting}
              onChange={(e) => onChangeMergeExisting(e.target.checked)}
              className="rounded border-zinc-600"
            />
            Update previously imported events
          </label>

          <div className="rounded-md border border-zinc-700 bg-zinc-800/60 p-3">
            <div className="text-sm text-white font-medium">Daily auto-sync</div>
            <p className="text-xs text-zinc-400 mt-1">
              Keep MemberCore events updated from this calendar every day.
            </p>
            <p className="text-xs text-zinc-500 mt-2">
              Status:{' '}
              {autoSyncStatus?.enabled ? 'Enabled' : 'Disabled'}
              {autoSyncStatus?.last_synced_at ? ` · Last sync: ${new Date(autoSyncStatus.last_synced_at).toLocaleString()}` : ''}
            </p>
            {autoSyncStatus?.last_error ? (
              <p className="text-xs text-red-400 mt-1">Last error: {autoSyncStatus.last_error}</p>
            ) : null}
            <div className="flex gap-2 mt-3">
              <Button
                type="button"
                variant="outline"
                disabled={autoSyncLoading}
                onClick={onEnableAutoSync}
                className="bg-zinc-900 border-zinc-700 text-white hover:bg-zinc-700"
              >
                Enable daily sync
              </Button>
              {autoSyncStatus?.enabled ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={autoSyncLoading}
                  onClick={onDisableAutoSync}
                  className="bg-zinc-900 border-zinc-700 text-white hover:bg-zinc-700"
                >
                  Disable
                </Button>
              ) : null}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="button" onClick={onImport} className="bg-white text-black hover:bg-zinc-200" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Import events'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function GoogleCalendarImportButton({
  orgId,
  disabled,
  onImported,
  comingSoon,
}: {
  orgId: string
  disabled?: boolean
  onImported: () => void
  comingSoon?: boolean
}) {
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [calendars, setCalendars] = useState<GoogleCalendarOption[]>([])
  const [open, setOpen] = useState(false)
  const [selectedCalendarId, setSelectedCalendarId] = useState('primary')
  const [fromDate, setFromDate] = useState(toDateInputValue(new Date()))
  const [toDate, setToDate] = useState(toDateInputValue(new Date(Date.now() + 1000 * 60 * 60 * 24 * 365)))
  const [mergeExisting, setMergeExisting] = useState(true)
  const [autoSyncStatus, setAutoSyncStatus] = useState<AutoSyncStatus | null>(null)
  const [autoSyncLoading, setAutoSyncLoading] = useState(false)

  const loadAutoSyncStatus = useCallback(async () => {
    try {
      const { data } = await api.get(`/events/${orgId}/import/google/auto-sync/status`)
      setAutoSyncStatus(data)
    } catch {
      setAutoSyncStatus(null)
    }
  }, [orgId])

  const login = useGoogleLogin({
    scope: 'https://www.googleapis.com/auth/calendar.readonly',
    onSuccess: async (tokenResponse) => {
      const token = tokenResponse.access_token
      setAccessToken(token)
      setLoading(true)
      try {
        const { data } = await api.get(`/events/${orgId}/import/google/calendars`, {
          params: { access_token: token },
        })
        const list = Array.isArray(data) ? data : []
        if (!list.length) {
          showToast('No Google calendars found for this account', 'error')
          return
        }
        setCalendars(list)
        const primary = list.find((c: GoogleCalendarOption) => c.primary)?.id || list[0]?.id || 'primary'
        setSelectedCalendarId(primary)
        await loadAutoSyncStatus()
        setOpen(true)
      } catch (err: any) {
        const detail = err?.response?.data?.detail || 'Failed to fetch Google calendars'
        showToast(String(detail), 'error')
      } finally {
        setLoading(false)
      }
    },
    onError: () => showToast('Google authorization failed', 'error'),
  })

  const handleImport = async () => {
    if (!accessToken) {
      showToast('Google authorization required', 'error')
      return
    }
    setLoading(true)
    try {
      const { data } = await api.post(`/events/${orgId}/import/google`, {
        access_token: accessToken,
        calendar_id: selectedCalendarId || 'primary',
        time_min: toIsoAtStartOfDay(fromDate),
        time_max: toIsoAtEndOfDay(toDate),
        merge_existing: mergeExisting,
      })
      const imported = Number(data?.imported || 0)
      const skipped = Number(data?.skipped || 0)
      const errors = Number(data?.errors || 0)
      showToast(`Imported ${imported} event(s). Skipped ${skipped}. Errors ${errors}.`, 'success')
      setOpen(false)
      onImported()
    } catch (err: any) {
      const detail = err?.response?.data?.detail || 'Failed to import Google Calendar events'
      showToast(String(detail), 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleEnableAutoSync = async () => {
    setAutoSyncLoading(true)
    try {
      const { data } = await api.post(`/events/${orgId}/import/google/auto-sync/start`, {
        calendar_id: selectedCalendarId || 'primary',
      })
      const url = data?.auth_url
      if (!url) throw new Error('Missing auth URL')
      window.location.href = String(url)
    } catch (err: any) {
      const detail = err?.response?.data?.detail || 'Failed to start Google auto-sync setup'
      showToast(String(detail), 'error')
    } finally {
      setAutoSyncLoading(false)
    }
  }

  const handleDisableAutoSync = async () => {
    setAutoSyncLoading(true)
    try {
      await api.post(`/events/${orgId}/import/google/auto-sync/disable`)
      await loadAutoSyncStatus()
      showToast('Daily Google calendar sync disabled', 'success')
    } catch (err: any) {
      const detail = err?.response?.data?.detail || 'Failed to disable Google auto-sync'
      showToast(String(detail), 'error')
    } finally {
      setAutoSyncLoading(false)
    }
  }

  return (
    <>
      {comingSoon ? (
        <Button
          type="button"
          variant="outline"
          disabled
          className="bg-zinc-900 border-zinc-700 text-zinc-300 opacity-90 cursor-not-allowed"
        >
          Calendar Import Coming Soon
        </Button>
      ) : (
      <Button
        type="button"
        variant="outline"
        onClick={() => login()}
        disabled={disabled || loading}
        className="bg-zinc-900 border-zinc-700 text-white hover:bg-zinc-800"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        <span className={loading ? 'ml-2' : ''}>Import Google Calendar</span>
      </Button>
      )}
      <GoogleCalendarImportModal
        open={open}
        calendars={calendars}
        loading={loading}
        selectedCalendarId={selectedCalendarId}
        fromDate={fromDate}
        toDate={toDate}
        mergeExisting={mergeExisting}
        onChangeCalendar={setSelectedCalendarId}
        onChangeFromDate={setFromDate}
        onChangeToDate={setToDate}
        onChangeMergeExisting={setMergeExisting}
        onClose={() => setOpen(false)}
        onImport={handleImport}
        autoSyncStatus={autoSyncStatus}
        autoSyncLoading={autoSyncLoading}
        onEnableAutoSync={handleEnableAutoSync}
        onDisableAutoSync={handleDisableAutoSync}
      />
    </>
  )
}

export function OrgCalendar() {
  const { orgId } = useParams<{ orgId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const { showToast } = useToast()
  const googleCalendarImportEnabled = !!import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID
  const calendarImportComingSoon = true
  const [events, setEvents] = useState<EventCardEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming')
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [myRole, setMyRole] = useState<string | null>(null)

  const fetchEvents = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    try {
      const { data } = await api.get(`/events/${orgId}`)
      setEvents(data)
    } catch {
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  useEffect(() => {
    if (!orgId) return
    api.get(`/organizations/${orgId}/members/me`).then((r) => setMyRole(r.data.role)).catch(() => setMyRole(null))
  }, [orgId])

  useEffect(() => {
    const syncState = searchParams.get('google_sync')
    if (!syncState) return
    if (syncState === 'connected') showToast('Google daily auto-sync enabled', 'success')
    if (syncState === 'error') showToast('Google auto-sync setup failed', 'error')
    const next = new URLSearchParams(searchParams)
    next.delete('google_sync')
    next.delete('reason')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams, showToast])

  const now = new Date()
  const upcoming = events.filter((e) => new Date(e.start_time) >= now)
  const past = events.filter((e) => new Date(e.start_time) < now).reverse()
  const displayEvents = tab === 'upcoming' ? upcoming : past

  const groupedByMonth = displayEvents.reduce<Record<string, EventCardEvent[]>>((acc, event) => {
    const d = new Date(event.start_time)
    const monthYear = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    if (!acc[monthYear]) acc[monthYear] = []
    acc[monthYear].push(event)
    return acc
  }, {})

  const handleRSVP = useCallback(
    async (eventId: string, status: 'yes' | 'no' | null) => {
      if (!orgId) return
      try {
        if (status === null) {
          await api.delete(`/events/${orgId}/${eventId}/rsvp`)
        } else {
          await api.post(`/events/${orgId}/${eventId}/rsvp`, { status })
        }
        await fetchEvents()
      } catch {
        // keep UI state
      }
    },
    [orgId, fetchEvents],
  )

  const canCreate = myRole === 'owner' || myRole === 'admin'

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {canCreate && (
        <div className="flex flex-wrap justify-end gap-2 mb-6">
          {calendarImportComingSoon ? (
            <GoogleCalendarImportButton orgId={orgId!} onImported={fetchEvents} comingSoon />
          ) : orgId && googleCalendarImportEnabled ? (
            <GoogleCalendarImportButton orgId={orgId} onImported={fetchEvents} />
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                showToast(
                  'Google Calendar import is not configured yet. Set VITE_GOOGLE_WEB_CLIENT_ID in web production env to enable it.',
                  'error',
                )
              }
              className="bg-zinc-900 border-zinc-700 text-white hover:bg-zinc-800"
            >
              Import Google Calendar
            </Button>
          )}
          <Button onClick={() => setCreateModalOpen(true)} className="bg-white text-black hover:bg-zinc-200">
            <Plus size={18} />
            <span className="ml-2">Create Event</span>
          </Button>
        </div>
      )}

      <div className="flex gap-2 mb-6">
        <button
          type="button"
          onClick={() => setTab('upcoming')}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            tab === 'upcoming' ? 'bg-white text-black' : 'bg-zinc-800 text-zinc-400 hover:text-white',
          )}
        >
          Upcoming ({upcoming.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('past')}
          className={cn(
            'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            tab === 'past' ? 'bg-white text-black' : 'bg-zinc-800 text-zinc-400 hover:text-white',
          )}
        >
          Past ({past.length})
        </button>
      </div>

      {createModalOpen && orgId && (
        <CreateEventModal
          orgId={orgId}
          onClose={() => setCreateModalOpen(false)}
          onCreated={() => {
            setCreateModalOpen(false)
            fetchEvents()
          }}
        />
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
        </div>
      ) : displayEvents.length === 0 ? (
        <div className="rounded-lg bg-zinc-900 border border-zinc-700 p-12 text-center">
          <Calendar className="h-12 w-12 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400">No {tab} events</p>
          {canCreate && tab === 'upcoming' && (
            <Button
              variant="outline"
              onClick={() => setCreateModalOpen(true)}
              className="mt-4 bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700"
            >
              Create Event
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedByMonth).map(([monthYear, monthEvents]) => (
            <div key={monthYear}>
              <h2 className="text-zinc-400 text-sm font-medium mb-4">{monthYear}</h2>
              <div className="space-y-4">
                {monthEvents.map((event) => (
                  <EventCard key={event.id} event={event} orgId={orgId!} onRSVP={handleRSVP} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
