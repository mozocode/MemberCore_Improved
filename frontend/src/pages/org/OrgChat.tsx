import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useParams } from 'react-router-dom'
import { Link } from 'react-router-dom'
import {
  MessageSquare,
  Loader2,
  Send,
  Hash,
  Plus,
  X,
  User,
  Calendar,
  BarChart2,
  ChevronDown,
  Shield,
  Settings,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ChannelSettingsModal } from '@/components/ChannelSettingsModal'
import { cn } from '@/lib/utils'

interface Channel {
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

interface Message {
  id: string
  channel_id: string
  sender_id: string
  sender_name: string
  sender_nickname?: string | null
  content: string
  type: 'text' | 'event' | 'poll'
  created_at: string
  event_data?: {
    id: string
    title: string
    description?: string
    location?: string
    start_time?: string
    end_time?: string
    cover_image?: string
    is_paid?: boolean
    price?: number
    event_type?: string
    host?: { name: string; avatar?: string; initial: string }
  }
  poll_data?: {
    id: string
    question: string
    options?: { id: string; text: string }[]
  }
  poll_options?: string[]
}

function getWsUrl(orgId: string): string {
  const base = import.meta.env.VITE_BACKEND_URL || '/api'
  if (base.startsWith('http')) {
    const wsBase = base.replace(/^http/, 'ws')
    return `${wsBase.replace(/\/$/, '')}/chat/${orgId}/ws`
  }
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}${base}/chat/${orgId}/ws`
}

export function OrgChat() {
  const { orgId } = useParams<{ orgId: string }>()
  const { user } = useAuth()
  const [channels, setChannels] = useState<Channel[]>([])
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingChannels, setLoadingChannels] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [createModal, setCreateModal] = useState(false)
  const [newChannelName, setNewChannelName] = useState('')
  const [newChannelVisibility, setNewChannelVisibility] = useState<'public' | 'restricted'>('public')
  const [createError, setCreateError] = useState('')
  const [createLoading, setCreateLoading] = useState(false)
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)
  const [myRole, setMyRole] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeChannelIdRef = useRef<string | null>(null)

  const token = localStorage.getItem('token')

  useEffect(() => {
    activeChannelIdRef.current = activeChannel?.id ?? null
  }, [activeChannel?.id])

  const fetchChannels = useCallback(async () => {
    if (!orgId) return
    setLoadingChannels(true)
    try {
      const res = await api.get<Channel[]>(`/chat/${orgId}/channels`)
      setChannels(res.data)
      if (res.data.length > 0) {
        const general = res.data.find((ch) => (ch.name || '').toLowerCase() === 'general' || ch.is_default)
        const defaultChannel = general ?? res.data[0]
        setActiveChannel((prev) => (prev ? prev : defaultChannel))
      }
    } catch {
      setChannels([])
    } finally {
      setLoadingChannels(false)
    }
  }, [orgId])

  const fetchMessages = useCallback(async (silentRefetch = false) => {
    if (!orgId || !activeChannel) return
    const channelId = activeChannel.id
    if (!silentRefetch) {
      setLoadingMessages(true)
      setMessages((prev) => (prev.length ? [] : prev))
    }
    try {
      const res = await api.get<Message[]>(`/chat/${orgId}/channels/${channelId}/messages`)
      if (activeChannelIdRef.current !== channelId) return
      setMessages(res.data || [])
    } catch {
      if (activeChannelIdRef.current !== channelId) return
      setMessages([])
    } finally {
      if (activeChannelIdRef.current === channelId) {
        setLoadingMessages(false)
      }
    }
  }, [orgId, activeChannel])

  useEffect(() => {
    fetchChannels()
  }, [fetchChannels])

  useEffect(() => {
    if (!activeChannel) return
    fetchMessages()
  }, [activeChannel?.id, fetchMessages])

  useEffect(() => {
    if (!orgId) return
    api.get(`/organizations/${orgId}/members/me`).then((r) => setMyRole(r.data.role)).catch(() => setMyRole(null))
  }, [orgId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // WebSocket
  useEffect(() => {
    if (!orgId || !activeChannel || !token) return

    const url = `${getWsUrl(orgId)}?token=${encodeURIComponent(token)}`
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'subscribe', channel_id: activeChannel!.id }))
      const ping = () => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ type: 'ping' }))
      const interval = setInterval(ping, 25000)
      ;(ws as { _pingInterval?: ReturnType<typeof setInterval> })._pingInterval = interval
    }

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.type === 'message' && data.message) {
          const m = data.message
          if (m.channel_id === activeChannel?.id) {
            setMessages((prev) => {
              if (prev.some((x) => x.id === m.id)) return prev
              return [...prev, m]
            })
          }
        }
      } catch {}
    }

    ws.onclose = () => {
      const pingInt = (ws as { _pingInterval?: ReturnType<typeof setInterval> })._pingInterval
      if (pingInt) clearInterval(pingInt)
      wsRef.current = null
      reconnectRef.current = setTimeout(() => {
        fetchMessages(true)
      }, 2000)
    }

    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
      if (activeChannel) {
        ws.send(JSON.stringify({ type: 'unsubscribe', channel_id: activeChannel.id }))
      }
      ws.close()
      wsRef.current = null
    }
  }, [orgId, activeChannel?.id, token])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || !activeChannel || !orgId || sending) return
    setSending(true)
    try {
      const ws = wsRef.current
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'message', channel_id: activeChannel.id, content: text }))
        setInput('')
      } else {
        const res = await api.post(`/chat/${orgId}/channels/${activeChannel.id}/messages`, {
          content: text,
        })
        if (res.data?.id) {
          setMessages((prev) => [...prev, { ...res.data, sender_name: res.data.sender_name || 'Unknown' }])
          setInput('')
        }
      }
    } catch {
      setSending(false)
    } finally {
      setSending(false)
    }
  }

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError('')
    const name = newChannelName.trim().toLowerCase().replace(/\s+/g, '-').replace(/\?/g, '')
    if (!name || !orgId) {
      setCreateError('Channel name required')
      return
    }
    setCreateLoading(true)
    try {
      await api.post(`/chat/${orgId}/channels`, {
        name,
        visibility: newChannelVisibility,
        is_restricted: newChannelVisibility === 'restricted',
      })
      setCreateModal(false)
      setNewChannelName('')
      setNewChannelVisibility('public')
      fetchChannels()
    } catch (err: unknown) {
      setCreateError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed to create channel')
    } finally {
      setCreateLoading(false)
    }
  }

  const canManage = myRole === 'owner' || myRole === 'admin'
  const isRestrictedChannel = (ch: Channel) => ch.visibility === 'restricted' || ch.is_restricted
  const canEditActiveChannel = activeChannel && (activeChannel.created_by === user?.id || canManage)
  const [channelDropdownOpen, setChannelDropdownOpen] = useState(false)
  const channelDropdownRef = useRef<HTMLDivElement>(null)
  const [mobileHeaderTarget, setMobileHeaderTarget] = useState<HTMLElement | null>(null)

  // Only portal header into layout on mobile (layout hides that slot on lg+). On desktop always show in-content header.
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)')
    const check = () => {
      if (!mq.matches) {
        setMobileHeaderTarget(null)
        return
      }
      const el = document.getElementById('chat-header-extra')
      setMobileHeaderTarget(el ?? null)
    }
    check()
    const t = setTimeout(check, 50)
    mq.addEventListener('change', check)
    return () => {
      clearTimeout(t)
      mq.removeEventListener('change', check)
    }
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (channelDropdownRef.current && !channelDropdownRef.current.contains(e.target as Node)) {
        setChannelDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const channelDropdownContent = (
    <div className="relative" ref={channelDropdownRef}>
      <button
        type="button"
        onClick={() => setChannelDropdownOpen((o) => !o)}
        disabled={loadingChannels || channels.length === 0}
        className="flex items-center gap-2 px-3 py-2 sm:px-4 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors disabled:opacity-50 min-h-[44px]"
      >
        {activeChannel && isRestrictedChannel(activeChannel) ? (
          <Shield size={18} className="text-amber-500 shrink-0" />
        ) : (
          <Hash size={18} className="text-zinc-400 shrink-0" />
        )}
        <span className="text-white font-medium truncate max-w-[120px] sm:max-w-[200px]">
          {loadingChannels ? 'Loading...' : activeChannel?.name ?? 'Select channel'}
        </span>
        <ChevronDown className={cn('w-4 h-4 text-zinc-400 shrink-0 transition-transform', channelDropdownOpen && 'rotate-180')} />
      </button>
      {channelDropdownOpen && channels.length > 0 && (
        <div className="absolute top-full left-0 mt-2 w-56 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl overflow-hidden z-50 max-h-64 overflow-y-auto">
          {channels.map((ch) => (
            <button
              key={ch.id}
              type="button"
              onClick={() => {
                setActiveChannel(ch)
                setChannelDropdownOpen(false)
              }}
              className={cn(
                'w-full flex items-center gap-2 px-4 py-3 text-left min-h-[44px] transition-colors',
                ch.id === activeChannel?.id ? 'bg-zinc-800 text-white' : 'text-zinc-300 hover:bg-zinc-800 hover:text-white',
              )}
            >
              {isRestrictedChannel(ch) ? (
                <Shield size={16} className="text-amber-500 shrink-0" />
              ) : (
                <Hash size={16} className="text-zinc-500 shrink-0" />
              )}
              <span className="flex-1 truncate">{ch.name}</span>
              {ch.name === 'general' && <span className="text-xs text-zinc-500 shrink-0">default</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )

  const settingsButton = canEditActiveChannel ? (
    <button
      type="button"
      onClick={() => setSettingsModalOpen(true)}
      className="p-2.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
      aria-label="Channel settings"
    >
      <Settings size={20} />
    </button>
  ) : null

  const createChannelButton = (
    <button
      type="button"
      onClick={() => setCreateModal(true)}
      className="p-2.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
      aria-label="Create channel"
    >
      <Plus size={22} />
    </button>
  )

  const headerExtraContent = (
    <>
      {channelDropdownContent}
      {settingsButton}
      {createChannelButton}
    </>
  )

  return (
    <div className="h-full w-full max-w-full min-w-0 flex flex-col overflow-hidden bg-black">
      {/* On mobile: portal channel dropdown + Create into layout header (one line). On desktop: render full header here. */}
      {mobileHeaderTarget && createPortal(headerExtraContent, mobileHeaderTarget)}
      {!mobileHeaderTarget && (
        <header className="shrink-0 flex items-center justify-between gap-2 h-14 px-4 border-b border-zinc-800 bg-black">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <h1 className="text-lg font-semibold text-white truncate shrink-0">Chat</h1>
            {channelDropdownContent}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {settingsButton}
            {createChannelButton}
          </div>
        </header>
      )}

      {/* Scrollable messages area - only this section scrolls */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0 w-full">
        {activeChannel ? (
          <>
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4 min-h-0">
              {loadingMessages ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                  <MessageSquare size={48} className="mb-3 opacity-50" />
                  <p>No messages yet. Start the conversation!</p>
                </div>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className="flex gap-3">
                    <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
                      <User size={14} className="text-zinc-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="font-medium text-white">
                          {m.sender_nickname || m.sender_name || 'Unknown'}
                        </span>
                        <span className="text-xs text-zinc-500">
                          {m.created_at ? new Date(m.created_at).toLocaleString() : ''}
                        </span>
                      </div>
                      {m.type === 'event' && m.event_data ? (
                        <Link
                          to={`/org/${orgId}/calendar/${m.event_data.id}`}
                          className="mt-2 block rounded-xl border border-zinc-700 bg-zinc-900 overflow-hidden max-w-md hover:border-zinc-600 transition-colors"
                        >
                          {m.event_data.cover_image ? (
                            <img
                              src={m.event_data.cover_image}
                              alt=""
                              className="w-full h-32 object-cover bg-zinc-800"
                            />
                          ) : (
                            <div className="w-full h-24 bg-zinc-800 flex items-center justify-center">
                              <Calendar size={32} className="text-zinc-500" />
                            </div>
                          )}
                          <div className="p-3">
                            <p className="font-semibold text-white">{m.event_data.title}</p>
                            {m.event_data.start_time && (
                              <p className="text-xs text-zinc-400 mt-1">
                                {new Date(m.event_data.start_time).toLocaleDateString(undefined, {
                                  weekday: 'short',
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })}
                              </p>
                            )}
                            {m.event_data.host && (
                              <p className="text-xs text-zinc-500 mt-1">
                                Host: {m.event_data.host.name}
                              </p>
                            )}
                            <span className="inline-block mt-2 text-xs text-zinc-400 underline">
                              View event →
                            </span>
                          </div>
                        </Link>
                      ) : m.type === 'poll' && (m.poll_data || m.poll_options) ? (
                        <div className="mt-2 rounded-xl border border-zinc-700 bg-zinc-900 p-4 max-w-md">
                          <div className="flex items-center gap-2 text-zinc-400 text-xs mb-2">
                            <BarChart2 size={14} />
                            <span>Poll</span>
                          </div>
                          <p className="font-medium text-white">
                            {m.poll_data?.question || m.content}
                          </p>
                          <ul className="mt-2 space-y-1">
                            {(m.poll_data?.options || m.poll_options || []).map((opt, i) => (
                              <li
                                key={typeof opt === 'string' ? i : (opt as { id: string; text: string }).id}
                                className="text-sm text-zinc-300 py-1 px-2 rounded bg-zinc-800/50"
                              >
                                {typeof opt === 'string' ? opt : (opt as { id: string; text: string }).text}
                              </li>
                            ))}
                          </ul>
                          <Link
                            to={`/org/${orgId}/polls`}
                            className="inline-block mt-2 text-xs text-zinc-400 underline"
                          >
                            View poll →
                          </Link>
                        </div>
                      ) : (
                        <p className="text-zinc-300 text-sm mt-0.5 break-words">{m.content}</p>
                      )}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Fixed input bar - safe-area so it stays above browser UI on mobile */}
            <form onSubmit={handleSend} className="shrink-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-zinc-800 bg-black">
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={`Message #${activeChannel.name}`}
                  disabled={sending}
                  className="flex-1 bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500 min-h-[44px]"
                />
                <Button type="submit" disabled={sending || !input.trim()} size="icon" className="shrink-0 bg-white text-black hover:bg-zinc-200 min-h-[44px] min-w-[44px]">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send size={18} />}
                </Button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-zinc-500 p-4 min-h-0">
            <div className="text-center">
              <MessageSquare size={48} className="mx-auto mb-3 opacity-50" />
              <p>Select a channel from the dropdown above</p>
            </div>
          </div>
        )}
      </div>

      {/* Create channel modal */}
      {settingsModalOpen && activeChannel && (
        <ChannelSettingsModal
          orgId={orgId!}
          channel={activeChannel}
          currentUserId={user?.id}
          currentUserRole={myRole}
          onClose={() => setSettingsModalOpen(false)}
          onUpdated={(updated) => {
            setActiveChannel((prev) => (prev?.id === updated.id ? { ...prev, ...updated } : prev))
            setChannels((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)))
          }}
          onDeleted={(deletedId) => {
            setSettingsModalOpen(false)
            setChannels((prev) => prev.filter((c) => c.id !== deletedId))
            if (activeChannel?.id === deletedId) {
              const remaining = channels.filter((c) => c.id !== deletedId)
              setActiveChannel(remaining[0] ?? null)
            }
            fetchChannels()
          }}
        />
      )}

      {createModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setCreateModal(false)} aria-hidden />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-700">
            <div className="flex items-center justify-between p-4 border-b border-zinc-700">
              <h3 className="text-lg font-semibold text-white">Create Channel</h3>
              <button type="button" onClick={() => setCreateModal(false)} className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateChannel} className="p-4 space-y-4">
              {createError && <div className="text-sm text-red-400 bg-red-500/10 p-3 rounded-lg">{createError}</div>}
              <div>
                <Label className="text-zinc-300">Channel name</Label>
                <Input
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  placeholder="e.g. announcements"
                  required
                  className="mt-1 bg-zinc-800 border-zinc-700"
                />
              </div>
              {canManage && (
                <div>
                  <Label className="text-zinc-300 mb-2 block">Visibility</Label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setNewChannelVisibility('public')}
                      className={cn(
                        'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border transition-colors',
                        newChannelVisibility === 'public'
                          ? 'border-white bg-zinc-700 text-white'
                          : 'border-zinc-700 text-zinc-400 hover:text-white',
                      )}
                    >
                      <Hash size={18} />
                      Public
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewChannelVisibility('restricted')}
                      className={cn(
                        'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border transition-colors',
                        newChannelVisibility === 'restricted'
                          ? 'border-amber-500 bg-amber-500/10 text-amber-500'
                          : 'border-zinc-700 text-zinc-400 hover:text-amber-500',
                      )}
                    >
                      <Shield size={18} />
                      Restricted
                    </button>
                  </div>
                  {newChannelVisibility === 'restricted' && (
                    <p className="text-xs text-amber-500/90 mt-1.5">
                      Only members with Restricted role or those you add can see this channel.
                    </p>
                  )}
                </div>
              )}
              <div className="flex gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setCreateModal(false)} className="flex-1 bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700">
                  Cancel
                </Button>
                <Button type="submit" disabled={createLoading} className="flex-1 bg-white text-black hover:bg-zinc-200">
                  {createLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
