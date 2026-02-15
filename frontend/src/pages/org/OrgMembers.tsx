import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import {
  Search,
  Loader2,
  User,
} from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { getDisplayName } from '@/lib/displayName'

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

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white">Members</h2>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-10 pl-10 pr-4 rounded-lg bg-zinc-900 border border-zinc-700 text-white placeholder:text-zinc-500 text-sm"
        />
      </div>

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
