import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react'
import { useParams, useNavigate, useLocation, useSearchParams, Link } from 'react-router-dom'
import { api } from '@/lib/api'
import { hasPermission, type OrgRole } from '@/lib/permissions'
import {
  User,
  Building2,
  Ticket,
  Settings,
  BarChart3,
  DollarSign,
  FileText,
  MapPin,
  Link2,
  PlayCircle,
  ChevronRight,
  ChevronDown,
  Users,
  Plus,
  X,
  Loader2,
  Check,
  Download,
  Eye,
  Calendar,
  CheckCircle,
  XCircle,
  RefreshCw,
  QrCode,
  Search,
  MessageSquare,
  Hash,
  Vote,
  ExternalLink,
  Pin,
  PinOff,
  Lock,
  Trash2,
  Edit2,
  Upload,
} from 'lucide-react'
import { CreateOrgDocumentModal } from '@/components/CreateOrgDocumentModal'
import { CreateTemplateModal } from '@/components/CreateTemplateModal'
import { DocumentViewerModal } from '@/components/DocumentViewerModal'
import { GroupedOrgTypeSelect } from '@/components/GroupedOrgTypeSelect'
import { SearchableSelect } from '@/components/SearchableSelect'
import { CULTURAL_IDENTITIES } from '@/lib/culturalIdentities'
import { getCategoryForType } from '@/lib/orgTypes'
import { SPORTS_LIST } from '@/lib/sports'
import { compressImageFile } from '@/lib/imageCompression'
import { getDisplayName } from '@/lib/displayName'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface SettingOption {
  id: string
  title: string
  description: string
  icon: typeof User
  permission: string
  route: string
}

const allSettings: SettingOption[] = [
  { id: 'personal', title: 'Personal Settings', description: 'Update your name and profile photo.', icon: User, permission: 'settings.personal', route: 'personal' },
  { id: 'organization', title: 'Organization Settings', description: 'Edit organization info, location, logo, billing, and manage members.', icon: Building2, permission: 'org.settings', route: 'club' },
  { id: 'my-tickets', title: 'My Tickets', description: 'View your purchased event tickets and QR codes.', icon: Ticket, permission: 'settings.personal', route: 'my-tickets' },
  { id: 'event-options', title: 'Event Options', description: 'Manage event check-ins and ticket verification.', icon: Settings, permission: 'events.manage', route: 'event-options' },
  { id: 'analytics', title: 'Analytics Dashboard', description: 'View member growth, event attendance, revenue, and engagement metrics.', icon: BarChart3, permission: 'org.settings', route: 'analytics' },
  { id: 'dues', title: 'Payment Settings', description: 'Create and manage payment plans.', icon: DollarSign, permission: 'dues.manage', route: 'dues' },
  { id: 'documents', title: 'Document Settings', description: 'Upload and manage documents for your organization.', icon: FileText, permission: 'documents.manage', route: 'documents' },
  { id: 'directory', title: 'Directory Settings', description: 'Manage how your public events appear in the directory.', icon: MapPin, permission: 'org.settings', route: 'directory' },
  { id: 'affiliate', title: 'Affiliate Settings', description: 'Manage your affiliate program with Rewardful.', icon: Link2, permission: 'org.settings', route: 'affiliate' },
  { id: 'video-tutorials', title: 'Video Tutorials', description: 'Watch short videos on how to use the platform.', icon: PlayCircle, permission: 'settings.personal', route: 'video-tutorials' },
]
const ALLOWED_SETTINGS_WHEN_INACTIVE = new Set(['personal', 'my-tickets'])
const TRIAL_DAYS = 30

function parseOrgDate(val: string | { _seconds: number } | undefined): Date | null {
  if (!val) return null
  if (typeof val === 'string') return new Date(val)
  if (typeof val === 'object' && val !== null && '_seconds' in val) {
    return new Date((val as { _seconds: number })._seconds * 1000)
  }
  return null
}

function getTrialEnd(org: {
  trial_start_date?: string | { _seconds: number }
  trial_end_date?: string | { _seconds: number }
}): Date | null {
  const end = parseOrgDate(org.trial_end_date)
  if (end) return end
  const start = parseOrgDate(org.trial_start_date)
  if (!start) return null
  const d = new Date(start)
  d.setDate(d.getDate() + TRIAL_DAYS)
  return d
}

function isOrgBillingActive(org: {
  is_pro?: boolean
  platform_admin_owned?: boolean
  billing_exempt?: boolean
  billing_status?: string
  trial_start_date?: string | { _seconds: number }
  trial_end_date?: string | { _seconds: number }
} | null): boolean {
  if (!org) return true
  if (org.is_pro || org.platform_admin_owned || org.billing_exempt) return true
  const status = String(org.billing_status || '').toLowerCase()
  if (status === 'active' || status === 'trial' || status === 'exempt') return true
  const trialEnd = getTrialEnd(org)
  return trialEnd !== null && trialEnd.getTime() > Date.now()
}

export function OrgSettings() {
  const { orgId } = useParams<{ orgId: string }>()
  const navigate = useNavigate()
  const [role, setRole] = useState<OrgRole>('member')
  const [roleLoading, setRoleLoading] = useState(true)
  const [_pendingCount, setPendingCount] = useState(0)
  const [billingActive, setBillingActive] = useState(true)

  useEffect(() => {
    if (!orgId) return
    setRoleLoading(true)
    api
      .get(`/organizations/${orgId}/members/me`)
      .then((r) => setRole((r.data.role || 'member') as OrgRole))
      .catch(() => setRole('member'))
      .finally(() => setRoleLoading(false))
  }, [orgId])

  useEffect(() => {
    if (!orgId) return
    api
      .get(`/organizations/${orgId}`)
      .then((r) => setBillingActive(isOrgBillingActive(r.data)))
      .catch(() => setBillingActive(true))
  }, [orgId])

  useEffect(() => {
    if (!orgId) return
    api
      .get(`/organizations/${orgId}/members`, { params: { status_filter: 'pending' } })
      .then((r) => setPendingCount(Array.isArray(r.data) ? r.data.length : 0))
      .catch(() => setPendingCount(0))
  }, [orgId])

  const location = useLocation()
  const subPath = location.pathname.split('/settings/')[1]?.split('/')[0] || ''
  const visibleSettings = allSettings.filter((s) => {
    if (!hasPermission(role, s.permission)) return false
    if (!billingActive && !ALLOWED_SETTINGS_WHEN_INACTIVE.has(s.route)) return false
    return true
  })

  if (subPath) {
    return (
      <OrgSettingsOutlet
        subPath={subPath}
        orgId={orgId!}
        role={role}
        roleLoading={roleLoading}
        allSettings={allSettings}
        visibleSettings={visibleSettings}
        billingActive={billingActive}
      />
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {visibleSettings.map((s) => {
                const Icon = s.icon
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => navigate(`/org/${orgId}/settings/${s.route}`)}
                    className="flex items-start gap-4 p-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-left w-full"
                  >
                    <div className="h-12 w-12 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
                      <Icon size={24} className="text-zinc-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-white">{s.title}</span>
                      <p className="text-sm text-zinc-500 mt-0.5">{s.description}</p>
                    </div>
                    <ChevronRight size={20} className="text-zinc-500 shrink-0 mt-1" />
                  </button>
                )
              })}
            </div>
          </div>
  )
}

function OrgSettingsOutlet({
  subPath,
  orgId,
  role,
  roleLoading,
  billingActive,
  allSettings,
  visibleSettings: _visibleSettings,
}: {
  subPath: string
  orgId: string
  role: OrgRole
  roleLoading: boolean
  billingActive: boolean
  allSettings: SettingOption[]
  visibleSettings: SettingOption[]
}) {
  const navigate = useNavigate()
  const option = allSettings.find((s) => s.route === subPath)
  const billingAllows = billingActive || ALLOWED_SETTINGS_WHEN_INACTIVE.has(subPath)
  const canAccess = Boolean(option && hasPermission(role, option.permission) && billingAllows)

  useEffect(() => {
    if (roleLoading) return
    if (subPath === 'members') {
      navigate(`/org/${orgId}/settings/club?tab=members`, { replace: true })
      return
    }
    if (!option) {
      navigate(`/org/${orgId}/settings`, { replace: true })
      return
    }
    if (!canAccess) {
      navigate(`/org/${orgId}/settings`, { replace: true })
    }
  }, [subPath, canAccess, option, orgId, navigate, roleLoading])

  if (roleLoading || subPath === 'members') {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
        <p className="text-zinc-500 text-sm mt-4">{subPath === 'members' ? 'Opening members…' : 'Loading settings…'}</p>
      </div>
    )
  }

  if (!option || !canAccess) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6 text-zinc-500 text-sm">
        <Loader2 className="h-8 w-8 animate-spin mb-4" />
        Redirecting to settings…
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="lg:hidden flex items-center gap-4 px-0 py-4 mb-4 border-b border-zinc-800">
        <button
          type="button"
          onClick={() => navigate(`/org/${orgId}/settings`)}
          className="p-2 -ml-2 rounded-lg hover:bg-zinc-800 text-zinc-400"
        >
          <ChevronRight size={24} className="rotate-180" />
        </button>
        <h1 className="text-xl font-bold text-white">{option!.title}</h1>
      </div>
      <div className="hidden lg:flex items-center gap-4 mb-6">
        <button
          type="button"
          onClick={() => navigate(`/org/${orgId}/settings`)}
          className="text-zinc-400 hover:text-white text-sm"
        >
          ← Back to Settings
        </button>
      </div>
      <h2 className="text-xl font-semibold text-white mb-6 hidden lg:block">{option!.title}</h2>
      <SettingsPage subPath={subPath} orgId={orgId} />
    </div>
  )
}

function SettingsPage({ subPath, orgId }: { subPath: string; orgId: string }) {
  switch (subPath) {
    case 'personal':
      return <SettingsPersonal orgId={orgId} />
    case 'club':
      return <SettingsClub orgId={orgId} />
    case 'dues':
      return <SettingsDues orgId={orgId} />
    case 'documents':
      return <SettingsDocuments orgId={orgId} />
    case 'directory':
      return <SettingsDirectory orgId={orgId} />
    case 'event-options':
      return <SettingsEventOptions orgId={orgId} />
    case 'analytics':
      return <SettingsAnalytics orgId={orgId} />
    case 'my-tickets':
      return <SettingsMyTickets orgId={orgId} />
    case 'affiliate':
      return <SettingsAffiliate orgId={orgId} />
    case 'video-tutorials':
      return <SettingsVideoTutorials orgId={orgId} />
    default:
      return (
        <p className="text-zinc-400 text-sm">
          This settings section is not available. Use Back to Settings and pick another option.
        </p>
      )
  }
}

const NICKNAME_MAX_LENGTH = 50
const TITLE_MAX_LENGTH = 50
const LazyQRCode = lazy(() => import('react-qr-code'))

function SettingsPersonal({ orgId }: { orgId: string }) {
  const navigate = useNavigate()
  const { user, setUser } = useAuth()
  const [avatar, setAvatar] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [nickname, setNickname] = useState('')
  const [title, setTitle] = useState('')
  const [muteNotifications, setMuteNotifications] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [compressing, setCompressing] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [myRole, setMyRole] = useState<string | null>(null)
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false)
  const [leaveLoading, setLeaveLoading] = useState(false)

  useEffect(() => {
    if (!orgId) return
    api
      .get(`/organizations/${orgId}/members/me`)
      .then((r) => {
        setNickname(r.data.nickname || '')
        setTitle(r.data.title || '')
        setMuteNotifications(r.data.mute_notifications || false)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [orgId])

  useEffect(() => {
    if (user?.avatar) setAvatar(user.avatar)
    if (user?.phone_number !== undefined) setPhoneNumber(user.phone_number || '')
  }, [user?.avatar, user?.phone_number])

  useEffect(() => {
    if (!orgId) return
    api.get(`/organizations/${orgId}/members/me`).then((r) => setMyRole(r.data.role)).catch(() => setMyRole(null))
  }, [orgId])

  const handleSaveOrgSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    if (nickname.length > NICKNAME_MAX_LENGTH) {
      setMessage({ type: 'error', text: 'Nickname too long (max 50 characters)' })
      return
    }
    if (title.length > TITLE_MAX_LENGTH) {
      setMessage({ type: 'error', text: 'Title too long (max 50 characters)' })
      return
    }
    setSaving(true)
    setMessage(null)
    try {
      await api.put(`/organizations/${orgId}/members/me/settings`, {
        nickname: nickname.trim() || null,
        title: title.trim() || null,
        mute_notifications: muteNotifications,
      })
      setMessage({ type: 'success', text: 'Settings saved!' })
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setMessage({ type: 'error', text: typeof detail === 'string' ? detail : 'Failed to save settings' })
    } finally {
      setSaving(false)
    }
  }

  const handleSavePhone = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const { data } = await api.put('/auth/me', { phone_number: phoneNumber.trim() || undefined })
      setUser(data)
      setMessage({ type: 'success', text: 'Phone number saved.' })
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setMessage({ type: 'error', text: typeof detail === 'string' ? detail : 'Failed to save phone number' })
    } finally {
      setSaving(false)
    }
  }

  const handleLeaveOrg = async () => {
    setLeaveLoading(true)
    setMessage(null)
    try {
      await api.post(`/organizations/${orgId}/members/me/leave`)
      setLeaveConfirmOpen(false)
      navigate('/user-dashboard')
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setMessage({ type: 'error', text: typeof detail === 'string' ? detail : 'Failed to leave organization' })
    } finally {
      setLeaveLoading(false)
    }
  }

  const handleAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    setMessage(null)
    setCompressing(true)
    try {
      const dataUrl = await compressImageFile(file)
      setAvatar(dataUrl)
      setSaving(true)
      const { data } = await api.put('/auth/me', { avatar: dataUrl })
      setUser(data)
      setMessage({ type: 'success', text: 'Photo saved.' })
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setMessage({ type: 'error', text: typeof detail === 'string' ? detail : 'Failed to save photo.' })
    } finally {
      setCompressing(false)
      setSaving(false)
      e.target.value = ''
    }
  }

  if (loading || !user) return <div className="text-zinc-400">Loading...</div>

  return (
    <div className="space-y-8">
      {message && (
        <div className={`p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
          {message.text}
        </div>
      )}
      <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-6">
        <h3 className="font-semibold text-white mb-4">Profile Photo</h3>
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 rounded-full bg-zinc-800 overflow-hidden flex items-center justify-center shrink-0">
            {avatar ? <img src={avatar} alt="" className="w-full h-full object-cover" /> : <User size={32} className="text-zinc-500" />}
          </div>
          <div className="flex flex-col gap-2">
            <label className="cursor-pointer">
              <span className="inline-flex items-center justify-center rounded-md bg-zinc-800 border border-zinc-700 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700">
                {compressing ? 'Compressing...' : saving ? 'Saving...' : 'Choose photo'}
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarFile}
                disabled={saving || compressing}
                className="sr-only"
              />
            </label>
            <p className="text-xs text-zinc-500">Select a photo and it will upload automatically.</p>
          </div>
        </div>
      </div>
      <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-6">
        <h3 className="font-semibold text-white mb-4">Account Information</h3>
        <p className="text-zinc-400 text-sm">Name: {user.name}</p>
        <p className="text-zinc-400 text-sm mt-1">Email: {user.email}</p>
        <div className="mt-4">
          <Label className="text-zinc-300">Phone number</Label>
          <Input
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="+1 234 555 0123"
            className="mt-1 bg-zinc-800 border-zinc-700 max-w-xs"
          />
          <Button type="button" onClick={handleSavePhone} disabled={saving} size="sm" className="mt-2 bg-zinc-700 hover:bg-zinc-600 text-white">
            {saving ? 'Saving...' : 'Save phone'}
          </Button>
        </div>
      </div>
      <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-6">
        <h3 className="font-semibold text-white mb-4">Organization-Specific Settings</h3>
        <form onSubmit={handleSaveOrgSettings} className="space-y-4">
          <div>
            <Label className="text-zinc-300">Nickname</Label>
            <Input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Display name in this org"
              maxLength={NICKNAME_MAX_LENGTH}
              className="mt-1 bg-zinc-800 border-zinc-700"
            />
            <p className="text-xs text-zinc-500 mt-1">{nickname.length}/{NICKNAME_MAX_LENGTH}</p>
          </div>
          <div>
            <Label className="text-zinc-300">Title / Position</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. President, Treasurer"
              maxLength={TITLE_MAX_LENGTH}
              className="mt-1 bg-zinc-800 border-zinc-700"
            />
            <p className="text-xs text-zinc-500 mt-1">{title.length}/{TITLE_MAX_LENGTH}</p>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="mute" checked={muteNotifications} onChange={(e) => setMuteNotifications(e.target.checked)} className="rounded" />
            <Label htmlFor="mute" className="text-zinc-300">Mute Notifications</Label>
          </div>
          <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
        </form>
      </div>

      <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-6 border-red-500/30">
        <h3 className="font-semibold text-red-400 mb-2">Danger zone</h3>
        <p className="text-zinc-400 text-sm mb-4">Leave this organization. You will lose access to chat, events, and documents.</p>
        {myRole === 'owner' ? (
          <p className="text-amber-400 text-sm">Owners cannot leave. Transfer ownership to another member in Organization Settings first.</p>
        ) : (
          <Button variant="outline" onClick={() => setLeaveConfirmOpen(true)} className="border-red-500/50 text-red-400 hover:bg-red-500/10">
            Leave organization
          </Button>
        )}
      </div>

      {leaveConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => !leaveLoading && setLeaveConfirmOpen(false)} aria-hidden />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-2">Leave organization?</h3>
            <p className="text-zinc-400 text-sm mb-6">You will lose access to this organization. You can rejoin later with an invite code if needed.</p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setLeaveConfirmOpen(false)} disabled={leaveLoading} className="flex-1 bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700">
                Cancel
              </Button>
              <Button onClick={handleLeaveOrg} disabled={leaveLoading} className="flex-1 bg-red-600 hover:bg-red-700 text-white">
                {leaveLoading ? <> <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Leaving... </> : 'Leave'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const ORG_NAME_MIN = 2
const ORG_NAME_MAX = 100
const ORG_DESC_MAX = 500
const ORG_LOCATION_MAX = 200
const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/

type ClubTab = 'profile' | 'members' | 'billing' | 'danger'

function SettingsClub({ orgId }: { orgId: string }) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [org, setOrg] = useState<{ name: string; description?: string; location?: string; logo?: string; icon_color?: string; public_slug?: string; menu_hidden_pages?: string[]; invite_code?: string } | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [logo, setLogo] = useState<string | null>(null)
  const [iconColor, setIconColor] = useState('#3f3f46')
  const [slug, setSlug] = useState('')
  const [menuHidden, setMenuHidden] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [logoCompressing, setLogoCompressing] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const tabParam = searchParams.get('tab') as ClubTab | null
  const [tab, setTab] = useState<ClubTab>(tabParam === 'members' ? 'members' : 'profile')
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [regenerateConfirmOpen, setRegenerateConfirmOpen] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  useEffect(() => {
    if (tabParam === 'members' && tab !== 'members') setTab('members')
  }, [tabParam])

  const setClubTab = (t: ClubTab) => {
    setTab(t)
    if (t === 'members') setSearchParams({ tab: 'members' }, { replace: true })
    else setSearchParams({}, { replace: true })
  }

  useEffect(() => {
    if (!orgId) return
    api.get(`/organizations/${orgId}`).then((r) => {
      setOrg(r.data)
      setName(r.data.name || '')
      setDescription(r.data.description || '')
      setLocation(r.data.location || '')
      setLogo(r.data.logo || null)
      setIconColor(r.data.icon_color || '#3f3f46')
      setSlug(r.data.public_slug || '')
      setMenuHidden(r.data.menu_hidden_pages || [])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [orgId])

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage(null)
    if (name.trim().length < ORG_NAME_MIN) {
      setMessage({ type: 'error', text: 'Organization name must be at least 2 characters' })
      return
    }
    if (name.trim().length > ORG_NAME_MAX) {
      setMessage({ type: 'error', text: 'Organization name must be at most 100 characters' })
      return
    }
    if (description.length > ORG_DESC_MAX) {
      setMessage({ type: 'error', text: 'Description must be at most 500 characters' })
      return
    }
    if (location.length > ORG_LOCATION_MAX) {
      setMessage({ type: 'error', text: 'Location must be at most 200 characters' })
      return
    }
    if (!HEX_REGEX.test(iconColor)) {
      setMessage({ type: 'error', text: 'Icon color must be a valid hex value (e.g. #FFFFFF)' })
      return
    }
    setSaving(true)
    try {
      const res = await api.put(`/organizations/${orgId}`, {
        name: name.trim(),
        description: description.trim() || undefined,
        location: location.trim() || undefined,
        logo: logo ?? '',
        icon_color: iconColor,
        public_slug: slug.trim() || undefined,
        menu_hidden_pages: menuHidden,
      })
      setOrg((prev) => (prev ? { ...prev, ...res.data } : null))
      setMessage({ type: 'success', text: 'Settings saved!' })
      window.dispatchEvent(new CustomEvent('orgUpdated', { detail: { orgId } }))
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setMessage({ type: 'error', text: typeof detail === 'string' ? detail : 'Failed to save' })
    } finally {
      setSaving(false)
    }
  }

  const handleLogoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    setMessage(null)
    setLogoCompressing(true)
    try {
      const dataUrl = await compressImageFile(file, { maxSize: 400, maxBytes: 500_000 })
      setLogo(dataUrl)
    } catch {
      setMessage({ type: 'error', text: 'Could not process image. Try a different logo.' })
    } finally {
      setLogoCompressing(false)
      e.target.value = ''
    }
  }

  const toggleMenuHidden = (id: string) => {
    setMenuHidden((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const handleRegenerateInvite = async () => {
    setRegenerating(true)
    setMessage(null)
    try {
      const r = await api.post(`/organizations/${orgId}/regenerate-invite`)
      setOrg((prev) => (prev ? { ...prev, invite_code: r.data.invite_code } : null))
      setMessage({ type: 'success', text: `New invite code: ${r.data.invite_code}` })
      setRegenerateConfirmOpen(false)
    } catch {
      setMessage({ type: 'error', text: 'Failed to regenerate code' })
    } finally {
      setRegenerating(false)
    }
  }

  const copyInviteLink = () => {
    const base = window.location.origin
    const path = slug.trim() ? `/org/${slug.trim()}` : (org?.invite_code ? `/join/${org.invite_code}` : '')
    if (!path) return
    navigator.clipboard.writeText(`${base}${path}`)
    setMessage({ type: 'success', text: 'Invite link copied to clipboard' })
  }

  const copyInviteCode = () => {
    if (!org?.invite_code) return
    navigator.clipboard.writeText(org.invite_code)
    setMessage({ type: 'success', text: 'Invite code copied to clipboard' })
  }

  const handleDelete = async () => {
    if (deleteConfirm !== 'DELETE') return
    setSaving(true)
    try {
      await api.delete(`/organizations/${orgId}`)
      navigate('/user-dashboard')
    } catch {
      setMessage({ type: 'error', text: 'Failed to delete organization' })
    } finally {
      setSaving(false)
    }
  }

  if (loading || !org) return <div className="text-zinc-400">Loading...</div>

  return (
    <div className="space-y-8">
      {message && (
        <div className={`p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
          {message.text}
        </div>
      )}
      <div className="flex gap-2 border-b border-zinc-800 pb-4">
        {(['profile', 'members', 'billing', 'danger'] as const).map((t) => (
          <button key={t} type="button" onClick={() => setClubTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === t ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}>
            {t === 'members' ? 'Manage Members' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      {tab === 'profile' && (
        <>
          <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-6">
            <h3 className="font-semibold text-white mb-4">Organization Profile</h3>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <Label className="text-zinc-300">Organization Logo</Label>
                <div className="flex items-center gap-4 mt-2">
                  <div className="h-20 w-20 rounded-xl bg-zinc-800 border border-zinc-700 overflow-hidden flex items-center justify-center shrink-0">
                    {logo ? (
                      <img src={logo} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-2xl font-bold text-zinc-500">{(name || 'O').charAt(0)}</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="cursor-pointer">
                      <span className="inline-flex items-center justify-center rounded-md bg-zinc-800 border border-zinc-700 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700">
                        {logoCompressing ? 'Compressing...' : 'Upload Logo'}
                      </span>
                      <input type="file" accept="image/*" onChange={handleLogoFile} disabled={logoCompressing} className="sr-only" />
                    </label>
                    {logo && (
                      <Button type="button" variant="outline" size="sm" onClick={() => setLogo(null)} className="bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white w-fit">
                        Remove logo
                      </Button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-zinc-500 mt-1">Recommended: square image, 400×400px. PNG or JPG.</p>
              </div>
              <div>
                <Label className="text-zinc-300">Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={ORG_NAME_MAX} className="mt-1 bg-zinc-800 border-zinc-700" />
                <p className="text-xs text-zinc-500 mt-1">{name.length}/{ORG_NAME_MAX}</p>
              </div>
              <div>
                <Label className="text-zinc-300">Description</Label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={ORG_DESC_MAX} className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-white" />
                <p className="text-xs text-zinc-500 mt-1">{description.length}/{ORG_DESC_MAX}</p>
              </div>
              <div>
                <Label className="text-zinc-300">Location</Label>
                <Input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={ORG_LOCATION_MAX} className="mt-1 bg-zinc-800 border-zinc-700" />
                <p className="text-xs text-zinc-500 mt-1">{location.length}/{ORG_LOCATION_MAX}</p>
              </div>
              <div>
                <Label className="text-zinc-300">Icon Color</Label>
                <div className="flex gap-2 mt-1">
                  <input type="color" value={iconColor} onChange={(e) => setIconColor(e.target.value)} className="h-10 w-14 rounded cursor-pointer" />
                  <Input value={iconColor} onChange={(e) => setIconColor(e.target.value)} placeholder="#FFFFFF" className="flex-1 bg-zinc-800 border-zinc-700 font-mono max-w-[120px]" />
                </div>
                <p className="text-xs text-zinc-500 mt-1">Hex value, e.g. #FFFFFF</p>
              </div>
              <div>
                <Label className="text-zinc-300">Public Slug</Label>
                <Input value={slug} onChange={(e) => setSlug(e.target.value.replace(/[^a-z0-9-]/g, '').toLowerCase())} placeholder="my-club" maxLength={50} className="mt-1 bg-zinc-800 border-zinc-700" />
                <p className="text-xs text-zinc-500 mt-1">membercore.io/org/{slug || 'my-club'}</p>
                {slug !== (org?.public_slug ?? '') && slug.trim() && (
                  <p className="text-xs text-amber-400 mt-1">Changing your slug will break existing invite links. Old links will no longer work.</p>
                )}
              </div>
              <div>
                <Label className="text-zinc-300">Invite link & code</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Button type="button" variant="outline" size="sm" onClick={copyInviteLink} className="bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700">
                    Copy link
                  </Button>
                  {org?.invite_code && (
                    <Button type="button" variant="outline" size="sm" onClick={copyInviteCode} className="bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700">
                      Copy code
                    </Button>
                  )}
                </div>
              </div>
              <div>
                <Label className="text-zinc-300">Menu Visibility</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {['directory', 'dues', 'documents', 'polls'].map((id) => (
                    <label key={id} className="flex items-center gap-2">
                      <input type="checkbox" checked={menuHidden.includes(id)} onChange={() => toggleMenuHidden(id)} className="rounded" />
                      <span className="text-sm text-zinc-400">Hide {id}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
                <Button type="button" variant="outline" onClick={() => setRegenerateConfirmOpen(true)} className="bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700">
                  Regenerate Invite Code
                </Button>
              </div>
            </form>
          </div>

          {regenerateConfirmOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/60" onClick={() => !regenerating && setRegenerateConfirmOpen(false)} aria-hidden />
              <div className="relative z-10 w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-700 p-6">
                <h3 className="text-lg font-semibold text-white mb-2">Regenerate invite code?</h3>
                <p className="text-zinc-400 text-sm mb-6">Regenerating will invalidate all existing invite links. Pending join requests will not be affected.</p>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setRegenerateConfirmOpen(false)} disabled={regenerating} className="flex-1 bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700">
                    Cancel
                  </Button>
                  <Button onClick={handleRegenerateInvite} disabled={regenerating} className="flex-1 bg-white text-black hover:bg-zinc-200">
                    {regenerating ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Regenerate'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
      {tab === 'members' && (
        <SettingsMembers orgId={orgId} />
      )}
      {tab === 'billing' && (
        <SettingsBilling orgId={orgId} />
      )}
      {tab === 'danger' && (
        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-6">
          <h3 className="font-semibold text-red-400 mb-2">Delete Organization</h3>
          <p className="text-zinc-400 text-sm mb-4">This action cannot be undone. Type DELETE to confirm.</p>
          <Input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder="DELETE" className="mb-4 bg-zinc-800 border-zinc-700 max-w-xs" />
          <Button variant="destructive" onClick={handleDelete} disabled={deleteConfirm !== 'DELETE' || saving}>Delete Organization</Button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Billing settings (web-only — Stripe subscriptions)
// ---------------------------------------------------------------------------

interface BillingState {
  plan: string
  billing_status: string
  trial_end_date?: string | null
  period_end?: string | null
  stripe_customer_id?: string | null
  stripe_connected_account_id?: string | null
  stripe_connect_onboarded?: boolean
  stripe_connect_charges_enabled?: boolean
  stripe_connect_payouts_enabled?: boolean
  stripe_connect_ready?: boolean
  is_billing_exempt?: boolean
}

function SettingsBilling({ orgId }: { orgId: string }) {
  const [billing, setBilling] = useState<BillingState | null>(null)
  const [loading, setLoading] = useState(true)
  const [billingActionLoading, setBillingActionLoading] = useState(false)
  const [payoutActionLoading, setPayoutActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [subscribePlan, setSubscribePlan] = useState<'pro_monthly' | 'pro_annual'>('pro_monthly')

  useEffect(() => {
    api.get(`/billing/${orgId}/billing`)
      .then((r) => setBilling(r.data))
      .catch(() => setBilling(null))
      .finally(() => setLoading(false))
  }, [orgId])

  const handleSubscribe = async () => {
    setBillingActionLoading(true)
    setError(null)
    try {
      const { data } = await api.post(`/billing/${orgId}/billing/create-checkout-session`, {
        plan: subscribePlan,
      })
      if (data.checkout_url) {
        window.location.href = data.checkout_url
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Could not start checkout. Please try again.')
    } finally {
      setBillingActionLoading(false)
    }
  }

  const handleManageBilling = async () => {
    setBillingActionLoading(true)
    setError(null)
    try {
      const returnUrl = `${window.location.origin}/org/${orgId}/settings?tab=club`
      const { data } = await api.post(
        `/billing/${orgId}/billing/portal`,
        null,
        { params: { return_url: returnUrl } },
      )
      if (data.portal_url) {
        window.location.href = data.portal_url
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Could not open billing portal. Please try again.')
    } finally {
      setBillingActionLoading(false)
    }
  }

  const handleConnectPayouts = async () => {
    setPayoutActionLoading(true)
    setError(null)
    try {
      const returnUrl = `${window.location.origin}/org/${orgId}/settings?tab=club&stripe=connected`
      const { data } = await api.post(`/billing/${orgId}/billing/connect/onboarding`, {
        refresh_url: returnUrl,
        return_url: returnUrl,
      })
      if (data.url) {
        window.location.href = data.url
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail || 'Could not start Stripe payouts onboarding. Please try again.'
      if (typeof detail === 'string' && detail.includes("signed up for Connect")) {
        setError(
          'Stripe Connect is not enabled on this Stripe account yet. Enable Connect first at https://dashboard.stripe.com/connect, then try again.',
        )
      } else {
        setError(detail)
      }
    } finally {
      setPayoutActionLoading(false)
    }
  }

  const handleOpenPayoutDashboard = async () => {
    setPayoutActionLoading(true)
    setError(null)
    try {
      const redirectUrl = `${window.location.origin}/org/${orgId}/settings?tab=club`
      const { data } = await api.post(`/billing/${orgId}/billing/connect/login-link`, {
        redirect_url: redirectUrl,
      })
      if (data.url) {
        window.location.href = data.url
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Could not open Stripe payouts dashboard. Please try again.')
    } finally {
      setPayoutActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-6 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
      </div>
    )
  }

  const isPro = billing?.plan === 'pro'
  const isActive = billing?.billing_status === 'active' || billing?.billing_status === 'trial' || billing?.billing_status === 'exempt'
  const isTrial = billing?.billing_status === 'trial'
  const isPastDue = billing?.billing_status === 'past_due'
  const isExempt = billing?.is_billing_exempt
  const hasConnectedAccount = Boolean(billing?.stripe_connected_account_id)
  const payoutsReady = Boolean(billing?.stripe_connect_ready)

  const statusColor = isActive
    ? 'text-green-400'
    : isPastDue
    ? 'text-amber-400'
    : 'text-red-400'

  const statusLabel = isExempt
    ? 'Exempt'
    : isTrial
    ? 'Trial'
    : billing?.billing_status
    ? billing.billing_status.charAt(0).toUpperCase() + billing.billing_status.slice(1).replace('_', ' ')
    : 'Inactive'

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Subscription</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-zinc-400">Current Plan</p>
            <p className="text-xl font-bold text-white mt-1">
              {isPro ? (
                <span className="inline-flex items-center gap-2">
                  Pro
                  <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full font-medium">Active</span>
                </span>
              ) : (
                'Free'
              )}
            </p>
          </div>
          <div>
            <p className="text-sm text-zinc-400">Status</p>
            <p className={`text-xl font-bold mt-1 ${statusColor}`}>{statusLabel}</p>
          </div>
          {isTrial && billing?.trial_end_date && (
            <div>
              <p className="text-sm text-zinc-400">Trial Ends</p>
              <p className="text-white mt-1">
                {new Date(billing.trial_end_date).toLocaleDateString(undefined, {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            </div>
          )}
          {isActive && billing?.period_end && (
            <div>
              <p className="text-sm text-zinc-400">Next Billing Date</p>
              <p className="text-white mt-1">
                {new Date(billing.period_end).toLocaleDateString(undefined, {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Past Due Warning */}
      {isPastDue && (
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-4">
          <p className="text-amber-400 font-medium">Payment Failed</p>
          <p className="text-amber-400/70 text-sm mt-1">
            Your last payment didn't go through. Update your payment method to keep Pro features active.
          </p>
        </div>
      )}

      {/* Inactive Warning */}
      {!isActive && !isPastDue && billing?.plan === 'free' && (
        <div className="rounded-xl bg-zinc-800/50 border border-zinc-700 p-4">
          <p className="text-zinc-300 font-medium">Upgrade to Pro</p>
          <p className="text-zinc-400 text-sm mt-1">
            Unlock chat, event creation, dues management, polls, analytics, and more for your organization.
          </p>
          <div className="mt-3">
            <p className="text-xs text-zinc-400 mb-2">Choose your plan:</p>
            <div className="inline-flex rounded-lg border border-zinc-700 bg-zinc-900/70 p-1">
              <button
                type="button"
                onClick={() => setSubscribePlan('pro_monthly')}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                  subscribePlan === 'pro_monthly'
                    ? 'bg-white text-black font-semibold'
                    : 'text-zinc-300 hover:text-white'
                }`}
              >
                Monthly ($97)
              </button>
              <button
                type="button"
                onClick={() => setSubscribePlan('pro_annual')}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                  subscribePlan === 'pro_annual'
                    ? 'bg-white text-black font-semibold'
                    : 'text-zinc-300 hover:text-white'
                }`}
              >
                Annual ($970)
                <span className="ml-1.5 inline-flex rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                  Save 17%
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Organization payouts */}
      <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-6">
        <h3 className="text-lg font-semibold text-white mb-2">Organization Payouts</h3>
        <p className="text-sm text-zinc-400 mb-4">
          Connect your organization Stripe account so dues and ticket payments are paid out directly to your organization.
        </p>
        <div className="flex items-center gap-2 mb-4">
          <span className={`h-2.5 w-2.5 rounded-full ${payoutsReady ? 'bg-green-500' : 'bg-amber-500'}`} />
          <span className={`text-sm font-medium ${payoutsReady ? 'text-green-400' : 'text-amber-400'}`}>
            {payoutsReady ? 'Payouts connected' : hasConnectedAccount ? 'Connection setup incomplete' : 'Not connected'}
          </span>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          {!payoutsReady ? (
            <button
              onClick={handleConnectPayouts}
              disabled={payoutActionLoading}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {payoutActionLoading ? 'Loading...' : hasConnectedAccount ? 'Continue Stripe Setup' : 'Connect Stripe Payouts'}
            </button>
          ) : (
            <button
              onClick={handleOpenPayoutDashboard}
              disabled={payoutActionLoading}
              className="px-6 py-3 bg-zinc-100 text-black hover:bg-zinc-200 font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {payoutActionLoading ? 'Loading...' : 'Open Stripe Express Dashboard'}
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Manage Billing</h3>
        {!isExempt && (
          <div className="flex flex-col sm:flex-row gap-3">
            {!isPro ? (
              <button
                onClick={handleSubscribe}
                disabled={billingActionLoading}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {billingActionLoading
                  ? 'Loading...'
                  : subscribePlan === 'pro_annual'
                    ? 'Subscribe to Pro (Annual)'
                    : 'Subscribe to Pro (Monthly)'}
              </button>
            ) : (
              <button
                onClick={handleManageBilling}
                disabled={billingActionLoading}
                className="px-6 py-3 bg-white text-black hover:bg-zinc-200 font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {billingActionLoading ? 'Loading...' : 'Manage Subscription'}
              </button>
            )}
          </div>
        )}
        {isExempt && (
          <p className="text-zinc-400 text-sm">
            This organization has an exempt billing status. No payment is required.
          </p>
        )}
        <p className="text-zinc-500 text-xs mt-4">
          Manage Billing is for your MemberCore Pro subscription only. Organization Payouts above is where you connect Stripe to receive dues and ticket funds.
        </p>
      </div>
    </div>
  )
}

interface TreasuryStats {
  total_collected: number
  paid_count: number
  paid_in_full_count: number
  pending_count: number
  past_due_count: number
}

interface MemberPlanBalanceRow {
  plan_id: string
  plan_name: string
  total: number
  paid: number
  paid_in_full: boolean
}

interface MemberStatusRow {
  member_id: string
  user_id: string
  user_name: string
  user_email: string
  user_avatar?: string | null
  nickname?: string
  title?: string
  total_paid: number
  paid_in_full: boolean
  dues_waived?: boolean
  status: string
  plan_balances?: MemberPlanBalanceRow[]
}

interface MemberPaymentRow {
  id: string
  amount: number
  payment_method: string
  paid_date?: string
  created_at?: string
  notes?: string
  plan_id?: string
  plan_name?: string
}

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
  { value: 'cashapp', label: 'CashApp' },
  { value: 'venmo', label: 'Venmo' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'other', label: 'Other' },
]

function SettingsDues({ orgId }: { orgId: string }) {
  type PlanMode = 'full' | 'custom' | 'installment'
  const [plans, setPlans] = useState<{ id: string; name: string; amount: number; total_amount?: number; due_date?: string; frequency: string; payment_option?: string; installment_months?: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [createModal, setCreateModal] = useState(false)
  const [editingPlan, setEditingPlan] = useState<{ id: string; name: string; amount: number; total_amount?: number; due_date?: string; frequency: string; payment_option?: string; installment_months?: number } | null>(null)
  const [planName, setPlanName] = useState('')
  const [planAmount, setPlanAmount] = useState('')
  const [planTotalAmount, setPlanTotalAmount] = useState('')
  const [planDate, setPlanDate] = useState('')
  const [planInstallmentMonths, setPlanInstallmentMonths] = useState('')
  const [planMode, setPlanMode] = useState<PlanMode>('installment')
  const [planError, setPlanError] = useState('')
  const [planLoading, setPlanLoading] = useState(false)
  const [planListError, setPlanListError] = useState('')
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null)
  const [org, setOrg] = useState<{ dues_label?: string } | null>(null)
  const [terminologyValue, setTerminologyValue] = useState<string>('Dues')
  const [terminologySaving, setTerminologySaving] = useState(false)
  const [terminologyMessage, setTerminologyMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const [treasuryStats, setTreasuryStats] = useState<TreasuryStats | null>(null)
  const [memberStatuses, setMemberStatuses] = useState<MemberStatusRow[]>([])
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null)
  const [memberPaymentsById, setMemberPaymentsById] = useState<Record<string, MemberPaymentRow[]>>({})
  const [memberPaymentsLoadingId, setMemberPaymentsLoadingId] = useState<string | null>(null)
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null)
  const [paymentListError, setPaymentListError] = useState('')
  const [treasuryLoading, setTreasuryLoading] = useState(true)
  const [showRecordModal, setShowRecordModal] = useState(false)
  const [recordForm, setRecordForm] = useState({
    member_id: '',
    plan_id: '',
    amount: '',
    paid_date: new Date().toISOString().slice(0, 10),
    payment_method: 'other',
    notes: '',
    mark_paid_in_full: false,
  })
  const [recordSubmitting, setRecordSubmitting] = useState(false)
  const [recordError, setRecordError] = useState('')
  const [remindLoading, setRemindLoading] = useState(false)
  const [remindMessage, setRemindMessage] = useState('')
  const [markingMemberId, setMarkingMemberId] = useState<string | null>(null)

  const autoInstallmentMonthsFromDueDate = (dueDateValue: string) => {
    if (!dueDateValue) return null
    const due = new Date(`${dueDateValue}T00:00:00`)
    if (Number.isNaN(due.getTime())) return null
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    if (due < today) return null
    return (due.getFullYear() - today.getFullYear()) * 12 + (due.getMonth() - today.getMonth()) + 1
  }
  const parsedPlanMonths =
    planInstallmentMonths.trim() && !Number.isNaN(Number(planInstallmentMonths)) && Number(planInstallmentMonths) > 0
      ? Number(planInstallmentMonths)
      : null
  const autoPlanMonths = autoInstallmentMonthsFromDueDate(planDate)
  const previewInstallmentMonths = parsedPlanMonths ?? autoPlanMonths

  const fetchPlans = useCallback(async () => {
    if (!orgId) return
    try {
      const [pRes, oRes] = await Promise.all([
        api.get(`/dues/${orgId}/plans`),
        api.get(`/organizations/${orgId}`),
      ])
      setPlans(Array.isArray(pRes.data) ? pRes.data : [])
      setOrg(oRes.data)
      setTerminologyValue(oRes.data?.dues_label || 'Dues')
    } catch {
      setPlans([])
    } finally {
      setLoading(false)
    }
  }, [orgId])

  const fetchTreasury = useCallback(async () => {
    if (!orgId) return
    setTreasuryLoading(true)
    try {
      const [statsRes, statusRes] = await Promise.all([
        api.get(`/dues/${orgId}/treasury`),
        api.get(`/dues/${orgId}/member-status`),
      ])
      setTreasuryStats(statsRes.data)
      setMemberStatuses(Array.isArray(statusRes.data) ? statusRes.data : [])
    } catch {
      setTreasuryStats(null)
      setMemberStatuses([])
    } finally {
      setTreasuryLoading(false)
    }
  }, [orgId])

  useEffect(() => {
    setLoading(true)
    fetchPlans()
  }, [fetchPlans])

  useEffect(() => {
    fetchTreasury()
  }, [fetchTreasury])

  const openCreatePlanModal = () => {
    setEditingPlan(null)
    setPlanName('')
    setPlanAmount('')
    setPlanTotalAmount('')
    setPlanDate('')
    setPlanInstallmentMonths('')
    setPlanMode('installment')
    setPlanError('')
    setCreateModal(true)
  }

  const openEditPlanModal = (p: { id: string; name: string; amount: number; total_amount?: number; due_date?: string; frequency: string; payment_option?: string; installment_months?: number }) => {
    setEditingPlan(p)
    setPlanName(p.name)
    setPlanAmount(String(p.amount))
    setPlanTotalAmount(p.total_amount != null ? String(p.total_amount) : '')
    setPlanDate(p.due_date || '')
    setPlanMode(
      p.payment_option === 'custom_only'
        ? 'custom'
        : p.payment_option === 'installment_only' || p.installment_months
          ? 'installment'
          : 'full',
    )
    setPlanInstallmentMonths(p.installment_months != null ? String(p.installment_months) : '')
    setPlanError('')
    setCreateModal(true)
  }

  const closePlanModal = () => {
    setCreateModal(false)
    setEditingPlan(null)
    setPlanName('')
    setPlanAmount('')
    setPlanTotalAmount('')
    setPlanDate('')
    setPlanInstallmentMonths('')
    setPlanMode('installment')
    setPlanError('')
  }

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault()
    setPlanError('')
    const totalAmountParsed = planTotalAmount.trim() ? parseFloat(planTotalAmount) : null
    const monthsParsed = planInstallmentMonths.trim() ? Number(planInstallmentMonths.trim()) : null
    const autoMonthsFromDueDate = autoInstallmentMonthsFromDueDate(planDate)
    const amountParsed = parseFloat(planAmount)
    if (!planName.trim()) {
      setPlanError('Name is required')
      return
    }

    let payloadAmount = amountParsed
    let payloadTotalAmount: number | undefined
    let payloadPaymentOption: 'full_only' | 'custom_only' | 'installment_only' = 'full_only'
    let payloadFrequency = editingPlan?.frequency || 'one_time'
    let payloadInstallmentMonths: number | undefined

    if (planMode === 'full') {
      if (Number.isNaN(amountParsed) || amountParsed <= 0) {
        setPlanError('Amount due must be greater than 0')
        return
      }
      payloadAmount = amountParsed
      payloadPaymentOption = 'full_only'
      payloadFrequency = 'one_time'
    } else if (planMode === 'custom') {
      if (Number.isNaN(amountParsed) || amountParsed <= 0) {
        setPlanError('Minimum payment must be greater than 0')
        return
      }
      if (totalAmountParsed !== null && (isNaN(totalAmountParsed) || totalAmountParsed < amountParsed)) {
        setPlanError('Total amount must be at least the minimum payment')
        return
      }
      payloadAmount = amountParsed
      payloadTotalAmount = totalAmountParsed ?? undefined
      payloadPaymentOption = 'custom_only'
      payloadFrequency = 'one_time'
    } else {
      if (totalAmountParsed === null || totalAmountParsed <= 0) {
        setPlanError('Set a total amount when using installment months')
        return
      }
      const effectiveMonths = Number.isInteger(monthsParsed) && (monthsParsed ?? 0) > 0
        ? (monthsParsed as number)
        : autoMonthsFromDueDate
      if (!effectiveMonths || effectiveMonths <= 0) {
        setPlanError('Set installment months or set a valid future due date to auto-calculate months')
        return
      }
      payloadAmount = Number((totalAmountParsed / effectiveMonths).toFixed(2))
      payloadTotalAmount = totalAmountParsed
      payloadPaymentOption = 'installment_only'
      payloadFrequency = 'monthly'
      payloadInstallmentMonths = effectiveMonths
    }

    setPlanLoading(true)
    try {
      const payload = {
        name: planName.trim(),
        amount: payloadAmount,
        total_amount: payloadTotalAmount,
        due_date: planDate || undefined,
        frequency: payloadFrequency,
        payment_option: payloadPaymentOption,
        installment_months: payloadInstallmentMonths,
      }
      if (editingPlan) {
        await api.put(`/dues/${orgId}/plans/${editingPlan.id}`, payload)
      } else {
        await api.post(`/dues/${orgId}/plans`, payload)
      }
      closePlanModal()
      fetchPlans()
    } catch (err: unknown) {
      setPlanError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || (editingPlan ? 'Failed to update plan' : 'Failed to create plan'))
    } finally {
      setPlanLoading(false)
    }
  }

  const handleDeletePlan = async (plan: { id: string; name: string }) => {
    if (!orgId) return
    if (!window.confirm(`Delete "${plan.name}"? This removes it from member payment options.`)) return
    setPlanListError('')
    setDeletingPlanId(plan.id)
    try {
      await api.delete(`/dues/${orgId}/plans/${plan.id}`)
      if (editingPlan?.id === plan.id) closePlanModal()
      await Promise.all([fetchPlans(), fetchTreasury()])
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setPlanListError(typeof detail === 'string' ? detail : 'Failed to delete plan')
    } finally {
      setDeletingPlanId(null)
    }
  }

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    setRecordError('')
    const amount = parseFloat(recordForm.amount)
    if (!recordForm.member_id) {
      setRecordError('Select a member')
      return
    }
    if (isNaN(amount) || amount <= 0) {
      setRecordError('Enter a valid amount')
      return
    }
    setRecordSubmitting(true)
    try {
      await api.post(`/dues/${orgId}/manual-payment`, {
        member_id: recordForm.member_id,
        plan_id: recordForm.plan_id || undefined,
        amount,
        paid_date: recordForm.paid_date || undefined,
        payment_method: recordForm.payment_method,
        notes: recordForm.notes.trim() || undefined,
        mark_paid_in_full: recordForm.mark_paid_in_full,
      })
      setShowRecordModal(false)
      setRecordForm({
        member_id: '',
        plan_id: '',
        amount: '',
        paid_date: new Date().toISOString().slice(0, 10),
        payment_method: 'other',
        notes: '',
        mark_paid_in_full: false,
      })
      fetchTreasury()
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setRecordError(typeof detail === 'string' ? detail : 'Failed to record payment')
    } finally {
      setRecordSubmitting(false)
    }
  }

  const handleMarkPaidInFull = async (memberId: string, current: boolean) => {
    setMarkingMemberId(memberId)
    try {
      await api.post(`/dues/${orgId}/mark-paid-in-full`, { member_id: memberId, paid_in_full: !current })
      fetchTreasury()
    } finally {
      setMarkingMemberId(null)
    }
  }

  const handleSendReminders = async () => {
    setRemindLoading(true)
    setRemindMessage('')
    setPaymentListError('')
    try {
      const res = await api.post<{ message?: string }>(`/dues/${orgId}/remind`)
      setRemindMessage(
        typeof res.data?.message === 'string' ? res.data.message : 'Reminders processed.',
      )
      fetchTreasury()
    } catch {
      setRemindMessage('')
      setPaymentListError('Failed to send reminders.')
    } finally {
      setRemindLoading(false)
    }
  }

  const toggleMemberPayments = async (memberId: string) => {
    if (expandedMemberId === memberId) {
      setExpandedMemberId(null)
      return
    }
    setExpandedMemberId(memberId)
    if (memberPaymentsById[memberId]) return
    setMemberPaymentsLoadingId(memberId)
    try {
      const res = await api.get(`/dues/${orgId}/members/${memberId}/payments`)
      setMemberPaymentsById((prev) => ({ ...prev, [memberId]: Array.isArray(res.data) ? res.data : [] }))
    } catch {
      setMemberPaymentsById((prev) => ({ ...prev, [memberId]: [] }))
    } finally {
      setMemberPaymentsLoadingId(null)
    }
  }

  const handleDeletePayment = async (memberId: string, paymentId: string) => {
    if (!orgId) return
    if (!window.confirm('Delete this payment record? This cannot be undone.')) return
    setPaymentListError('')
    setDeletingPaymentId(paymentId)
    try {
      await api.delete(`/dues/${orgId}/payments/${paymentId}`)
      setMemberPaymentsById((prev) => ({
        ...prev,
        [memberId]: (prev[memberId] || []).filter((p) => p.id !== paymentId),
      }))
      await fetchTreasury()
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setPaymentListError(typeof detail === 'string' ? detail : 'Failed to delete payment')
    } finally {
      setDeletingPaymentId(null)
    }
  }

  const terminologyOptions = ['Dues', 'Contribution', 'Donation', 'Offering', 'Membership Fee', 'Payments', 'Sponsorship']

  const handleSaveTerminology = async () => {
    setTerminologyMessage(null)
    setTerminologySaving(true)
    try {
      await api.put(`/organizations/${orgId}`, { dues_label: terminologyValue })
      setOrg((o) => (o ? { ...o, dues_label: terminologyValue } : null))
      setTerminologyMessage({ type: 'success', text: 'Terminology saved.' })
      window.dispatchEvent(new CustomEvent('duesLabelChanged', { detail: { orgId, label: terminologyValue } }))
      window.dispatchEvent(new CustomEvent('orgUpdated', { detail: { orgId } }))
      setTimeout(() => setTerminologyMessage(null), 3000)
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setTerminologyMessage({ type: 'error', text: typeof detail === 'string' ? detail : 'Failed to save' })
    } finally {
      setTerminologySaving(false)
    }
  }

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      paid_in_full: 'bg-blue-500/20 text-blue-400',
      paid: 'bg-green-500/20 text-green-400',
      pending: 'bg-yellow-500/20 text-yellow-400',
      past_due: 'bg-red-500/20 text-red-400',
    }
    const label: Record<string, string> = {
      paid_in_full: 'Paid in Full',
      paid: 'Paid',
      pending: 'Pending',
      past_due: 'Past Due',
      none: 'None',
    }
    return (
      <span className={cn('px-2 py-1 rounded text-xs font-medium', map[status] ?? 'bg-zinc-700/50 text-zinc-400')}>
        {label[status] ?? status}
      </span>
    )
  }

  /** Member row: single "Paid up" when treasury considers the member complete (payments or org mark). Per-plan "Paid in full" stays in By plan + payment lines. */
  const treasuryMemberAggregateBadge = (m: MemberStatusRow) => {
    if (m.paid_in_full) {
      return <span className="px-2 py-1 rounded text-xs font-medium bg-green-500/20 text-green-400">Paid up</span>
    }
    return statusBadge(m.status)
  }

  return (
    <div className="space-y-8">
      <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-6">
        <h3 className="font-semibold text-white mb-4">Terminology</h3>
        <p className="text-zinc-400 text-sm mb-2">What do you call payments?</p>
        <div className="flex flex-wrap items-center gap-3">
          <select
            className="flex h-10 w-full max-w-xs rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white"
            value={terminologyValue}
            onChange={(e) => setTerminologyValue(e.target.value)}
          >
            {terminologyOptions.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          <Button
            type="button"
            onClick={handleSaveTerminology}
            disabled={terminologySaving || terminologyValue === (org?.dues_label || 'Dues')}
            className="bg-white text-black hover:bg-zinc-200"
          >
            {terminologySaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
          </Button>
        </div>
        {terminologyMessage && (
          <p className={cn('text-sm mt-2', terminologyMessage.type === 'success' ? 'text-green-400' : 'text-red-400')}>
            {terminologyMessage.text}
          </p>
        )}
      </div>

      <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white">Payment Plans</h3>
          <Button onClick={openCreatePlanModal} className="bg-white text-black hover:bg-zinc-200">
            <Plus size={18} />
            <span className="ml-2">Create Plan</span>
          </Button>
        </div>
        {planListError ? <p className="text-sm text-red-400 mb-3">{planListError}</p> : null}
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-zinc-500" /></div>
        ) : plans.length === 0 ? (
          <p className="text-zinc-500">No plans yet. Create one to get started.</p>
        ) : (
          <ul className="space-y-2">
            {plans.map((p) => (
              <li key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-zinc-800 border border-zinc-700">
                <span className="font-medium text-white">{p.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-zinc-400">
                    ${p.amount.toFixed(2)}
                    {p.installment_months ? ` x ${p.installment_months} months` : ''}
                    {p.total_amount != null ? ` / $${p.total_amount.toFixed(2)} total` : ''}
                    {p.due_date ? ` • Due ${new Date(p.due_date).toLocaleDateString()}` : ''}
                  </span>
                  <Button type="button" variant="ghost" size="sm" onClick={() => openEditPlanModal(p)} className="text-zinc-400 hover:text-white p-1.5" title="Edit plan">
                    <Edit2 size={16} />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeletePlan(p)}
                    disabled={deletingPlanId === p.id}
                    className="text-zinc-500 hover:text-red-400 p-1.5"
                    title="Delete plan"
                  >
                    {deletingPlanId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 size={16} />}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-6">
        <h3 className="font-semibold text-white mb-4">Treasury Dashboard</h3>
        <div className="flex flex-wrap gap-3 mb-4">
          <Button onClick={() => setShowRecordModal(true)} className="bg-green-600 hover:bg-green-700 text-white">
            <DollarSign size={18} />
            <span className="ml-2">Record Payment</span>
          </Button>
          <Button variant="outline" onClick={handleSendReminders} disabled={remindLoading} className="bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700">
            {remindLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            <span className="ml-2">Send Reminders</span>
          </Button>
        </div>
        {remindMessage ? <p className="text-sm text-emerald-400 mb-3">{remindMessage}</p> : null}
        {treasuryLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-zinc-500" /></div>
        ) : treasuryStats ? (
          <>
            {paymentListError ? <p className="text-sm text-red-400 mb-3">{paymentListError}</p> : null}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
              <div className="rounded-lg bg-zinc-800 border border-zinc-700 p-4">
                <p className="text-2xl font-bold text-white">${treasuryStats.total_collected.toFixed(2)}</p>
                <p className="text-xs text-zinc-500">Total Collected</p>
              </div>
              <div className="rounded-lg bg-zinc-800 border border-zinc-700 p-4">
                <p className="text-2xl font-bold text-green-400">{treasuryStats.paid_in_full_count}</p>
                <p className="text-xs text-zinc-500">Paid in Full</p>
              </div>
              <div className="rounded-lg bg-zinc-800 border border-zinc-700 p-4">
                <p className="text-2xl font-bold text-green-400">{treasuryStats.paid_count}</p>
                <p className="text-xs text-zinc-500">Paid</p>
              </div>
              <div className="rounded-lg bg-zinc-800 border border-zinc-700 p-4">
                <p className="text-2xl font-bold text-red-400">{treasuryStats.past_due_count}</p>
                <p className="text-xs text-zinc-500">Past Due</p>
              </div>
              <div className="rounded-lg bg-zinc-800 border border-zinc-700 p-4">
                <p className="text-2xl font-bold text-yellow-400">{treasuryStats.pending_count}</p>
                <p className="text-xs text-zinc-500">Pending</p>
              </div>
            </div>
            <p className="text-sm text-zinc-400 mb-2">Members</p>
            <div className="max-h-96 overflow-y-auto rounded-lg border border-zinc-700">
              {memberStatuses.length === 0 ? (
                <div className="p-6 text-center text-zinc-500 text-sm">No members</div>
              ) : (
                <ul className="divide-y divide-zinc-700">
                  {memberStatuses.map((m) => (
                    <li key={m.member_id} className="bg-zinc-800/50 hover:bg-zinc-800">
                      <div className="flex items-center justify-between gap-4 p-3">
                        <button
                          type="button"
                          onClick={() => toggleMemberPayments(m.member_id)}
                          className="flex items-center gap-3 min-w-0 text-left"
                        >
                          {m.user_avatar ? (
                            <img
                              src={m.user_avatar}
                              alt={getDisplayName(m.user_name, m.nickname)}
                              className="w-8 h-8 rounded-full object-cover shrink-0 border border-zinc-600"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-sm font-medium text-zinc-300 shrink-0">
                              {getDisplayName(m.user_name, m.nickname).charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-white truncate flex items-center gap-2">
                              {expandedMemberId === m.member_id ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              <span>{getDisplayName(m.user_name, m.nickname)}</span>
                            </p>
                            <p className="text-xs text-zinc-500 truncate">${m.total_paid.toFixed(2)} paid</p>
                          </div>
                        </button>
                        <div className="flex items-center gap-2 shrink-0">
                          {treasuryMemberAggregateBadge(m)}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleMarkPaidInFull(m.member_id, m.paid_in_full)}
                            disabled={markingMemberId === m.member_id || m.paid_in_full}
                            className="text-xs bg-zinc-700 border-zinc-600 text-white hover:bg-zinc-600"
                          >
                            {markingMemberId === m.member_id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : m.paid_in_full ? (
                              'Paid up'
                            ) : (
                              'Mark satisfied'
                            )}
                          </Button>
                        </div>
                      </div>
                      {m.plan_balances && m.plan_balances.length > 0 ? (
                        <div className="px-3 pb-2">
                          <div className="rounded-md border border-zinc-700 bg-zinc-950/80 px-3 py-2">
                            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 mb-2">By plan</p>
                            <ul className="space-y-2">
                              {m.plan_balances.map((row) => {
                                const due = Math.max(0, row.total - row.paid)
                                return (
                                  <li key={row.plan_id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                                    <span className="text-zinc-200 font-medium truncate min-w-0">{row.plan_name}</span>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <span className="text-zinc-500 text-xs tabular-nums">
                                        ${row.paid.toFixed(2)} / ${row.total.toFixed(2)}
                                      </span>
                                      {row.paid_in_full ? (
                                        <span className="rounded-full border border-green-500/35 bg-green-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-400">
                                          Paid in full
                                        </span>
                                      ) : (
                                        <span className="text-amber-400 text-xs tabular-nums">${due.toFixed(2)} due</span>
                                      )}
                                    </div>
                                  </li>
                                )
                              })}
                            </ul>
                          </div>
                        </div>
                      ) : null}
                      {expandedMemberId === m.member_id && (
                        <div className="px-3 pb-3 space-y-3">
                          {memberPaymentsLoadingId === m.member_id ? (
                            <div className="rounded-md border border-zinc-700 bg-zinc-900 p-3 text-sm text-zinc-400 flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Loading payments...
                            </div>
                          ) : (
                            <div className="rounded-md border border-zinc-700 bg-zinc-900 overflow-hidden">
                              {(memberPaymentsById[m.member_id] || []).length === 0 ? (
                                <div className="p-3 text-sm text-zinc-500">No recorded payments for this member.</div>
                              ) : (
                                <ul className="divide-y divide-zinc-700">
                                  {(memberPaymentsById[m.member_id] || []).map((p) => {
                                    const planFull =
                                      p.plan_id &&
                                      m.plan_balances?.some(
                                        (row) => row.plan_id === p.plan_id && row.paid_in_full,
                                      )
                                    return (
                                      <li key={p.id} className="p-3 text-sm">
                                        <div className="flex items-center justify-between gap-2">
                                          <p className="text-white font-medium">${Number(p.amount || 0).toFixed(2)}</p>
                                          <div className="flex items-center gap-2">
                                            <p className="text-zinc-500">
                                              {p.paid_date || (p.created_at ? new Date(p.created_at).toLocaleDateString() : '—')}
                                            </p>
                                            <button
                                              type="button"
                                              onClick={() => handleDeletePayment(m.member_id, p.id)}
                                              disabled={deletingPaymentId === p.id}
                                              className="text-zinc-500 hover:text-red-400 disabled:opacity-50"
                                              title="Delete payment"
                                            >
                                              {deletingPaymentId === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 size={13} />}
                                            </button>
                                          </div>
                                        </div>
                                        <div className="text-zinc-400 text-xs mt-1 flex flex-wrap items-center gap-2">
                                          <span>
                                            {(p.payment_method || 'other').toUpperCase()}
                                            {p.plan_name ? (
                                              <>
                                                {' '}
                                                •{' '}
                                                <span className="text-zinc-300">{p.plan_name}</span>
                                              </>
                                            ) : (
                                              ''
                                            )}
                                            {p.notes ? ` • ${p.notes}` : ''}
                                          </span>
                                          {planFull ? (
                                            <span className="rounded-full border border-green-500/35 bg-green-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-green-400">
                                              Paid in full
                                            </span>
                                          ) : null}
                                        </div>
                                      </li>
                                    )
                                  })}
                                </ul>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        ) : (
          <p className="text-zinc-500 text-sm">Unable to load treasury data.</p>
        )}
      </div>

      {showRecordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowRecordModal(false)} aria-hidden />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-zinc-700">
              <h3 className="text-lg font-semibold text-white">Record Payment</h3>
              <button type="button" onClick={() => setShowRecordModal(false)} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400"><X size={20} /></button>
            </div>
            <form onSubmit={handleRecordPayment} className="p-4 space-y-4">
              {recordError && <div className="text-sm text-red-400 bg-red-500/10 p-3 rounded-lg">{recordError}</div>}
              <div>
                <Label className="text-zinc-300">Member (required)</Label>
                <select
                  required
                  value={recordForm.member_id}
                  onChange={(e) => setRecordForm((f) => ({ ...f, member_id: e.target.value }))}
                  className="mt-1 w-full h-10 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white"
                >
                  <option value="">Select member</option>
                  {memberStatuses.map((m) => (
                    <option key={m.member_id} value={m.member_id}>{getDisplayName(m.user_name, m.nickname)}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-zinc-300">Plan (optional)</Label>
                <select
                  value={recordForm.plan_id}
                  onChange={(e) => {
                    const p = plans.find((x) => x.id === e.target.value)
                    setRecordForm((f) => ({ ...f, plan_id: e.target.value, amount: p ? String(p.amount) : f.amount }))
                  }}
                  className="mt-1 w-full h-10 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white"
                >
                  <option value="">None</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} (${p.amount.toFixed(2)})</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-zinc-300">Amount ($) (required)</Label>
                <Input type="number" step="0.01" min="0" value={recordForm.amount} onChange={(e) => setRecordForm((f) => ({ ...f, amount: e.target.value }))} placeholder="0.00" required className="mt-1 bg-zinc-800 border-zinc-700" />
              </div>
              <div>
                <Label className="text-zinc-300">Paid date</Label>
                <Input type="date" value={recordForm.paid_date} onChange={(e) => setRecordForm((f) => ({ ...f, paid_date: e.target.value }))} className="mt-1 bg-zinc-800 border-zinc-700" />
              </div>
              <div>
                <Label className="text-zinc-300">Payment method</Label>
                <select
                  value={recordForm.payment_method}
                  onChange={(e) => setRecordForm((f) => ({ ...f, payment_method: e.target.value }))}
                  className="mt-1 w-full h-10 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white"
                >
                  {PAYMENT_METHODS.map((pm) => (
                    <option key={pm.value} value={pm.value}>{pm.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-zinc-300">Notes (optional)</Label>
                <Input value={recordForm.notes} onChange={(e) => setRecordForm((f) => ({ ...f, notes: e.target.value }))} placeholder="e.g. Cash received at meeting" className="mt-1 bg-zinc-800 border-zinc-700" />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="mark-paid-full"
                  checked={recordForm.mark_paid_in_full}
                  onChange={(e) => setRecordForm((f) => ({ ...f, mark_paid_in_full: e.target.checked }))}
                  className="rounded border-zinc-600 bg-zinc-800"
                />
                <Label htmlFor="mark-paid-full" className="text-zinc-300 cursor-pointer">
                  Mark this member&apos;s remaining balance as satisfied (after recording this payment)
                </Label>
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowRecordModal(false)} className="flex-1 bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700">Cancel</Button>
                <Button type="submit" disabled={recordSubmitting} className="flex-1 bg-green-600 hover:bg-green-700 text-white">
                  {recordSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Record Payment'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {createModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={closePlanModal} aria-hidden />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-700">
            <div className="flex items-center justify-between p-4 border-b border-zinc-700">
              <h3 className="text-lg font-semibold text-white">{editingPlan ? 'Edit Plan' : 'Create Plan'}</h3>
              <button type="button" onClick={closePlanModal} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreatePlan} className="p-4 space-y-4">
              {planError && <div className="text-sm text-red-400 bg-red-500/10 p-3 rounded-lg">{planError}</div>}
              <div>
                <Label className="text-zinc-300">Name</Label>
                <Input value={planName} onChange={(e) => setPlanName(e.target.value)} placeholder="e.g., Fall Dues" required className="mt-1 bg-zinc-800 border-zinc-700" />
              </div>
              <div>
                <Label className="text-zinc-300 block mb-2">Plan type</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPlanMode('installment')}
                    className={cn(
                      'rounded-lg border p-3 text-left',
                      planMode === 'installment' ? 'border-white bg-zinc-800 text-white' : 'border-zinc-700 bg-zinc-900 text-zinc-300',
                    )}
                  >
                    <p className="text-sm font-medium">Installments</p>
                    <p className="text-xs text-zinc-400">Set total + months</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlanMode('full')}
                    className={cn(
                      'rounded-lg border p-3 text-left',
                      planMode === 'full' ? 'border-white bg-zinc-800 text-white' : 'border-zinc-700 bg-zinc-900 text-zinc-300',
                    )}
                  >
                    <p className="text-sm font-medium">Full payment</p>
                    <p className="text-xs text-zinc-400">Single amount due</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlanMode('custom')}
                    className={cn(
                      'rounded-lg border p-3 text-left',
                      planMode === 'custom' ? 'border-white bg-zinc-800 text-white' : 'border-zinc-700 bg-zinc-900 text-zinc-300',
                    )}
                  >
                    <p className="text-sm font-medium">Custom payments</p>
                    <p className="text-xs text-zinc-400">Minimum + optional total</p>
                  </button>
                </div>
              </div>
              {planMode === 'installment' ? (
                <>
                  <div>
                    <Label className="text-zinc-300">Total amount ($)</Label>
                    <Input type="number" step="0.01" min="0" value={planTotalAmount} onChange={(e) => setPlanTotalAmount(e.target.value)} placeholder="e.g. 1000" className="mt-1 bg-zinc-800 border-zinc-700" required />
                  </div>
                  <div>
                    <Label className="text-zinc-300">Installment months</Label>
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={planInstallmentMonths}
                      onChange={(e) => setPlanInstallmentMonths(e.target.value)}
                      placeholder="e.g. 10 or 12 (optional if due date is set)"
                      className="mt-1 bg-zinc-800 border-zinc-700"
                    />
                  </div>
                  {previewInstallmentMonths && planTotalAmount.trim() ? (
                    <div className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-300">
                      Monthly installment: <span className="text-white font-medium">${(Number(planTotalAmount) / previewInstallmentMonths).toFixed(2)}</span>
                      {!planInstallmentMonths.trim() && autoPlanMonths ? (
                        <span className="ml-2 text-zinc-400">
                          ({autoPlanMonths} months auto-calculated from due date)
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  {!planInstallmentMonths.trim() ? (
                    <p className="text-xs text-zinc-500">
                      If left blank, months auto-calculate from your due date.
                    </p>
                  ) : null}
                </>
              ) : null}
              {planMode === 'full' ? (
                <div>
                  <Label className="text-zinc-300">Amount due ($)</Label>
                  <Input type="number" step="0.01" min="0" value={planAmount} onChange={(e) => setPlanAmount(e.target.value)} placeholder="e.g. 500" required className="mt-1 bg-zinc-800 border-zinc-700" />
                </div>
              ) : null}
              {planMode === 'custom' ? (
                <>
                  <div>
                    <Label className="text-zinc-300">Minimum payment ($)</Label>
                    <Input type="number" step="0.01" min="0" value={planAmount} onChange={(e) => setPlanAmount(e.target.value)} placeholder="e.g. 100" required className="mt-1 bg-zinc-800 border-zinc-700" />
                  </div>
                  <div>
                    <Label className="text-zinc-300">Total amount ($) - optional</Label>
                    <Input type="number" step="0.01" min="0" value={planTotalAmount} onChange={(e) => setPlanTotalAmount(e.target.value)} placeholder="e.g. 1200" className="mt-1 bg-zinc-800 border-zinc-700" />
                  </div>
                </>
              ) : null}
              <div>
                <Label className="text-zinc-300">Due Date (optional)</Label>
                <Input type="date" value={planDate} onChange={(e) => setPlanDate(e.target.value)} className="mt-1 bg-zinc-800 border-zinc-700" />
              </div>
              <div className="flex gap-2 pt-4">
                <Button type="button" variant="outline" onClick={closePlanModal} className="flex-1 bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700">Cancel</Button>
                <Button type="submit" disabled={planLoading} className="flex-1 bg-white text-black hover:bg-zinc-200">
                  {planLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : editingPlan ? 'Save' : 'Create Plan'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

interface OrgDocRow {
  id: string
  title: string
  content: string
  file_type?: string
  folder_name?: string | null
  is_pinned?: boolean
  visibility?: string
  viewer_user_ids?: string[]
}

interface TemplateRow {
  id: string
  title: string
  description?: string
  submission_count?: number
}

interface GoogleFormRow {
  id: string
  title: string
  form_url: string
}

function SettingsDocuments({ orgId }: { orgId: string }) {
  const [orgDocs, setOrgDocs] = useState<OrgDocRow[]>([])
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [, setGoogleForms] = useState<GoogleFormRow[]>([])
  const [loading, setLoading] = useState(true)
  const [createDocModal, setCreateDocModal] = useState(false)
  const [createTemplateModal, setCreateTemplateModal] = useState(false)
  const [addGoogleFormModal, setAddGoogleFormModal] = useState(false)
  const [googleFormTitle, setGoogleFormTitle] = useState('')
  const [googleFormUrl, setGoogleFormUrl] = useState('')
  const [googleFormSaving, setGoogleFormSaving] = useState(false)
  const [googleFormError, setGoogleFormError] = useState('')
  const [editingTemplate, setEditingTemplate] = useState<TemplateRow | null>(null)
  const [viewingDoc, setViewingDoc] = useState<OrgDocRow | null>(null)
  const [accessDoc, setAccessDoc] = useState<OrgDocRow | null>(null)
  const [submissionsTemplate, setSubmissionsTemplate] = useState<{ id: string; title: string } | null>(null)
  const [submissionsList, setSubmissionsList] = useState<{ id: string; title: string; uploaded_by_name: string; uploaded_by_email: string; uploaded_at?: string }[]>([])
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [pinLoadingId, setPinLoadingId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    try {
      const [docsRes, templatesRes, formsRes] = await Promise.all([
        api.get(`/documents/${orgId}`),
        api.get(`/documents/${orgId}/templates`),
        api.get(`/documents/${orgId}/google-forms`),
      ])
      setOrgDocs(docsRes.data || [])
      setTemplates(templatesRes.data || [])
      setGoogleForms(formsRes.data || [])
    } catch {
      setOrgDocs([])
      setTemplates([])
      setGoogleForms([])
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (!submissionsTemplate || !orgId) return
    api.get(`/documents/${orgId}/templates/${submissionsTemplate.id}/submissions`).then((r) => setSubmissionsList(r.data || [])).catch(() => setSubmissionsList([]))
  }, [orgId, submissionsTemplate])

  const pinned = orgDocs.filter((d) => d.is_pinned)
  const unpinned = orgDocs.filter((d) => !d.is_pinned)
  const folders: Record<string, OrgDocRow[]> = {}
  const noFolder: OrgDocRow[] = []
  unpinned.forEach((doc) => {
    const folder = doc.folder_name?.trim()
    if (folder) {
      if (!folders[folder]) folders[folder] = []
      folders[folder].push(doc)
    } else {
      noFolder.push(doc)
    }
  })
  const folderNames = Object.keys(folders).sort()

  const handlePin = async (doc: OrgDocRow) => {
    setPinLoadingId(doc.id)
    try {
      await api.patch(`/documents/${orgId}/${doc.id}`, { is_pinned: !doc.is_pinned })
      fetchData()
    } finally {
      setPinLoadingId(null)
    }
  }

  const handleDeleteDoc = async (docId: string) => {
    setDeletingId(docId)
    try {
      await api.delete(`/documents/${orgId}/${docId}`)
      fetchData()
      setViewingDoc(null)
    } finally {
      setDeletingId(null)
    }
  }

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Remove this required document? Members will no longer see it as required.')) return
    setDeletingId(templateId)
    try {
      await api.delete(`/documents/${orgId}/templates/${templateId}`)
      fetchData()
      setSubmissionsTemplate(null)
    } finally {
      setDeletingId(null)
    }
  }

  const handleSaveAccess = async (visibility: string) => {
    if (!accessDoc) return
    try {
      await api.put(`/documents/${orgId}/${accessDoc.id}/viewers`, { visibility, viewer_user_ids: visibility === 'custom' ? (accessDoc.viewer_user_ids || []) : [] })
      setAccessDoc(null)
      fetchData()
    } catch (e) {
      console.error(e)
    }
  }

  const handleAddGoogleForm = async (e: React.FormEvent) => {
    e.preventDefault()
    setGoogleFormError('')
    const title = googleFormTitle.trim()
    const form_url = googleFormUrl.trim()
    if (!title || !form_url) {
      setGoogleFormError('Title and form URL are required.')
      return
    }
    setGoogleFormSaving(true)
    try {
      await api.post(`/documents/${orgId}/google-forms`, { title, form_url })
      setAddGoogleFormModal(false)
      setGoogleFormTitle('')
      setGoogleFormUrl('')
      fetchData()
    } catch (err: unknown) {
      setGoogleFormError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed to add form.')
    } finally {
      setGoogleFormSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded-xl bg-zinc-900 border border-zinc-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText size={20} className="text-zinc-400" />
            <h3 className="font-semibold text-white">Organization Documents</h3>
          </div>
          <Button onClick={() => setCreateDocModal(true)} className="bg-white text-black hover:bg-zinc-200">
            <Plus size={18} />
            <span className="ml-2">Upload Document</span>
          </Button>
        </div>
        {orgDocs.length > 0 && (
          <p className="text-sm text-zinc-500 mb-4">{orgDocs.length} total • {pinned.length} pinned</p>
        )}
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-zinc-500" /></div>
        ) : orgDocs.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="h-12 w-12 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-500">No organization documents yet.</p>
            <p className="text-sm text-zinc-500 mt-1">Upload bylaws, policies, or other official documents.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {pinned.length > 0 && (
              <div>
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Pinned</p>
                <ul className="space-y-2">
                  {pinned.map((doc) => (
                    <li key={doc.id} className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50 border border-zinc-700">
                      <span className="font-medium text-white flex items-center gap-2">
                        <FileText size={18} className="text-zinc-500" />
                        {doc.title}
                        {doc.visibility === 'custom' && <span className="text-xs text-amber-500 flex items-center gap-1"><Lock size={12} /> Restricted</span>}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setViewingDoc(doc)} className="text-zinc-400 hover:text-white"><ExternalLink size={16} /></Button>
                        <Button variant="ghost" size="sm" onClick={() => handlePin(doc)} disabled={!!pinLoadingId} className="text-zinc-400 hover:text-white">{pinLoadingId === doc.id ? <Loader2 size={16} className="animate-spin" /> : <PinOff size={16} />}</Button>
                        <Button variant="ghost" size="sm" onClick={() => setAccessDoc(doc)} className="text-zinc-400 hover:text-white"><Users size={16} /></Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteDoc(doc.id)} disabled={!!deletingId} className="text-red-400 hover:text-red-300"><Trash2 size={16} /></Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {folderNames.map((folder) => (
              <div key={folder}>
                <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">{folder}</p>
                <ul className="space-y-2">
                  {(folders[folder] || []).map((doc) => (
                    <li key={doc.id} className="flex items-center justify-between p-3 rounded-lg bg-zinc-800 border border-zinc-700">
                      <span className="font-medium text-white flex items-center gap-2">
                        <FileText size={18} className="text-zinc-500" />
                        {doc.title}
                        {doc.visibility === 'custom' && <span className="text-xs text-amber-500 flex items-center gap-1"><Lock size={12} /> Restricted</span>}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setViewingDoc(doc)} className="text-zinc-400 hover:text-white"><ExternalLink size={16} /></Button>
                        <Button variant="ghost" size="sm" onClick={() => handlePin(doc)} disabled={!!pinLoadingId} className="text-zinc-400 hover:text-white">{pinLoadingId === doc.id ? <Loader2 size={16} className="animate-spin" /> : <Pin size={16} />}</Button>
                        <Button variant="ghost" size="sm" onClick={() => setAccessDoc(doc)} className="text-zinc-400 hover:text-white"><Users size={16} /></Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteDoc(doc.id)} disabled={!!deletingId} className="text-red-400 hover:text-red-300"><Trash2 size={16} /></Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {noFolder.length > 0 && (
              <div>
                {pinned.length > 0 || folderNames.length > 0 ? <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Other</p> : null}
                <ul className="space-y-2">
                  {noFolder.map((doc) => (
                    <li key={doc.id} className="flex items-center justify-between p-3 rounded-lg bg-zinc-800 border border-zinc-700">
                      <span className="font-medium text-white flex items-center gap-2">
                        <FileText size={18} className="text-zinc-500" />
                        {doc.title}
                        {doc.visibility === 'custom' && <span className="text-xs text-amber-500 flex items-center gap-1"><Lock size={12} /> Restricted</span>}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setViewingDoc(doc)} className="text-zinc-400 hover:text-white"><ExternalLink size={16} /></Button>
                        <Button variant="ghost" size="sm" onClick={() => handlePin(doc)} disabled={!!pinLoadingId} className="text-zinc-400 hover:text-white">{pinLoadingId === doc.id ? <Loader2 size={16} className="animate-spin" /> : <Pin size={16} />}</Button>
                        <Button variant="ghost" size="sm" onClick={() => setAccessDoc(doc)} className="text-zinc-400 hover:text-white"><Users size={16} /></Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteDoc(doc.id)} disabled={!!deletingId} className="text-red-400 hover:text-red-300"><Trash2 size={16} /></Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="rounded-xl bg-zinc-900 border border-zinc-800 p-6">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <h3 className="font-semibold text-white">Required Documents</h3>
          <div className="flex flex-col gap-2">
            <Button onClick={() => { setGoogleFormError(''); setGoogleFormTitle(''); setGoogleFormUrl(''); setAddGoogleFormModal(true); }} className="bg-white text-black hover:bg-zinc-200">
              <Plus size={18} />
              <span className="ml-2">Add Google Form Link</span>
            </Button>
            <Button onClick={() => { setEditingTemplate(null); setCreateTemplateModal(true); }} className="bg-white text-black hover:bg-zinc-200">
              <Plus size={18} />
              <span className="ml-2">Add Required Document</span>
            </Button>
          </div>
        </div>
        <p className="text-sm text-zinc-500 mb-4">Define documents that members need to upload or fill out.</p>
        {loading ? null : templates.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="h-12 w-12 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-500">No required documents defined.</p>
            <p className="text-sm text-zinc-500 mt-1">Create templates for insurance, registration, etc.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {templates.map((t) => (
              <li key={t.id} className="flex items-center justify-between p-3 rounded-lg bg-zinc-800 border border-zinc-700 flex-wrap gap-2">
                <div>
                  <span className="font-medium text-white">{t.title}</span>
                  <p className="text-sm text-zinc-500">{t.description || 'Required for members'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => setSubmissionsTemplate({ id: t.id, title: t.title })} className={cn((t.submission_count ?? 0) > 0 ? 'bg-green-600/20 border-green-600/50 text-green-400' : 'bg-zinc-700 border-zinc-600 text-zinc-400')}>
                    <Eye size={14} />
                    <span className="ml-1">{t.submission_count ?? 0} Submitted</span>
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setEditingTemplate(t); setCreateTemplateModal(true); }} className="bg-zinc-700 border-zinc-600 text-white">
                    <Edit2 size={14} />
                    <span className="ml-1">Manage</span>
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDeleteTemplate(t.id)} disabled={!!deletingId} className="text-red-400 hover:text-red-300"><Trash2 size={16} /></Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {viewingDoc && (
        <DocumentViewerModal doc={viewingDoc} onClose={() => setViewingDoc(null)} />
      )}
      {createDocModal && (
        <CreateOrgDocumentModal
          orgId={orgId}
          onClose={() => setCreateDocModal(false)}
          onCreated={() => { setCreateDocModal(false); fetchData(); }}
        />
      )}
      {createTemplateModal && (
        <CreateTemplateModal
          orgId={orgId}
          template={editingTemplate}
          onClose={() => { setCreateTemplateModal(false); setEditingTemplate(null); }}
          onCreated={() => { setCreateTemplateModal(false); setEditingTemplate(null); fetchData(); }}
        />
      )}

      {addGoogleFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setAddGoogleFormModal(false)} aria-hidden />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-2">Add Google Form Link</h3>
            <p className="text-sm text-zinc-500 mb-4">Paste your Google Form link. It will appear on the Documents page for members to open.</p>
            <form onSubmit={handleAddGoogleForm} className="space-y-4">
              {googleFormError && <div className="text-sm text-red-400 bg-red-500/10 p-3 rounded-lg">{googleFormError}</div>}
              <div>
                <Label className="text-zinc-300">Title</Label>
                <Input
                  value={googleFormTitle}
                  onChange={(e) => setGoogleFormTitle(e.target.value)}
                  placeholder="e.g. Event Feedback"
                  className="mt-1 bg-zinc-800 border-zinc-700 text-white"
                />
              </div>
              <div>
                <Label className="text-zinc-300">Google Form URL</Label>
                <Input
                  value={googleFormUrl}
                  onChange={(e) => setGoogleFormUrl(e.target.value)}
                  placeholder="https://docs.google.com/forms/d/..."
                  type="url"
                  className="mt-1 bg-zinc-800 border-zinc-700 text-white"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="button" variant="outline" className="flex-1 bg-zinc-800 border-zinc-700 text-white" onClick={() => setAddGoogleFormModal(false)}>Cancel</Button>
                <Button type="submit" className="flex-1 bg-white text-black hover:bg-zinc-200" disabled={googleFormSaving}>
                  {googleFormSaving ? <Loader2 size={18} className="animate-spin" /> : 'Add Form'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {accessDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setAccessDoc(null)} aria-hidden />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-2">Document access</h3>
            <p className="text-sm text-zinc-400 mb-4">Who can view &quot;{accessDoc.title}&quot;?</p>
            <div className="flex gap-2">
              <Button onClick={() => handleSaveAccess('club')} className="flex-1 bg-zinc-800 text-white hover:bg-zinc-700">All members</Button>
              <Button onClick={() => handleSaveAccess('custom')} className="flex-1 bg-zinc-800 text-white hover:bg-zinc-700">Selected only</Button>
            </div>
            <Button variant="ghost" className="mt-4 w-full text-zinc-400" onClick={() => setAccessDoc(null)}>Cancel</Button>
          </div>
        </div>
      )}

      {submissionsTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSubmissionsTemplate(null)} aria-hidden />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-700 p-6 max-h-[90vh] overflow-hidden flex flex-col">
            <h3 className="text-lg font-semibold text-white mb-2">Submissions: {submissionsTemplate.title}</h3>
            <div className="flex-1 overflow-y-auto min-h-0">
              {submissionsList.length === 0 ? (
                <p className="text-zinc-500 text-sm">No submissions yet.</p>
              ) : (
                <ul className="space-y-2">
                  {submissionsList.map((s) => (
                    <li key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-zinc-800 border border-zinc-700">
                      <div>
                        <p className="font-medium text-white text-sm">{s.uploaded_by_name}</p>
                        <p className="text-xs text-zinc-500">{s.uploaded_by_email}</p>
                        {s.uploaded_at && <p className="text-xs text-zinc-500">{new Date(s.uploaded_at).toLocaleDateString()}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Button variant="outline" className="mt-4 bg-zinc-800 border-zinc-700 text-white" onClick={() => setSubmissionsTemplate(null)}>Close</Button>
          </div>
        </div>
      )}
    </div>
  )
}

function SettingsDirectory({ orgId }: { orgId: string }) {
  const [org, setOrg] = useState<{ type?: string; sport_type?: string; cultural_identity?: string; icon_color?: string } | null>(null)
  const [type, setType] = useState('')
  const [sportType, setSportType] = useState('')
  const [culturalIdentity, setCulturalIdentity] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (!orgId) return
    api.get(`/organizations/${orgId}`).then((r) => {
      setOrg(r.data)
      setType(r.data.type || '')
      setSportType(r.data.sport_type || '')
      setCulturalIdentity(r.data.cultural_identity || '')
    }).catch(() => {})
  }, [orgId])

  useEffect(() => {
    if (type !== 'Sports Club') setSportType('')
  }, [type])

  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => setMessage(null), 3000)
    return () => clearTimeout(t)
  }, [message])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      await api.put(`/organizations/${orgId}`, {
        type: type || undefined,
        sport_type: type === 'Sports Club' ? sportType || undefined : undefined,
        cultural_identity: culturalIdentity || undefined,
        organization_category: type ? getCategoryForType(type) ?? undefined : undefined,
      })
      setMessage({ type: 'success', text: 'Directory settings saved.' })
    } catch {
      setMessage({ type: 'error', text: 'Failed to save' })
    } finally {
      setSaving(false)
    }
  }

  const saveDisabled = saving || (type === 'Sports Club' && !sportType.trim())
  const iconColor = org?.icon_color || '#71717a'

  if (!org) return <div className="text-zinc-400">Loading...</div>

  return (
    <div className="space-y-8">
      {message && (
        <div className={`p-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
          {message.text}
        </div>
      )}
      <form onSubmit={handleSave} className="rounded-xl bg-zinc-900 border border-zinc-800 p-6 space-y-6 max-w-3xl">
        <div className="flex items-center gap-2 mb-2">
          <MapPin size={24} style={{ color: iconColor }} className="shrink-0" />
          <h3 className="font-semibold text-white">Event Directory Identifiers</h3>
        </div>
        <p className="text-sm text-zinc-500">
          Select up to 2 identifiers to help other members find your public events in the directory. These do not make your events public and can be changed at any time.
        </p>
        <div>
          <Label className="text-zinc-300">Organization Type (Required)</Label>
          <div className="mt-2">
            <GroupedOrgTypeSelect value={type} onChange={setType} />
          </div>
        </div>
        {type === 'Sports Club' && (
          <div className="border-l-2 border-zinc-700 pl-4">
            <Label className="text-zinc-300">Specify your sport</Label>
            <div className="relative mt-2">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none z-10">
                <Search size={16} />
              </span>
              <div className="pl-10">
                <SearchableSelect
                  options={SPORTS_LIST}
                  value={sportType}
                  onChange={setSportType}
                  placeholder="Search for a sport..."
                  maxVisible={8}
                />
              </div>
            </div>
          </div>
        )}
        <div>
          <Label className="text-zinc-300">Cultural / Affinity Identity (Required)</Label>
          <select
            className="flex h-10 w-full max-w-md rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white mt-2"
            value={culturalIdentity}
            onChange={(e) => setCulturalIdentity(e.target.value)}
          >
            <option value="">Select identity</option>
            {CULTURAL_IDENTITIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <p className="text-xs text-zinc-500 mt-1">This is self-identified.</p>
        </div>
        <Button type="submit" disabled={saveDisabled} className="px-6 py-2.5 bg-white text-black hover:bg-zinc-200">
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </form>
    </div>
  )
}

interface EventOption {
  id: string
  title: string
  start_time?: string
  is_paid?: boolean
  price?: number
}

interface AttendeeOption {
  ticket_id: string
  short_code?: string
  user_name: string
  nickname?: string
  amount: number
  status: string
  checked_in: boolean
  checked_in_at?: string
}

const QR_SCANNER_DIV_ID = 'event-options-qr-scanner'
type QrScannerInstance = { stop: () => Promise<void> }

function SettingsEventOptions({ orgId }: { orgId: string }) {
  const [events, setEvents] = useState<EventOption[]>([])
  const [eventsLoading, setEventsLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState<EventOption | null>(null)
  const [attendees, setAttendees] = useState<AttendeeOption[]>([])
  const [attendeesLoading, setAttendeesLoading] = useState(false)
  const [ticketIdInput, setTicketIdInput] = useState('')
  const [checkingIn, setCheckingIn] = useState(false)
  const [checkInResult, setCheckInResult] = useState<{ success: boolean; message: string; attendee_name?: string } | null>(null)
  const [refundModal, setRefundModal] = useState<AttendeeOption | null>(null)
  const [refundReason, setRefundReason] = useState('')
  const [processingRefund, setProcessingRefund] = useState(false)
  const [scanModalOpen, setScanModalOpen] = useState(false)
  const qrScannerRef = useRef<QrScannerInstance | null>(null)

  const paidEvents = events.filter((e) => e.is_paid && (e.price ?? 0) > 0).sort((a, b) => {
    const da = a.start_time ? new Date(a.start_time).getTime() : 0
    const db = b.start_time ? new Date(b.start_time).getTime() : 0
    return da - db
  })

  useEffect(() => {
    if (!orgId) return
    setEventsLoading(true)
    api.get(`/events/${orgId}`).then((r) => setEvents(r.data || [])).catch(() => setEvents([])).finally(() => setEventsLoading(false))
  }, [orgId])

  const fetchAttendees = useCallback(async () => {
    if (!orgId || !selectedEvent?.id) return
    setAttendeesLoading(true)
    try {
      const { data } = await api.get(`/payments/${orgId}/events/${selectedEvent.id}/attendees`)
      setAttendees(data || [])
    } catch {
      setAttendees([])
    } finally {
      setAttendeesLoading(false)
    }
  }, [orgId, selectedEvent?.id])

  useEffect(() => {
    fetchAttendees()
  }, [fetchAttendees])

  const handleCheckIn = async (ticketId?: string) => {
    const tid = (ticketId ?? ticketIdInput).trim()
    if (!tid || !selectedEvent) return
    setCheckingIn(true)
    setCheckInResult(null)
    try {
      const { data } = await api.post(`/payments/${orgId}/tickets/check-in`, { ticket_id: tid, event_id: selectedEvent.id })
      setCheckInResult({ success: true, message: `Successfully checked in: ${data.attendee_name || 'Attendee'}` })
      setTicketIdInput('')
      fetchAttendees()
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setCheckInResult({ success: false, message: typeof detail === 'string' ? detail : 'Check-in failed' })
    } finally {
      setCheckingIn(false)
    }
  }

  useEffect(() => {
    if (!scanModalOpen || !selectedEvent) return
    let cancelled = false
    let scanner: QrScannerInstance | null = null
    const startScanner = async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode')
        if (cancelled) return
        const nextScanner = new Html5Qrcode(QR_SCANNER_DIV_ID) as QrScannerInstance
        scanner = nextScanner
        qrScannerRef.current = nextScanner
        const onSuccess = (decodedText: string) => {
          const tid = decodedText.trim()
          if (!tid) return
          handleCheckIn(tid)
          nextScanner.stop().then(() => {
            qrScannerRef.current = null
            setScanModalOpen(false)
          }).catch(() => {
            qrScannerRef.current = null
            setScanModalOpen(false)
          })
        }
        await (nextScanner as any).start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          onSuccess,
          () => {}
        )
      } catch {
        if (!cancelled) setScanModalOpen(false)
        qrScannerRef.current = null
      }
    }
    startScanner()
    return () => {
      cancelled = true
      ;(scanner || qrScannerRef.current)?.stop()
        .then(() => { qrScannerRef.current = null })
        .catch(() => { qrScannerRef.current = null })
    }
  }, [scanModalOpen, selectedEvent?.id])

  const handleRefund = async () => {
    if (!refundModal) return
    setProcessingRefund(true)
    try {
      await api.post(`/payments/${orgId}/tickets/${refundModal.ticket_id}/refund`, { reason: refundReason || undefined })
      setRefundModal(null)
      setRefundReason('')
      fetchAttendees()
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setCheckInResult({ success: false, message: typeof detail === 'string' ? detail : 'Refund failed' })
    } finally {
      setProcessingRefund(false)
    }
  }

  const checkedInCount = attendees.filter((a) => a.checked_in && a.status !== 'refunded').length
  const refundedCount = attendees.filter((a) => a.status === 'refunded').length
  const displayName = (a: AttendeeOption) => getDisplayName(a.user_name, a.nickname)

  return (
    <div className="space-y-8">
      <section className="rounded-xl bg-zinc-900 border border-zinc-800 p-6">
        <h3 className="font-semibold text-white mb-4">Select event</h3>
        {eventsLoading ? (
          <div className="flex justify-center py-6 text-zinc-400"><Loader2 className="h-8 w-8 animate-spin" /></div>
        ) : paidEvents.length === 0 ? (
          <div className="rounded-lg bg-zinc-800 border border-zinc-700 p-8 text-center">
            <Calendar className="h-12 w-12 text-zinc-500 mx-auto mb-3" />
            <p className="text-zinc-400">No paid events</p>
            <p className="text-sm text-zinc-500 mt-1">Create a paid event to manage check-ins and refunds.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {paidEvents.map((ev) => (
              <button
                key={ev.id}
                type="button"
                onClick={() => setSelectedEvent(ev)}
                className={cn(
                  'w-full flex items-center justify-between p-4 rounded-lg border text-left transition-colors',
                  selectedEvent?.id === ev.id ? 'bg-zinc-700 border-zinc-600' : 'bg-zinc-800 border-zinc-700 hover:border-zinc-600'
                )}
              >
                <span className="font-medium text-white">{ev.title}</span>
                <span className="text-zinc-400 text-sm">
                  {ev.start_time ? new Date(ev.start_time).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}
                  {(ev.price ?? 0) > 0 && ` • $${ev.price}`}
                </span>
                {selectedEvent?.id === ev.id && <Check className="h-5 w-5 text-green-400 shrink-0" />}
              </button>
            ))}
          </div>
        )}
      </section>

      {selectedEvent && (
        <>
          <section className="rounded-xl bg-zinc-900 border border-zinc-800 p-6">
            <h3 className="font-semibold text-white mb-4">Check-in attendee</h3>
            <div className="flex flex-wrap gap-2">
              <Input
                placeholder="Enter code (e.g. A3K9X2) or scan QR"
                value={ticketIdInput}
                onChange={(e) => setTicketIdInput(e.target.value)}
                className="flex-1 min-w-[200px] bg-zinc-800 border-zinc-700"
              />
              <Button onClick={() => handleCheckIn()} disabled={checkingIn || !ticketIdInput.trim()} className="bg-white text-black hover:bg-zinc-200">
                {checkingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                <span className="ml-2">Check in</span>
              </Button>
              <Button variant="outline" className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white" disabled={checkingIn} onClick={() => setScanModalOpen(true)}>
                <QrCode size={18} />
                <span className="ml-2">Scan QR</span>
              </Button>
            </div>
            {checkInResult && (
              <div className={cn('mt-3 p-3 rounded-lg flex items-center gap-2 text-sm', checkInResult.success ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400')}>
                {checkInResult.success ? <CheckCircle className="h-5 w-5 shrink-0" /> : <XCircle className="h-5 w-5 shrink-0" />}
                {checkInResult.message}
              </div>
            )}
          </section>

          {scanModalOpen && (
            <div className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 bg-black/80">
              <div className="relative w-full max-w-sm rounded-2xl bg-zinc-900 border border-zinc-700 overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-zinc-700">
                  <h3 className="text-lg font-semibold text-white">Scan ticket QR code</h3>
                  <button
                    type="button"
                    onClick={() => setScanModalOpen(false)}
                    className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400"
                    aria-label="Close"
                  >
                    <X size={20} />
                  </button>
                </div>
                <div id={QR_SCANNER_DIV_ID} className="w-full min-h-[240px] bg-black" />
                <p className="p-3 text-center text-sm text-zinc-500">Point your camera at the ticket QR code</p>
              </div>
            </div>
          )}

          <section className="rounded-xl bg-zinc-900 border border-zinc-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-white">Attendees</h3>
              <div className="flex items-center gap-3">
                <span className="text-sm text-zinc-400">
                  {checkedInCount}/{attendees.filter((a) => a.status !== 'refunded').length} checked in
                  {refundedCount > 0 && `  •  ${refundedCount} refunded`}
                </span>
                <Button variant="ghost" size="sm" onClick={fetchAttendees} disabled={attendeesLoading} className="text-zinc-400 hover:text-white">
                  <RefreshCw className={cn('h-4 w-4', attendeesLoading && 'animate-spin')} />
                </Button>
              </div>
            </div>
            {attendeesLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-zinc-500" /></div>
            ) : attendees.length === 0 ? (
              <div className="rounded-lg bg-zinc-800 border border-zinc-700 p-6 text-center text-zinc-500 text-sm">
                No tickets for this event yet.
              </div>
            ) : (
              <ul className="space-y-2">
                {attendees.map((a) => {
                  const isRefunded = a.status === 'refunded'
                  return (
                    <li
                      key={a.ticket_id}
                      className={cn(
                        'flex items-center justify-between p-3 rounded-lg border',
                        isRefunded ? 'bg-zinc-800/50 border-zinc-700 opacity-70' : 'bg-zinc-800 border-zinc-700'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-zinc-700 flex items-center justify-center text-white font-medium shrink-0">
                          {displayName(a).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className={cn('font-medium', isRefunded ? 'line-through text-zinc-500' : 'text-white')}>
                            {displayName(a)}
                          </p>
                          <p className="text-xs text-zinc-500 font-mono">{a.short_code ?? `${a.ticket_id.slice(0, 8)}…`}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isRefunded ? (
                          <span className="text-xs px-2 py-1 rounded bg-zinc-600 text-zinc-400">Refunded</span>
                        ) : (
                          <>
                            {a.checked_in ? (
                              <span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-400 flex items-center gap-1">
                                <CheckCircle className="h-3 w-3" /> Checked in
                              </span>
                            ) : (
                              <Button size="sm" variant="outline" className="bg-zinc-700 border-zinc-600 text-white text-xs" onClick={() => handleCheckIn(a.ticket_id)} disabled={checkingIn}>
                                Check in
                              </Button>
                            )}
                            <Button size="sm" variant="outline" className="border-red-500/50 text-red-400 hover:bg-red-500/10 text-xs" onClick={() => { setRefundModal(a); setRefundReason(''); setCheckInResult(null); }}>
                              Refund
                            </Button>
                          </>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </>
      )}

      {refundModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => !processingRefund && setRefundModal(null)} aria-hidden />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-2">Confirm refund</h3>
            <p className="text-zinc-400 text-sm mb-4">Refund ticket for {displayName(refundModal)}?</p>
            <p className="text-xs text-zinc-500 mb-1">{refundModal.short_code ? `Code: ${refundModal.short_code}` : `Ticket: ${refundModal.ticket_id.slice(0, 12)}…`}</p>
            <p className="text-xs text-zinc-500 mb-4">Amount: ${refundModal.amount.toFixed(2)}</p>
            <div className="mb-4">
              <Label className="text-zinc-300 text-sm">Reason (optional)</Label>
              <Input value={refundReason} onChange={(e) => setRefundReason(e.target.value)} placeholder="e.g. Event cancelled" className="mt-1 bg-zinc-800 border-zinc-700" maxLength={500} />
            </div>
            <p className="text-xs text-zinc-500 mb-4">This will mark the ticket as refunded. If Stripe is configured, a refund will be processed.</p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setRefundModal(null)} disabled={processingRefund} className="flex-1 bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700">
                Cancel
              </Button>
              <Button onClick={handleRefund} disabled={processingRefund} className="flex-1 bg-red-600 hover:bg-red-700 text-white">
                {processingRefund ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Process refund'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

interface AnalyticsOverview {
  period: string
  period_label: string
  members: {
    total: number
    by_role: { owner: number; admin: number; member: number; restricted: number }
    new_in_period: number
    growth_trend: { month: string; count: number }[]
  }
  events: {
    total: number
    upcoming: number
    past_in_period: number
    avg_attendance: number
    total_attendance: number
    top_events: { title: string; date: string; attendance: number }[]
  }
  financial: {
    total_revenue: number
    dues_revenue: number
    dues_revenue_period: number
    ticket_revenue: number
    ticket_revenue_period: number
    outstanding_dues_count: number
    revenue_trend: { month: string; amount: number }[]
  }
  engagement: {
    messages_in_period: number
    messages_this_week: number
    active_channels: number
    total_polls: number
    total_poll_votes: number
  }
}

function SimpleBarChart({ data, color, valueKey }: { data: { month: string; count?: number; amount?: number }[]; color: string; valueKey: 'count' | 'amount' }) {
  const values = data.map((d) => (valueKey === 'count' ? (d.count ?? 0) : (d.amount ?? 0)))
  const max = Math.max(...values, 1)
  return (
    <div className="space-y-2">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-12 text-xs text-zinc-500 shrink-0">{d.month}</span>
          <div className="flex-1 h-6 bg-zinc-800 rounded overflow-hidden">
            <div
              className="h-full rounded"
              style={{ width: `${(100 * (valueKey === 'count' ? (d.count ?? 0) : (d.amount ?? 0)) / max)}%`, backgroundColor: color }}
            />
          </div>
          <span className="text-xs text-zinc-400 w-16 text-right">
            {valueKey === 'count' ? (d.count ?? 0) : `$${(d.amount ?? 0).toFixed(0)}`}
          </span>
        </div>
      ))}
    </div>
  )
}

function SettingsAnalytics({ orgId }: { orgId: string }) {
  const [period, setPeriod] = useState('30d')
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<AnalyticsOverview | null>(null)
  const [exporting, setExporting] = useState(false)

  const fetchAnalytics = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    try {
      const { data: res } = await api.get(`/analytics/${orgId}/overview`, { params: { period } })
      setData(res)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [orgId, period])

  useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

  const exportCsv = () => {
    if (!data) return
    setExporting(true)
    const rows: string[] = []
    rows.push('Section,Key,Value')
    rows.push(`Period,Label,${data.period_label}`)
    rows.push('MEMBERS,,')
    rows.push('Members,Total,' + String(data.members.total))
    rows.push('Members,New in period,' + String(data.members.new_in_period))
    Object.entries(data.members.by_role).forEach(([k, v]) => rows.push(`Members,Role ${k},${v}`))
    rows.push('EVENTS,,')
    rows.push('Events,Upcoming,' + String(data.events.upcoming))
    rows.push('Events,Avg attendance,' + String(data.events.avg_attendance))
    rows.push('REVENUE,,')
    rows.push('Revenue,Total,' + String(data.financial.total_revenue))
    rows.push('Revenue,Dues,' + String(data.financial.dues_revenue))
    rows.push('Revenue,Tickets,' + String(data.financial.ticket_revenue))
    rows.push('Revenue,Outstanding dues count,' + String(data.financial.outstanding_dues_count))
    rows.push('ENGAGEMENT,,')
    rows.push('Engagement,Messages in period,' + String(data.engagement.messages_in_period))
    rows.push('Engagement,Active channels,' + String(data.engagement.active_channels))
    rows.push('Engagement,Total polls,' + String(data.engagement.total_polls))
    rows.push('Engagement,Poll votes,' + String(data.engagement.total_poll_votes))
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `analytics-${period}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
    setExporting(false)
  }

  const periodOptions = [
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' },
    { value: 'all', label: 'All time' },
  ]

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
        <span className="ml-2 text-zinc-400">Loading analytics...</span>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-8 text-center">
        <BarChart3 className="h-12 w-12 text-zinc-500 mx-auto mb-3" />
        <p className="text-zinc-400">Unable to load analytics.</p>
      </div>
    )
  }

  const m = data.members
  const ev = data.events
  const fin = data.financial
  const eng = data.engagement
  const totalRole = m.by_role.owner + m.by_role.admin + m.by_role.member + m.by_role.restricted || 1

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-zinc-400">Showing data for: {data.period_label}</p>
        <div className="flex items-center gap-2">
          {periodOptions.map((p) => (
            <Button
              key={p.value}
              size="sm"
              variant={period === p.value ? 'default' : 'outline'}
              onClick={() => setPeriod(p.value)}
              className={period === p.value ? 'bg-white text-black hover:bg-zinc-200' : 'bg-zinc-800 border-zinc-700 text-white'}
            >
              {p.label}
            </Button>
          ))}
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={exporting} className="bg-zinc-800 border-zinc-700 text-white">
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download size={16} />}
            <span className="ml-1">CSV</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4">
          <div className="flex items-center gap-2 text-green-400 mb-1">
            <Users size={20} />
            <span className="text-sm font-medium">Total Members</span>
          </div>
          <p className="text-2xl font-bold text-white">{m.total}</p>
          <p className="text-xs text-zinc-500">+{m.new_in_period} in period</p>
        </div>
        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4">
          <div className="flex items-center gap-2 text-blue-400 mb-1">
            <Calendar size={20} />
            <span className="text-sm font-medium">Events</span>
          </div>
          <p className="text-2xl font-bold text-white">{ev.total}</p>
          <p className="text-xs text-zinc-500">{ev.upcoming} upcoming</p>
        </div>
        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4">
          <div className="flex items-center gap-2 text-amber-400 mb-1">
            <DollarSign size={20} />
            <span className="text-sm font-medium">Revenue</span>
          </div>
          <p className="text-2xl font-bold text-white">${fin.total_revenue.toFixed(2)}</p>
          <p className="text-xs text-zinc-500">all time</p>
        </div>
        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4">
          <div className="flex items-center gap-2 text-purple-400 mb-1">
            <MessageSquare size={20} />
            <span className="text-sm font-medium">Messages</span>
          </div>
          <p className="text-2xl font-bold text-white">{eng.messages_in_period}</p>
          <p className="text-xs text-zinc-500">in period</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-6">
          <h3 className="font-semibold text-white mb-2">Member Growth</h3>
          <p className="text-xs text-zinc-500 mb-4">+{m.new_in_period} new members</p>
          <SimpleBarChart data={m.growth_trend} color="#22c55e" valueKey="count" />
        </div>
        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-6">
          <h3 className="font-semibold text-white mb-2">Revenue Trend</h3>
          <SimpleBarChart data={fin.revenue_trend} color="#f59e0b" valueKey="amount" />
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-6">
          <h3 className="font-semibold text-white mb-4">Members by Role</h3>
          <div className="space-y-3">
            {[
              { key: 'owner', label: 'Owner', color: 'bg-amber-500' },
              { key: 'admin', label: 'Admin', color: 'bg-purple-500' },
              { key: 'member', label: 'Member', color: 'bg-green-500' },
              { key: 'restricted', label: 'Restricted', color: 'bg-zinc-500' },
            ].map(({ key, label, color }) => {
              const count = m.by_role[key as keyof typeof m.by_role] ?? 0
              const pct = totalRole ? (100 * count) / totalRole : 0
              return (
                <div key={key}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-zinc-300">{label}</span>
                    <span className="text-zinc-400">{count}</span>
                  </div>
                  <div className="h-2 bg-zinc-800 rounded overflow-hidden">
                    <div className={cn('h-full rounded', color)} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-6">
          <h3 className="font-semibold text-white mb-4">Top Events by Attendance</h3>
          {ev.top_events.length === 0 ? (
            <p className="text-sm text-zinc-500">No events yet</p>
          ) : (
            <ul className="space-y-2">
              {ev.top_events.map((e, i) => (
                <li key={i} className="flex items-center justify-between text-sm">
                  <span className="text-zinc-300 truncate flex-1">{e.title}</span>
                  <span className="text-zinc-500 shrink-0 ml-2">{e.date}</span>
                  <span className="text-zinc-400 shrink-0 ml-2 flex items-center gap-1">
                    <Users size={14} /> {e.attendance}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-6">
          <h3 className="font-semibold text-white mb-4">Revenue Breakdown</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-400">Dues (period)</span>
              <span className="text-white">${fin.dues_revenue_period.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Dues (all time)</span>
              <span className="text-white">${fin.dues_revenue.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Tickets (period)</span>
              <span className="text-white">${fin.ticket_revenue_period.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Tickets (all time)</span>
              <span className="text-white">${fin.ticket_revenue.toFixed(2)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-zinc-700">
              <span className="text-zinc-400">Outstanding dues</span>
              <span className="text-amber-400">{fin.outstanding_dues_count} members</span>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-6">
        <h3 className="font-semibold text-white mb-4">Engagement Overview</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="rounded-lg bg-zinc-800/50 p-4">
            <Hash className="h-5 w-5 text-purple-400 mb-1" />
            <p className="text-xl font-bold text-white">{eng.active_channels}</p>
            <p className="text-xs text-zinc-500">Active Channels</p>
          </div>
          <div className="rounded-lg bg-zinc-800/50 p-4">
            <MessageSquare className="h-5 w-5 text-blue-400 mb-1" />
            <p className="text-xl font-bold text-white">{eng.messages_this_week}</p>
            <p className="text-xs text-zinc-500">Messages / Week</p>
          </div>
          <div className="rounded-lg bg-zinc-800/50 p-4">
            <Vote className="h-5 w-5 text-green-400 mb-1" />
            <p className="text-xl font-bold text-white">{eng.total_polls}</p>
            <p className="text-xs text-zinc-500">Total Polls</p>
          </div>
          <div className="rounded-lg bg-zinc-800/50 p-4">
            <BarChart3 className="h-5 w-5 text-amber-400 mb-1" />
            <p className="text-xl font-bold text-white">{eng.total_poll_votes}</p>
            <p className="text-xs text-zinc-500">Poll Votes</p>
          </div>
          <div className="rounded-lg bg-zinc-800/50 p-4">
            <Users className="h-5 w-5 text-pink-400 mb-1" />
            <p className="text-xl font-bold text-white">{ev.avg_attendance.toFixed(1)}</p>
            <p className="text-xs text-zinc-500">Avg. Attendance</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// Date/time helpers for My Tickets
function formatEventDate(dateString: string) {
  if (!dateString) return ''
  return new Date(dateString).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}
function formatEventTime(dateString: string) {
  if (!dateString) return ''
  return new Date(dateString).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

interface MyTicketItem {
  ticket_id: string
  short_code?: string
  event_id: string
  event_title: string
  event_start_time: string
  event_end_time?: string
  event_location?: string
  event_cover_image?: string
  organization_name: string
  status: string
  checked_in: boolean
  checked_in_at?: string
  amount: number
  qr_code?: string
  purchased_at?: string
}

function TicketStatusBadge({
  status,
  checkedIn,
  eventPassed,
}: {
  status: string
  checkedIn: boolean
  eventPassed: boolean
}) {
  if (status === 'refunded') {
    return <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-500/20 text-red-400">Refunded</span>
  }
  if (checkedIn) {
    return <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-500/20 text-blue-400">Checked In</span>
  }
  if (eventPassed) {
    return <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-zinc-500/20 text-zinc-400">Event Passed</span>
  }
  return <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-500/20 text-green-400">Valid</span>
}

function SettingsMyTickets({ orgId }: { orgId: string }) {
  const navigate = useNavigate()
  const [tickets, setTickets] = useState<MyTicketItem[]>([])
  const [loading, setLoading] = useState(true)
  const [qrTicket, setQrTicket] = useState<MyTicketItem | null>(null)

  useEffect(() => {
    if (!orgId) return
    setLoading(true)
    api
      .get(`/payments/${orgId}/my-tickets`)
      .then((r) => setTickets(Array.isArray(r.data) ? r.data : []))
      .catch(() => setTickets([]))
      .finally(() => setLoading(false))
  }, [orgId])

  const now = Date.now()
  const upcomingTickets = tickets.filter(
    (t) => t.event_start_time && new Date(t.event_start_time).getTime() > now && t.status !== 'refunded'
  )
  const pastTickets = tickets.filter(
    (t) => !t.event_start_time || new Date(t.event_start_time).getTime() <= now || t.status === 'refunded'
  )

  const handleDownloadQR = (ticket: MyTicketItem) => {
    if (!ticket.qr_code) return
    const link = document.createElement('a')
    link.href = ticket.qr_code
    link.download = `ticket-${ticket.event_title.replace(/\s+/g, '-')}-${ticket.ticket_id.slice(0, 8)}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        <span className="ml-2 text-zinc-400">Loading tickets...</span>
      </div>
    )
  }

  if (tickets.length === 0) {
    return (
      <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-8 text-center">
        <Ticket className="h-14 w-14 text-zinc-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">No tickets yet</h3>
        <p className="text-zinc-400 text-sm mb-6">Purchase tickets for paid events to see them here.</p>
        <Button
          onClick={() => navigate(`/org/${orgId}/calendar`)}
          className="bg-white text-black hover:bg-zinc-200"
        >
          Browse Events
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {upcomingTickets.length > 0 && (
        <section>
          <h3 className="font-semibold text-white mb-4">Upcoming events</h3>
          <ul className="space-y-4">
            {upcomingTickets.map((t) => (
              <MyTicketCard key={t.ticket_id} ticket={t} orgId={orgId} onViewQR={setQrTicket} />
            ))}
          </ul>
        </section>
      )}

      {upcomingTickets.length === 0 && pastTickets.length > 0 && (
        <div className="rounded-lg bg-zinc-800/50 border border-zinc-700 p-4 text-center text-zinc-400 text-sm mb-6">
          No upcoming events. You don&apos;t have tickets for any upcoming events.
        </div>
      )}

      {pastTickets.length > 0 && (
        <section>
          <h3 className="font-semibold text-white mb-4">Past events</h3>
          <ul className="space-y-4">
            {pastTickets.map((t) => (
              <MyTicketCard key={t.ticket_id} ticket={t} orgId={orgId} onViewQR={setQrTicket} />
            ))}
          </ul>
        </section>
      )}

      {qrTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80" onClick={() => setQrTicket(null)} aria-hidden />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Your Ticket</h2>
              <button
                type="button"
                onClick={() => setQrTicket(null)}
                className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <h3 className="text-lg font-semibold text-center text-white mb-4">{qrTicket.event_title}</h3>
            <div className="bg-white p-4 rounded-lg mb-4 flex justify-center min-h-[200px]">
              {qrTicket.qr_code ? (
                <img src={qrTicket.qr_code} alt="Ticket QR Code" className="w-48 h-48 object-contain" />
              ) : (
                <Suspense fallback={<div className="w-48 h-48 bg-zinc-100 animate-pulse rounded" />}>
                  <LazyQRCode value={qrTicket.ticket_id} size={192} level="H" />
                </Suspense>
              )}
            </div>
            {qrTicket.short_code ? (
              <p className="text-center text-lg font-semibold text-white mb-1">Code: {qrTicket.short_code}</p>
            ) : null}
            <p className="text-center text-xs text-zinc-500 mb-4 font-mono">{qrTicket.ticket_id.slice(0, 8)}…</p>
            <div className="flex justify-center mb-4">
              <TicketStatusBadge
                status={qrTicket.status}
                checkedIn={qrTicket.checked_in}
                eventPassed={!!(qrTicket.event_start_time && new Date(qrTicket.event_start_time).getTime() <= now)}
              />
            </div>
            <div className="text-center text-sm text-zinc-400 mb-6 space-y-1">
              <p>📅 {formatEventDate(qrTicket.event_start_time)}</p>
              <p>🕐 {formatEventTime(qrTicket.event_start_time)}</p>
              {qrTicket.event_location && <p>📍 {qrTicket.event_location}</p>}
            </div>
            {qrTicket.qr_code && (
              <Button
                onClick={() => handleDownloadQR(qrTicket)}
                className="w-full bg-zinc-800 hover:bg-zinc-700 text-white"
              >
                <Download className="h-4 w-4 mr-2" />
                Download QR Code
              </Button>
            )}
            <p className="text-center text-xs text-zinc-500 mt-4">Show this code at the event for check-in</p>
          </div>
        </div>
      )}
    </div>
  )
}

function MyTicketCard({
  ticket,
  orgId,
  onViewQR,
}: {
  ticket: MyTicketItem
  orgId: string
  onViewQR: (t: MyTicketItem) => void
}) {
  const eventPassed = !!(ticket.event_start_time && new Date(ticket.event_start_time).getTime() <= Date.now())
  return (
    <li className="rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden">
      <div className="p-4 flex gap-4">
        {ticket.event_cover_image ? (
          <div className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0 bg-zinc-800">
            <img
              src={ticket.event_cover_image}
              alt={ticket.event_title}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="w-24 h-24 rounded-lg flex-shrink-0 bg-zinc-800 flex items-center justify-center">
            <Ticket className="h-10 w-10 text-zinc-500" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-lg text-white truncate">
            <Link to={`/org/${orgId}/tickets/${ticket.ticket_id}`} className="hover:text-zinc-200">
              {ticket.event_title}
            </Link>
          </h4>
          <p className="text-sm text-zinc-400">
            📅 {formatEventDate(ticket.event_start_time)} at {formatEventTime(ticket.event_start_time)}
          </p>
          {ticket.short_code && (
            <p className="text-xs text-zinc-500 font-mono mt-0.5">Code: {ticket.short_code}</p>
          )}
          {ticket.event_location && (
            <p className="text-sm text-zinc-400">📍 {ticket.event_location}</p>
          )}
          <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
            <TicketStatusBadge
              status={ticket.status}
              checkedIn={ticket.checked_in}
              eventPassed={eventPassed}
            />
            {ticket.status !== 'refunded' && (
              <Button
                size="sm"
                variant="outline"
                className="bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700"
                onClick={() => onViewQR(ticket)}
              >
                <QrCode className="h-4 w-4 mr-1" />
                View QR Code
              </Button>
            )}
          </div>
        </div>
      </div>
    </li>
  )
}

const ROLE_LABELS: Record<string, string> = { owner: 'Owner', admin: 'Admin', member: 'Member', restricted: 'Restricted' }
const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  admin: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
  member: 'bg-green-500/20 text-green-400 border border-green-500/30',
  restricted: 'bg-zinc-500/20 text-zinc-400 border border-zinc-500/30',
}

interface MemberRowType {
  id: string
  user_id: string
  role: string
  status: string
  title?: string
  nickname?: string
  name: string
  email: string
  avatar?: string
  initial: string
}

function SettingsMembers({ orgId }: { orgId: string }) {
  const { user: authUser } = useAuth()
  const [org, setOrg] = useState<{ icon_color?: string } | null>(null)
  const [allMembers, setAllMembers] = useState<MemberRowType[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserRole, setCurrentUserRole] = useState<string>('member')
  const [searchQuery, setSearchQuery] = useState('')
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [removeModal, setRemoveModal] = useState<MemberRowType | null>(null)
  const csvInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!orgId) return
    api.get(`/organizations/${orgId}`).then((r) => setOrg(r.data)).catch(() => setOrg(null))
  }, [orgId])

  const fetchMembers = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    try {
      const { data } = await api.get(`/organizations/${orgId}/members`)
      setAllMembers(Array.isArray(data) ? data : [])
    } catch {
      setAllMembers([])
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  useEffect(() => {
    if (!orgId) return
    api.get(`/organizations/${orgId}/members/me`).then((r) => setCurrentUserRole(r.data?.role || 'member')).catch(() => setCurrentUserRole('member'))
  }, [orgId])

  const clearMessage = () => setActionMessage(null)

  const approveMember = async (memberId: string) => {
    setProcessingId(memberId)
    setActionMessage(null)
    try {
      await api.post(`/organizations/${orgId}/members/${memberId}/approve`)
      setActionMessage({ type: 'success', text: 'Member approved successfully' })
      setTimeout(clearMessage, 4000)
      fetchMembers()
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setActionMessage({ type: 'error', text: typeof detail === 'string' ? detail : 'Failed to approve member' })
    } finally {
      setProcessingId(null)
    }
  }

  const rejectMember = async (memberId: string) => {
    setProcessingId(memberId)
    setActionMessage(null)
    try {
      await api.post(`/organizations/${orgId}/members/${memberId}/reject`)
      setActionMessage({ type: 'success', text: 'Join request rejected' })
      setTimeout(clearMessage, 4000)
      fetchMembers()
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setActionMessage({ type: 'error', text: typeof detail === 'string' ? detail : 'Failed to reject' })
    } finally {
      setProcessingId(null)
    }
  }

  const updateRole = async (memberId: string, role: string) => {
    setProcessingId(memberId)
    setActionMessage(null)
    try {
      await api.put(`/organizations/${orgId}/members/${memberId}`, { role })
      setActionMessage({ type: 'success', text: `Role updated to ${ROLE_LABELS[role] ?? role}` })
      setTimeout(clearMessage, 4000)
      fetchMembers()
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setActionMessage({ type: 'error', text: typeof detail === 'string' ? detail : 'Failed to update role' })
    } finally {
      setProcessingId(null)
    }
  }

  const removeMember = async () => {
    if (!removeModal) return
    const memberId = removeModal.id
    setProcessingId(memberId)
    setActionMessage(null)
    try {
      await api.delete(`/organizations/${orgId}/members/${memberId}`)
      setActionMessage({ type: 'success', text: 'Member removed from organization' })
      setTimeout(clearMessage, 4000)
      setRemoveModal(null)
      fetchMembers()
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setActionMessage({ type: 'error', text: typeof detail === 'string' ? detail : 'Failed to remove member' })
    } finally {
      setProcessingId(null)
    }
  }

  const exportCsv = async () => {
    setExporting(true)
    setActionMessage(null)
    try {
      const [{ data: blob }, { data: org }] = await Promise.all([
        api.get(`/organizations/${orgId}/members/export/csv`, { responseType: 'blob' }),
        api.get(`/organizations/${orgId}`),
      ])
      const name = (org?.name || 'members').replace(/\s+/g, '-')
      const date = new Date().toISOString().split('T')[0]
      const url = window.URL.createObjectURL(new Blob([blob]))
      const a = document.createElement('a')
      a.href = url
      a.download = `${name}-members-${date}.csv`
      a.click()
      window.URL.revokeObjectURL(url)
      setActionMessage({ type: 'success', text: 'Export started' })
      setTimeout(clearMessage, 3000)
    } catch (e) {
      setActionMessage({ type: 'error', text: 'Export failed' })
    } finally {
      setExporting(false)
    }
  }

  const handleImportCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setActionMessage(null)
    setImporting(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('send_invites', 'true')
      const { data } = await api.post<{ imported_count: number; skipped_count: number; invites_sent?: number }>(
        `/organizations/${orgId}/members/import-csv`,
        form,
      )
      setActionMessage({
        type: 'success',
        text: `Imported ${data.imported_count} member${data.imported_count !== 1 ? 's' : ''} and sent ${data.invites_sent ?? 0} invitation${(data.invites_sent ?? 0) !== 1 ? 's' : ''}. ${data.skipped_count} row(s) skipped.`,
      })
      fetchMembers()
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setActionMessage({ type: 'error', text: typeof detail === 'string' ? detail : 'Import failed. Please check your CSV format and try again.' })
    } finally {
      setImporting(false)
    }
  }

  const pending = allMembers.filter((m) => m.status === 'pending')
  const approved = allMembers.filter((m) => m.status === 'approved')
  const query = searchQuery.trim().toLowerCase()
  const filteredApproved = query
    ? approved.filter(
        (m) =>
          (m.name || '').toLowerCase().includes(query) ||
          (m.email || '').toLowerCase().includes(query) ||
          (m.nickname || '').toLowerCase().includes(query)
      )
    : approved

  const canImport = currentUserRole === 'owner' || currentUserRole === 'admin'
  const currentUserId = authUser?.id ?? ''
  const canChangeRole = (member: MemberRowType) => {
    if (member.user_id === currentUserId) return false
    if (member.role === 'owner') return false
    if (currentUserRole === 'owner') return true
    if (currentUserRole === 'admin') return ['member', 'restricted'].includes(member.role)
    return false
  }
  const canRemoveMember = (member: MemberRowType) => {
    if (member.user_id === currentUserId) return false
    if (member.role === 'owner') return false
    if (currentUserRole === 'owner') return true
    if (currentUserRole === 'admin') return ['member', 'restricted'].includes(member.role)
    return false
  }
  const roleOptions = currentUserRole === 'owner' ? ['admin', 'member', 'restricted'] : ['member', 'restricted']

  const iconColor = org?.icon_color || '#71717a'

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2 mb-2">
        <Users size={28} style={{ color: iconColor }} className="shrink-0" />
        <h2 className="text-2xl font-bold text-white">Manage Members</h2>
      </div>

      {actionMessage && (
        <div
          className={cn(
            'rounded-lg p-3 text-sm',
            actionMessage.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
          )}
        >
          {actionMessage.text}
        </div>
      )}

      <section className="rounded-xl bg-zinc-900 border border-zinc-800 p-6">
        <h3 className="font-semibold text-white mb-2">Pending Approvals{pending.length > 0 ? ` (${pending.length})` : ''}</h3>
        <p className="text-sm text-zinc-500 mb-4">Approving adds them to the member list.</p>
        {pending.length === 0 ? (
          <p className="text-zinc-500 text-sm">No pending join requests.</p>
        ) : (
          <ul className="space-y-2">
            {pending.map((m) => (
              <li key={m.id} className="flex items-center justify-between p-3 rounded-lg bg-zinc-800 border border-zinc-700 flex-wrap gap-2">
                <div>
                  <p className="font-medium text-white">{m.name}</p>
                  <p className="text-sm text-zinc-500">{m.email}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => rejectMember(m.id)}
                    disabled={processingId === m.id}
                    variant="outline"
                    className="bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700"
                  >
                    {processingId === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X size={16} />}
                    <span className="ml-1">Reject</span>
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => approveMember(m.id)}
                    disabled={processingId === m.id}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    {processingId === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check size={16} />}
                    <span className="ml-1">Approve</span>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl bg-zinc-900 border border-zinc-800 p-6">
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-4 mb-4">
          <h3 className="text-lg font-semibold text-white">Members ({approved.length})</h3>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <div className="relative">
              <input
                type="search"
                placeholder="Search by name, email, nickname..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full sm:w-56 md:w-64 pl-3 pr-9 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 text-sm"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none">
                <Search size={16} />
              </span>
            </div>
            {canImport && (
              <>
                <input
                  ref={csvInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleImportCsv}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => csvInputRef.current?.click()}
                  disabled={importing}
                  className="bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700 shrink-0 sm:self-auto"
                >
                  {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload size={16} />}
                  <span className="ml-2">{importing ? 'Importing...' : 'Import CSV'}</span>
                </Button>
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={exportCsv}
              disabled={exporting || approved.length === 0}
              className="bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700 shrink-0 sm:self-auto"
            >
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download size={16} />}
              <span className="ml-2">Export CSV</span>
            </Button>
          </div>
        </div>
        <p className="text-sm text-zinc-400 mb-4">Set member roles. Restricted members have limited access.</p>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
          </div>
        ) : approved.length === 0 ? (
          <p className="text-zinc-500">No members yet.</p>
        ) : filteredApproved.length === 0 ? (
          <p className="text-zinc-500">No members match your search.</p>
        ) : (
          <ul className="space-y-2">
            {filteredApproved.map((member) => {
              const displayName = getDisplayName(member.name, member.nickname)
              const displayWithTitle = member.title ? `${displayName} (${member.title})` : displayName
              const canEdit = canChangeRole(member)
              const canRemove = canRemoveMember(member)
              return (
                <li key={member.id} className="flex items-center gap-4 p-3 rounded-lg bg-zinc-800 border border-zinc-700 flex-wrap">
                  <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center text-lg font-medium text-zinc-300 shrink-0 overflow-hidden">
                    {member.avatar ? (
                      <img src={member.avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      (displayName || member.initial).charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white truncate">
                      {displayWithTitle}
                      {member.role === 'owner' && <span className="text-zinc-500 text-sm font-normal"> (owner)</span>}
                    </p>
                    <p className="text-sm text-zinc-500 truncate">{member.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {canEdit ? (
                      <select
                        value={member.role}
                        onChange={(e) => updateRole(member.id, e.target.value)}
                        disabled={processingId === member.id}
                        className="bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-sm text-white capitalize"
                      >
                        {roleOptions.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className={cn('px-2 py-1 rounded text-xs font-medium', ROLE_COLORS[member.role] ?? 'bg-zinc-500/20 text-zinc-400')}>
                        {ROLE_LABELS[member.role] ?? member.role}
                      </span>
                    )}
                    {canRemove && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setRemoveModal(member)}
                        disabled={processingId === member.id}
                        className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {removeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setRemoveModal(null)} aria-hidden />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-2">Remove member</h3>
            <p className="text-zinc-400 text-sm mb-4">
              Remove {getDisplayName(removeModal.name, removeModal.nickname)} from this organization? They will lose access immediately. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setRemoveModal(null)} className="flex-1 bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700">
                Cancel
              </Button>
              <Button onClick={removeMember} disabled={!!processingId} className="flex-1 bg-red-600 hover:bg-red-700 text-white">
                {processingId ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Remove'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SettingsAffiliate({ orgId: _orgId }: { orgId: string }) {
  return (
    <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-8 text-center">
      <Link2 size={48} className="mx-auto text-zinc-600 mb-4" />
      <h3 className="text-lg font-semibold text-white mb-2">Affiliate program coming soon</h3>
      <p className="text-zinc-500">Integration with Rewardful will be available soon.</p>
    </div>
  )
}

function SettingsVideoTutorials({ orgId: _orgId }: { orgId: string }) {
  return (
    <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-8 text-center">
      <PlayCircle size={48} className="mx-auto text-zinc-600 mb-4" />
      <h3 className="text-lg font-semibold text-white mb-2">Video Tutorials</h3>
      <p className="text-zinc-500">Short videos on how to use the platform coming soon.</p>
    </div>
  )
}
