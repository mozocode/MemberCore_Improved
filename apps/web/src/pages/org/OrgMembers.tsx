import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import {
  Search,
  Loader2,
  User,
  Upload,
} from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { getDisplayName } from '@/lib/displayName'
import { Button } from '@/components/ui/button'

interface Member {
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

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
  restricted: 'Restricted',
}

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-amber-500/20 text-amber-400',
  admin: 'bg-purple-500/20 text-purple-400',
  member: 'bg-green-500/20 text-green-400',
  restricted: 'bg-zinc-500/20 text-zinc-400',
}

export function OrgMembers() {
  const { orgId } = useParams<{ orgId: string }>()
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [allMembers, setAllMembers] = useState<Member[]>([])
  const [myRole, setMyRole] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importMessage, setImportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!orgId) return
    api.get(`/organizations/${orgId}/members/me`).then((r) => setMyRole(r.data?.role ?? null)).catch(() => setMyRole(null))
  }, [orgId])

  const fetchMembers = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      const { data } = await api.get(`/organizations/${orgId}/members?${params}`)
      setAllMembers(data)
    } catch {
      setAllMembers([])
    } finally {
      setLoading(false)
    }
  }, [orgId, search])

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  const members = allMembers.filter((m) => m.status === 'approved')
  const canImport = myRole === 'owner' || myRole === 'admin'

  const handleImportCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !orgId) return
    e.target.value = ''
    setImportMessage(null)
    setImporting(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('send_invites', 'true')
      const { data } = await api.post<{ imported_count: number; skipped_count: number; invites_sent?: number }>(
        `/organizations/${orgId}/members/import-csv`,
        form,
      )
      setImportMessage({
        type: 'success',
        text: `Imported ${data.imported_count} member${data.imported_count !== 1 ? 's' : ''} and sent ${data.invites_sent ?? 0} invitation${(data.invites_sent ?? 0) !== 1 ? 's' : ''}. ${data.skipped_count} row(s) skipped.`,
      })
      fetchMembers()
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setImportMessage({ type: 'error', text: typeof detail === 'string' ? detail : 'Import failed. Please try again.' })
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-10 pl-10 pr-4 rounded-lg bg-zinc-900 border border-zinc-700 text-white placeholder:text-zinc-500 text-sm"
        />
        </div>
        {canImport && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleImportCsv}
            />
            <Button
              type="button"
              variant="outline"
              className="shrink-0 border-zinc-600 text-zinc-300 hover:bg-zinc-800"
              disabled={importing}
              onClick={() => fileInputRef.current?.click()}
            >
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {importing ? ' Importing…' : ' Import & Send Invites'}
            </Button>
          </>
        )}
      </div>
      {importMessage && (
        <div
          className={cn(
            'mb-4 p-3 rounded-lg text-sm',
            importMessage.type === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400',
          )}
        >
          {importMessage.text}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
        </div>
      ) : members.length === 0 ? (
        <div className="rounded-lg bg-zinc-900 border border-zinc-700 p-12 text-center">
          <User className="h-12 w-12 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400">No members found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-4 p-4 rounded-lg bg-zinc-900 border border-zinc-700"
            >
              <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-lg font-medium text-zinc-300 shrink-0">
                {member.avatar ? (
                  <img src={member.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  member.initial
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white truncate">
                  {getDisplayName(member.name, member.nickname)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'px-2 py-1 rounded text-xs font-medium',
                    ROLE_COLORS[member.role] ?? 'bg-zinc-500/20 text-zinc-400',
                  )}
                >
                  {ROLE_LABELS[member.role] ?? member.role}
                </span>
                {member.title && (
                  <span className="text-xs text-zinc-500">{member.title}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
