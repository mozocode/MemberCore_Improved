import { useState, useEffect } from 'react'
import { X, Search, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'

interface Member {
  id: string
  name?: string
  email?: string
  avatar?: string
  role?: string
}

interface NewMessageModalProps {
  orgId: string
  onClose: () => void
  onSelectMember: (member: Member) => void
}

export function NewMessageModal({ orgId, onClose, onSelectMember }: NewMessageModalProps) {
  const [search, setSearch] = useState('')
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const params = search.trim() ? { search: search.trim() } : {}
    setLoading(true)
    api
      .get(`/organizations/${orgId}/dm/members`, { params })
      .then((r) => setMembers(r.data || []))
      .catch(() => setMembers([]))
      .finally(() => setLoading(false))
  }, [orgId, search])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end lg:items-center justify-center bg-black/60"
      onClick={onClose}
      aria-hidden
    >
      <div
        className="w-full lg:max-w-md bg-zinc-900 rounded-t-2xl lg:rounded-xl max-h-[80vh] flex flex-col border border-zinc-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <h2 className="text-lg font-semibold text-white">New Message</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 border-b border-zinc-800">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search members..."
              autoFocus
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
            </div>
          ) : members.length === 0 ? (
            <p className="p-4 text-center text-zinc-500">
              {search ? 'No members found' : 'No other members in this organization'}
            </p>
          ) : (
            members.map((member) => (
              <button
                key={member.id}
                type="button"
                onClick={() => onSelectMember(member)}
                className="w-full flex items-center gap-3 px-4 py-3 min-h-[44px] hover:bg-zinc-800 text-left transition-colors"
              >
                {member.avatar ? (
                  <img
                    src={member.avatar}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center shrink-0">
                    <span className="font-medium text-white">
                      {(member.name || '?').charAt(0)}
                    </span>
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-white truncate">{member.name}</p>
                    {member.role === 'restricted' && (
                      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                        Restricted
                      </span>
                    )}
                  </div>
                  {member.email && (
                    <p className="text-sm text-zinc-500 truncate">{member.email}</p>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
