import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import {
  BarChart3,
  Plus,
  Loader2,
  Circle,
  Clock,
  Vote,
} from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { CreatePollModal } from '@/components/CreatePollModal'
import { cn } from '@/lib/utils'

interface PollOption {
  id: string
  text: string
  vote_count: number
}

interface Poll {
  id: string
  question: string
  description?: string
  options: PollOption[]
  allow_multiple_votes: boolean
  is_anonymous: boolean
  ends_at?: string
  is_open: boolean
  total_votes: number
  my_votes: string[]
  created_at: string
}

export function OrgPolls() {
  const { orgId } = useParams<{ orgId: string }>()
  const [polls, setPolls] = useState<Poll[]>([])
  const [loading, setLoading] = useState(true)
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [tab, setTab] = useState<'active' | 'closed'>('active')
  const [myRole, setMyRole] = useState<string | null>(null)
  const [votingPollId, setVotingPollId] = useState<string | null>(null)

  const fetchPolls = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    try {
      const { data } = await api.get(`/polls/${orgId}`)
      setPolls(data)
    } catch {
      setPolls([])
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => {
    fetchPolls()
  }, [fetchPolls])

  useEffect(() => {
    if (!orgId) return
    api.get(`/organizations/${orgId}/members/me`).then((r) => setMyRole(r.data.role)).catch(() => setMyRole(null))
  }, [orgId])

  const handleVote = async (pollId: string, optionIds: string[]) => {
    setVotingPollId(pollId)
    try {
      await api.post(`/polls/${orgId}/${pollId}/vote`, { option_ids: optionIds })
      fetchPolls()
    } catch (e) {
      console.error(e)
    } finally {
      setVotingPollId(null)
    }
  }

  const formatDate = (d?: string) => {
    if (!d) return ''
    try {
      return new Date(d).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    } catch {
      return d
    }
  }

  const canCreate = myRole === 'owner' || myRole === 'admin'
  const active = polls.filter((p) => p.is_open)
  const closed = polls.filter((p) => !p.is_open)
  const displayPolls = tab === 'active' ? active : closed

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h2 className="text-xl font-semibold text-white">Polls</h2>
        {canCreate && (
          <Button onClick={() => setCreateModalOpen(true)} className="bg-white text-black hover:bg-zinc-200">
            <Plus size={18} />
            <span className="ml-2">Create Poll</span>
          </Button>
        )}
      </div>

      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setTab('active')}
          className={cn(
            'px-4 py-2 rounded-lg text-sm',
            tab === 'active' ? 'bg-white text-black' : 'bg-zinc-800 text-zinc-400 hover:text-white',
          )}
        >
          Active ({active.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('closed')}
          className={cn(
            'px-4 py-2 rounded-lg text-sm',
            tab === 'closed' ? 'bg-white text-black' : 'bg-zinc-800 text-zinc-400 hover:text-white',
          )}
        >
          Closed ({closed.length})
        </button>
      </div>

      {createModalOpen && (
        <CreatePollModal
          orgId={orgId!}
          onClose={() => setCreateModalOpen(false)}
          onCreated={() => {
            setCreateModalOpen(false)
            fetchPolls()
          }}
        />
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
        </div>
      ) : displayPolls.length === 0 ? (
        <div className="rounded-lg bg-zinc-900 border border-zinc-700 p-12 text-center">
          <BarChart3 className="h-12 w-12 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400">No {tab} polls</p>
          {canCreate && tab === 'active' && (
            <Button variant="outline" onClick={() => setCreateModalOpen(true)} className="mt-4 bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700">
              Create Poll
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {displayPolls.map((poll) => {
            const maxVotes = Math.max(...(poll.options?.map((o) => o.vote_count) || [0]), 1)
            return (
              <div key={poll.id} className="rounded-xl bg-zinc-900 border border-zinc-700 p-4">
                <h3 className="font-semibold text-white mb-1">{poll.question}</h3>
                {poll.description && <p className="text-sm text-zinc-500 mb-3">{poll.description}</p>}
                <div className="flex flex-wrap gap-2 mb-3 text-xs text-zinc-500">
                  {poll.allow_multiple_votes && <span>Multiple choice</span>}
                  {poll.is_anonymous && <span>Anonymous</span>}
                  {poll.ends_at && (
                    <span className="flex items-center gap-1">
                      <Clock size={12} />
                      Ends {formatDate(poll.ends_at)}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Vote size={12} />
                    {poll.total_votes} votes
                  </span>
                </div>
                <div className="space-y-2">
                  {poll.options?.map((opt) => {
                    const pct = maxVotes > 0 ? (opt.vote_count / maxVotes) * 100 : 0
                    const selected = poll.my_votes?.includes(opt.id)
                    return (
                      <div key={opt.id} className="space-y-1">
                        <button
                          type="button"
                          disabled={!poll.is_open || !!votingPollId}
                          onClick={() => {
                            if (!poll.is_open) return
                            if (poll.allow_multiple_votes) {
                              const next = selected
                                ? (poll.my_votes || []).filter((id) => id !== opt.id)
                                : [...(poll.my_votes || []), opt.id]
                              handleVote(poll.id, next)
                            } else {
                              handleVote(poll.id, selected ? [] : [opt.id])
                            }
                          }}
                          className={cn(
                            'w-full text-left px-4 py-3 rounded-lg border transition-colors flex items-center justify-between',
                            selected ? 'bg-brand-orange/20 border-brand-orange/50 text-brand-orange' : 'bg-zinc-800 border-zinc-700 hover:border-zinc-600',
                            !poll.is_open && 'opacity-75 cursor-default',
                          )}
                        >
                          <span className="flex items-center gap-2">
                            {poll.allow_multiple_votes ? (
                              <Circle size={18} className={selected ? 'fill-current' : ''} />
                            ) : (
                              <Circle size={18} className={selected ? 'fill-current' : ''} />
                            )}
                            {opt.text}
                          </span>
                          <span className="text-sm text-zinc-400">
                            {opt.vote_count} ({maxVotes > 0 ? Math.round((opt.vote_count / maxVotes) * 100) : 0}%)
                          </span>
                        </button>
                        <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-brand-orange rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
                {votingPollId === poll.id && (
                  <p className="text-sm text-zinc-500 mt-2 flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving vote...
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
