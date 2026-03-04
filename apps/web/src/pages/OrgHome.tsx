import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import {
  MessageSquare,
  Calendar,
  MapPin,
  Users,
  DollarSign,
  FileText,
  BarChart3,
  Settings,
  Building2,
  Clock,
  Loader2,
  Check,
  ChevronRight,
} from 'lucide-react'

interface Org {
  id: string
  name: string
  location?: string
  description?: string
  logo?: string | null
  icon_color?: string
  dues_label?: string
  trial_start_date?: string | { _seconds?: number }
  is_pro?: boolean
  platform_admin_owned?: boolean
}

const CHECKLIST_KEY = 'membercore_trial_checklist'
const TRIAL_DAYS = 30

function parseTrialStart(val: unknown): Date | null {
  if (!val) return null
  if (typeof val === 'string') return new Date(val)
  if (val && typeof val === 'object' && '_seconds' in val) {
    return new Date((val as { _seconds: number })._seconds * 1000)
  }
  return null
}

function useTrialCountdown(org: Org | null): { daysLeft: number; hours: number; minutes: number; expired: boolean } | null {
  const [now, setNow] = useState(() => new Date())
  const start = parseTrialStart(org?.trial_start_date)
  const skipTrial = org?.platform_admin_owned || org?.is_pro

  useEffect(() => {
    if (!start || skipTrial) return
    const end = new Date(start)
    end.setDate(end.getDate() + TRIAL_DAYS)
    const msLeft = end.getTime() - now.getTime()
    const interval =
      msLeft <= 5 * 24 * 60 * 60 * 1000
        ? setInterval(() => setNow(new Date()), 1000)
        : setInterval(() => setNow(new Date()), 60 * 1000)
    return () => clearInterval(interval)
  }, [start?.getTime(), skipTrial])

  if (!start || skipTrial) return null
  const end = new Date(start)
  end.setDate(end.getDate() + TRIAL_DAYS)
  const msLeft = end.getTime() - now.getTime()
  const expired = msLeft <= 0

  if (expired) {
    return { daysLeft: 0, hours: 0, minutes: 0, expired: true }
  }

  const daysLeft = Math.floor(msLeft / (24 * 60 * 60 * 1000))
  const hoursLeft = msLeft % (24 * 60 * 60 * 1000)
  const hours = Math.floor(hoursLeft / (60 * 60 * 1000))
  const minutes = Math.floor((hoursLeft % (60 * 60 * 1000)) / (60 * 1000))

  return { daysLeft, hours, minutes, expired: false }
}

interface ChecklistState {
  publicEvent: boolean
  privateChannel: boolean
  approvalMembership: boolean
  duesPlan: boolean
}

function useChecklist(orgId: string): [ChecklistState, (key: keyof ChecklistState, value: boolean) => void] {
  const key = `${CHECKLIST_KEY}_${orgId}`
  const [state, setState] = useState<ChecklistState>(() => {
    try {
      const stored = localStorage.getItem(key)
      if (stored) return JSON.parse(stored)
    } catch {}
    return { publicEvent: false, privateChannel: false, approvalMembership: false, duesPlan: false }
  })

  const setItem = (k: keyof ChecklistState, value: boolean) => {
    setState((prev) => {
      const next = { ...prev, [k]: value }
      try {
        localStorage.setItem(key, JSON.stringify(next))
      } catch {}
      return next
    })
  }

  return [state, setItem]
}

export function OrgHome() {
  const { orgId } = useParams<{ orgId: string }>()
  const navigate = useNavigate()
  const [org, setOrg] = useState<Org | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const trial = useTrialCountdown(org)
  const [checklist, setChecklist] = useChecklist(orgId || '')

  const duesLabel = org?.dues_label || 'Dues'

  useEffect(() => {
    if (!orgId) return
    Promise.all([
      api.get(`/organizations/${orgId}`),
      api.get(`/organizations/${orgId}/members/me`),
    ])
      .then(([orgRes, memberRes]) => {
        setOrg(orgRes.data)
        setRole(memberRes.data.role || 'member')
      })
      .catch(() => {
        setOrg(null)
        navigate('/user-dashboard')
      })
      .finally(() => setLoading(false))
  }, [orgId, navigate])

  useEffect(() => {
    if (loading || !org || role === null) return
    if (role === 'owner' || role === 'admin') return
    const isPro = org.is_pro || org.platform_admin_owned
    if (isPro) {
      navigate(`/org/${orgId}/chat`, { replace: true })
    } else {
      navigate(`/org/${orgId}/directory`, { replace: true })
    }
  }, [loading, org, role, orgId, navigate])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
      </div>
    )
  }

  if (!org) {
    return (
      <div className="p-6 text-center text-zinc-400">
        <p>Organization not found</p>
      </div>
    )
  }

  if (role !== 'owner' && role !== 'admin') {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
      </div>
    )
  }

  const iconColor = org.icon_color || '#3f3f46'

  const navItems = [
    { id: 'chat', to: 'chat', icon: MessageSquare, label: 'Chat', sublabel: 'Private conversations for your organization.' },
    { id: 'calendar', to: 'calendar', icon: Calendar, label: 'Calendar', sublabel: 'All upcoming events in one view.' },
    { id: 'directory', to: 'directory', icon: MapPin, label: 'Directory', sublabel: 'Discover relevant events across the platform.' },
    { id: 'members', to: 'members', icon: Users, label: 'Members', sublabel: 'View and manage your members.' },
    { id: 'dues', to: 'dues', icon: DollarSign, label: duesLabel, sublabel: 'Track contributions and payments.' },
    { id: 'documents', to: 'documents', icon: FileText, label: 'Documents', sublabel: 'Store and share important files.' },
    { id: 'polls', to: 'polls', icon: BarChart3, label: 'Polls', sublabel: 'Make decisions together.' },
    { id: 'settings', to: 'settings', icon: Settings, label: 'Settings', sublabel: 'Control how your organization runs.' },
  ]

  const checklistItems = [
    { key: 'publicEvent' as const, label: 'Create one public event that appears in the directory', desc: 'In your club calendar, turn on \'Public in directory\'.' },
    { key: 'privateChannel' as const, label: 'Create a private leadership chat channel', desc: 'Create an admin-only channel for leaders/officers.' },
    { key: 'approvalMembership' as const, label: 'Turn on approval-based membership', desc: 'Create an invite link so new members go into pending approvals.' },
    { key: 'duesPlan' as const, label: 'Set up one contribution / dues plan', desc: 'Create at least one dues plan so you can collect payments.' },
  ]

  const checklistComplete = Object.values(checklist).filter(Boolean).length

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Mobile header */}
      <div className="md:hidden flex items-center gap-3 mb-6 pb-4 border-b border-zinc-800">
        <div
          className="w-12 h-12 rounded-lg flex items-center justify-center overflow-hidden bg-zinc-800 shrink-0"
          style={{ backgroundColor: org.logo ? 'transparent' : iconColor + '30' }}
        >
          {org.logo ? (
            <img src={org.logo} alt={org.name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-xl font-bold" style={{ color: iconColor }}>
              {org.name.charAt(0)}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-white truncate">{org.name}</h1>
          {org.location && <p className="text-sm text-zinc-500 truncate">{org.location}</p>}
        </div>
        <button
          type="button"
          onClick={() => navigate('/user-dashboard')}
          className="p-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700"
          title="Switch organization"
        >
          <Building2 size={22} />
        </button>
      </div>

      {/* Welcome section */}
      <section className="mb-8">
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">Welcome to {org.name}</h2>
        {org.description && <p className="text-zinc-400">{org.description}</p>}
      </section>

      {/* Trial countdown (owners/admins only, skip if unlimited pro) */}
      {trial && (
        <section className="mb-8">
          <div
            className={`rounded-xl border p-4 ${
              trial.expired
                ? 'bg-red-500/10 border-red-500/30'
                : trial.daysLeft <= 5
                  ? 'bg-amber-500/10 border-amber-500/30'
                  : 'bg-zinc-900 border-zinc-700'
            }`}
          >
            <div className="flex items-start gap-3">
              <Clock
                size={24}
                className={`shrink-0 ${trial.expired ? 'text-red-400' : trial.daysLeft <= 5 ? 'text-amber-400' : 'text-zinc-500'}`}
              />
              <div className="flex-1 min-w-0">
                {trial.expired ? (
                  <>
                    <h3 className="font-semibold text-red-400">Pro trial expired</h3>
                    <p className="text-sm text-zinc-400 mt-1">
                      Upgrade to continue accessing Pro features.
                    </p>
                    <p className="text-xs text-zinc-500 mt-1">
                      You can still post events in the public directory for free.
                    </p>
                  </>
                ) : trial.daysLeft <= 5 ? (
                  <>
                    <h3 className="font-semibold text-amber-400">
                      {trial.daysLeft}d {trial.hours}h {trial.minutes}m left in Pro trial
                    </h3>
                    <p className="text-sm text-zinc-400 mt-1">
                      Continue access to all Pro features after your 30 day trial.
                    </p>
                  </>
                ) : (
                  <>
                    <h3 className="font-semibold text-white">{trial.daysLeft} days left in Pro trial</h3>
                    <p className="text-sm text-zinc-400 mt-1">
                      Continue access to all Pro features after your 30 day trial.
                    </p>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => navigate(`/org/${orgId}/settings`)}
                  className="mt-3 px-4 py-2 rounded-lg bg-white text-black text-sm font-medium hover:bg-zinc-200"
                >
                  Go Pro
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Mobile nav cards (8 items) */}
      <div className="md:hidden space-y-3 mb-8">
        {navItems.map(({ id, to, icon: Icon, label, sublabel }) => (
          <button
            key={id}
            type="button"
            onClick={() => navigate(`/org/${orgId}/${to}`)}
            className="w-full flex items-center gap-3 p-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-left"
          >
            <div
              className="h-12 w-12 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: iconColor + '30' }}
            >
              <Icon size={24} style={{ color: iconColor }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-white">{label}</div>
              <div className="text-sm text-zinc-500">{sublabel}</div>
            </div>
            <ChevronRight size={20} className="text-zinc-500 shrink-0" />
          </button>
        ))}
      </div>

      {/* Pro trial checklist (desktop only) */}
      <section className="hidden md:block mb-8">
        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-6">
          <h3 className="text-lg font-semibold text-white mb-1">30-day Pro trial checklist</h3>
          <p className="text-sm text-zinc-500 mb-4">
            Use Pro features once so the value is obvious. You can stay free forever after the trial.
          </p>
          <p className="text-sm text-zinc-400 mb-4">{checklistComplete}/4 complete</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {checklistItems.map(({ key, label, desc }) => (
              <button
                key={key}
                type="button"
                onClick={() => setChecklist(key, !checklist[key])}
                className="flex items-start gap-3 p-4 rounded-lg bg-zinc-800/50 border border-zinc-700 hover:border-zinc-600 text-left"
              >
                <div
                  className={`h-6 w-6 rounded-full shrink-0 flex items-center justify-center mt-0.5 ${
                    checklist[key] ? 'bg-red-500 text-white' : 'border-2 border-zinc-600'
                  }`}
                >
                  {checklist[key] && <Check size={14} strokeWidth={3} />}
                </div>
                <div className="min-w-0">
                  <div className={`font-medium text-white ${checklist[key] ? 'line-through text-zinc-400' : ''}`}>
                    {label}
                  </div>
                  <div className="text-sm text-zinc-500 mt-0.5">{desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Section prompt (desktop only) */}
      <section className="hidden md:block">
        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-6">
          <h3 className="font-semibold text-white mb-1">Pick a section on the left</h3>
          <p className="text-sm text-zinc-500">
            Chat, calendar, dues, documents, and member tools live in the left menu.
          </p>
        </div>
      </section>
    </div>
  )
}
