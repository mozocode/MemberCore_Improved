import { useState, useEffect } from 'react'
import { X, Hash, Shield, UserPlus, Trash2, Loader2, Check } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { getDisplayName } from '@/lib/displayName'

export interface ChannelForSettings {
  id: string
  name: string
  description?: string | null
  is_restricted?: boolean
  is_default?: boolean
  visibility?: string
  created_by?: string | null
  allowed_members?: string[]
  allowed_roles?: string[]
}

interface OrgMember {
  id: string
  user_id: string
  name?: string
  nickname?: string
  email?: string
  role?: string
}

interface ChannelSettingsModalProps {
  orgId: string
  channel: ChannelForSettings
  currentUserId: string | undefined
  currentUserRole: string | null
  onClose: () => void
  onUpdated: (updated: ChannelForSettings) => void
  onDeleted: (channelId: string) => void
}

export function ChannelSettingsModal({
  orgId,
  channel,
  currentUserId,
  currentUserRole,
  onClose,
  onUpdated,
  onDeleted,
}: ChannelSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'general' | 'access'>('general')
  const [name, setName] = useState(channel.name)
  const [description, setDescription] = useState(channel.description ?? '')
  const [visibility, setVisibility] = useState(channel.visibility === 'restricted' ? 'restricted' : 'public')
  const [allowedMembers, setAllowedMembers] = useState<string[]>(channel.allowed_members ?? [])
  const [allMembers, setAllMembers] = useState<OrgMember[]>([])
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [memberSearch, setMemberSearch] = useState('')
  const [showMemberSelector, setShowMemberSelector] = useState(false)

  const isAdmin = currentUserRole === 'admin' || currentUserRole === 'owner'
  const isCreator = channel.created_by === currentUserId
  const canChangeVisibility = isAdmin
  const canDelete = (isCreator || isAdmin) && !channel.is_default && (channel.name || '').toLowerCase() !== 'general'

  useEffect(() => {
    setName(channel.name)
    setDescription(channel.description ?? '')
    setVisibility(channel.visibility === 'restricted' ? 'restricted' : 'public')
    setAllowedMembers(channel.allowed_members ?? [])
  }, [channel])

  useEffect(() => {
    api
      .get(`/organizations/${orgId}/members`, { params: { status_filter: 'approved' } })
      .then((r) => setAllMembers(Array.isArray(r.data) ? r.data : []))
      .catch(() => setAllMembers([]))
  }, [orgId])

  const filteredMembers = allMembers.filter(
    (m) =>
      m.user_id !== currentUserId &&
      (memberSearch === '' ||
        (m.name || '').toLowerCase().includes(memberSearch.toLowerCase()) ||
        (m.email || '').toLowerCase().includes(memberSearch.toLowerCase())),
  )
  const allowedMemberDetails = allMembers.filter((m) => allowedMembers.includes(m.user_id))

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const nameSlug = name.trim().toLowerCase().replace(/\s+/g, '-').replace(/\?/g, '').replace(/'/g, '')
      await api.patch(`/chat/${orgId}/channels/${channel.id}`, {
        name: nameSlug || undefined,
        description: description.trim() || undefined,
        visibility: canChangeVisibility ? visibility : undefined,
        allowed_members: visibility === 'restricted' ? allowedMembers : undefined,
      })
      onUpdated({
        ...channel,
        name: nameSlug || channel.name,
        description: description.trim() || undefined,
        visibility,
        allowed_members: visibility === 'restricted' ? allowedMembers : [],
      })
      onClose()
    } catch (err: unknown) {
      setError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!canDelete || !confirm(`Delete #${channel.name}? This cannot be undone.`)) return
    setDeleting(true)
    setError('')
    try {
      await api.delete(`/chat/${orgId}/channels/${channel.id}`)
      onDeleted(channel.id)
      onClose()
    } catch (err: unknown) {
      setError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed to delete.')
    } finally {
      setDeleting(false)
    }
  }

  const toggleMember = (userId: string) => {
    if (allowedMembers.includes(userId)) {
      setAllowedMembers(allowedMembers.filter((id) => id !== userId))
    } else {
      setAllowedMembers([...allowedMembers, userId])
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden />
      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-zinc-900 border border-zinc-700 overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-zinc-700">
          <div className="flex items-center gap-2">
            {visibility === 'restricted' ? (
              <Shield size={20} className="text-amber-500" />
            ) : (
              <Hash size={20} className="text-zinc-400" />
            )}
            <h2 className="text-lg font-semibold text-white">Channel settings</h2>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800">
            <X size={20} />
          </button>
        </div>

        <div className="flex border-b border-zinc-700">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={cn(
              'flex-1 py-3 text-sm font-medium transition-colors',
              activeTab === 'general' ? 'text-white border-b-2 border-white' : 'text-zinc-400 hover:text-white',
            )}
          >
            General
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('access')}
            className={cn(
              'flex-1 py-3 text-sm font-medium transition-colors',
              activeTab === 'access' ? 'text-white border-b-2 border-white' : 'text-zinc-400 hover:text-white',
            )}
          >
            Access
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          {activeTab === 'general' && (
            <div className="space-y-4">
              <div>
                <Label className="text-zinc-300">Channel name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="channel-name"
                  className="mt-1.5 bg-zinc-800 border-zinc-700 text-white"
                />
                <p className="text-xs text-zinc-500 mt-1">
                  #{(name || channel.name).trim().toLowerCase().replace(/\s+/g, '-').replace(/\?/g, '') || 'name'}
                </p>
              </div>
              <div>
                <Label className="text-zinc-300">Description (optional)</Label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What's this channel about?"
                  rows={2}
                  className="mt-1.5 w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-600 resize-none"
                />
              </div>
              {canDelete && (
                <div className="pt-4 border-t border-zinc-800">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  >
                    {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                    <span className="ml-2">Delete channel</span>
                  </Button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'access' && (
            <div className="space-y-4">
              <div>
                <Label className="text-zinc-300 mb-2 block">Visibility</Label>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => canChangeVisibility && setVisibility('public')}
                    disabled={!canChangeVisibility && visibility !== 'public'}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors',
                      visibility === 'public' ? 'border-zinc-600 bg-zinc-800' : 'border-zinc-700 hover:border-zinc-600',
                      !canChangeVisibility && visibility !== 'public' && 'opacity-60 cursor-not-allowed',
                    )}
                  >
                    <Hash size={20} className="text-zinc-400" />
                    <div>
                      <p className="font-medium text-white">Public</p>
                      <p className="text-sm text-zinc-500">All members can see this channel</p>
                    </div>
                    {visibility === 'public' && <Check size={20} className="text-white ml-auto" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => canChangeVisibility && setVisibility('restricted')}
                    disabled={!canChangeVisibility && visibility !== 'restricted'}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors',
                      visibility === 'restricted' ? 'border-amber-500 bg-amber-500/10' : 'border-zinc-700 hover:border-zinc-600',
                      !canChangeVisibility && visibility !== 'restricted' && 'opacity-60 cursor-not-allowed',
                    )}
                  >
                    <Shield size={20} className={visibility === 'restricted' ? 'text-amber-500' : 'text-zinc-400'} />
                    <div>
                      <p className="font-medium text-white">Restricted</p>
                      <p className="text-sm text-zinc-500">Only restricted role and added members can see it</p>
                    </div>
                    {visibility === 'restricted' && <Check size={20} className="text-amber-500 ml-auto" />}
                  </button>
                </div>
                {!canChangeVisibility && <p className="text-xs text-zinc-500 mt-2">Only admins can change visibility.</p>}
              </div>

              {visibility === 'restricted' && (
                <div className="pt-4 border-t border-zinc-800">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-zinc-300">Additional members with access</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowMemberSelector(true)}
                      className="text-zinc-400 hover:text-white"
                    >
                      <UserPlus size={16} />
                      <span className="ml-1">Add</span>
                    </Button>
                  </div>
                  <p className="text-xs text-zinc-500 mb-3">
                    Members with &quot;Restricted&quot; role already have access. Add others here.
                  </p>
                  {allowedMemberDetails.length === 0 ? (
                    <p className="text-sm text-zinc-500 py-2">No additional members added.</p>
                  ) : (
                    <ul className="space-y-2">
                      {allowedMemberDetails.map((m) => (
                        <li
                          key={m.user_id}
                          className="flex items-center justify-between p-2 rounded-lg bg-zinc-800 border border-zinc-700"
                        >
                          <span className="text-sm text-white">{getDisplayName(m.name, m.nickname) || m.email || m.user_id}</span>
                          <button
                            type="button"
                            onClick={() => toggleMember(m.user_id)}
                            className="p-1 text-zinc-400 hover:text-red-400"
                          >
                            <X size={16} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {showMemberSelector && (
                <div className="absolute inset-0 z-10 bg-zinc-900 rounded-2xl flex flex-col border border-zinc-700">
                  <div className="flex items-center justify-between p-4 border-b border-zinc-700">
                    <h3 className="font-medium text-white">Add members</h3>
                    <button type="button" onClick={() => { setShowMemberSelector(false); setMemberSearch(''); }} className="p-1 text-zinc-400 hover:text-white">
                      <X size={20} />
                    </button>
                  </div>
                  <div className="p-4">
                    <Input
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      placeholder="Search by name or email..."
                      className="bg-zinc-800 border-zinc-700"
                    />
                  </div>
                  <div className="flex-1 overflow-y-auto px-4 pb-4 min-h-0">
                    {filteredMembers.length === 0 ? (
                      <p className="text-zinc-500 py-4 text-center">No members found</p>
                    ) : (
                      <ul className="space-y-1">
                        {filteredMembers.map((m) => (
                          <li key={m.user_id}>
                            <button
                              type="button"
                              onClick={() => toggleMember(m.user_id)}
                              className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-800 text-left"
                            >
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-white truncate">{getDisplayName(m.name, m.nickname) || m.email || 'Unknown'}</p>
                                {m.email && <p className="text-xs text-zinc-500 truncate">{m.email}</p>}
                              </div>
                              <div
                                className={cn(
                                  'w-5 h-5 rounded border flex items-center justify-center shrink-0',
                                  allowedMembers.includes(m.user_id) ? 'bg-white border-white' : 'border-zinc-600',
                                )}
                              >
                                {allowedMembers.includes(m.user_id) && <Check size={12} className="text-black" />}
                              </div>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="p-4 border-t border-zinc-700">
                    <Button onClick={() => { setShowMemberSelector(false); setMemberSearch(''); }} className="w-full bg-white text-black hover:bg-zinc-200">
                      Done ({allowedMembers.length} selected)
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
        </div>

        <div className="flex gap-3 p-4 border-t border-zinc-700">
          <Button variant="outline" onClick={onClose} className="flex-1 bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="flex-1 bg-white text-black hover:bg-zinc-200">
            {saving ? <Loader2 size={18} className="animate-spin" /> : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  )
}
