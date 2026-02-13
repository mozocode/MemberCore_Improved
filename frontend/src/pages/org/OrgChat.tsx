import { useState, useEffect, useRef, useCallback } from 'react'
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
} from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface Channel {
  id: string
  name: string
  is_restricted?: boolean
  visibility?: string
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
  const [channels, setChannels] = useState<Channel[]>([])
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingChannels, setLoadingChannels] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [createModal, setCreateModal] = useState(false)
  const [newChannelName, setNewChannelName] = useState('')
  const [createError, setCreateError] = useState('')
  const [createLoading, setCreateLoading] = useState(false)
  const [myRole, setMyRole] = useState<string | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const token = localStorage.getItem('token')

  const fetchChannels = useCallback(async () => {
    if (!orgId) return
    setLoadingChannels(true)
    try {
      const res = await api.get<Channel[]>(`/chat/${orgId}/channels`)
      setChannels(res.data)
      if (!activeChannel && res.data.length > 0) {
        setActiveChannel(res.data[0])
      }
    } catch {
      setChannels([])
    } finally {
      setLoadingChannels(false)
    }
  }, [orgId])

  const fetchMessages = useCallback(async () => {
    if (!orgId || !activeChannel) return
    setLoadingMessages(true)
    try {
      const res = await api.get<Message[]>(`/chat/${orgId}/channels/${activeChannel.id}/messages`)
      setMessages(res.data || [])
    } catch {
      setMessages([])
    } finally {
      setLoadingMessages(false)
    }
  }, [orgId, activeChannel])

  useEffect(() => {
    fetchChannels()
  }, [fetchChannels])

  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

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
        fetchMessages()
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
    const name = newChannelName.trim().toLowerCase().replace(/\s+/g, '-')
    if (!name || !orgId) {
      setCreateError('Channel name required')
      return
    }
    setCreateLoading(true)
    try {
      await api.post(`/chat/${orgId}/channels`, { name, visibility: 'everyone', is_restricted: false })
      setCreateModal(false)
      setNewChannelName('')
      fetchChannels()
    } catch (err: unknown) {
      setCreateError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed to create channel')
    } finally {
      setCreateLoading(false)
    }
  }

  const canManage = myRole === 'owner' || myRole === 'admin'

  return (
    <div className="flex h-[calc(100vh-4rem)] md:h-[calc(100vh-3rem)]">
      {/* Channel sidebar */}
      <div className="w-56 shrink-0 border-r border-zinc-800 flex flex-col bg-zinc-950/50">
        <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
          <h3 className="font-semibold text-white">Channels</h3>
          {canManage && (
            <button
              onClick={() => setCreateModal(true)}
              className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white"
              title="Create channel"
            >
              <Plus size={18} />
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {loadingChannels ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
            </div>
          ) : (
            <div className="space-y-0.5">
              {channels.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => setActiveChannel(ch)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors',
                    activeChannel?.id === ch.id
                      ? 'bg-zinc-800 text-white'
                      : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-white',
                  )}
                >
                  <Hash size={16} />
                  <span>{ch.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeChannel ? (
          <>
            <div className="p-4 border-b border-zinc-800 flex items-center gap-2">
              <Hash size={20} className="text-zinc-500" />
              <span className="font-semibold text-white">{activeChannel.name}</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
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

            <form onSubmit={handleSend} className="p-4 border-t border-zinc-800">
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={`Message #${activeChannel.name}`}
                  disabled={sending}
                  className="flex-1 bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500"
                />
                <Button type="submit" disabled={sending || !input.trim()} size="icon" className="shrink-0 bg-white text-black hover:bg-zinc-200">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send size={18} />}
                </Button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-zinc-500">
            <div className="text-center">
              <MessageSquare size={48} className="mx-auto mb-3 opacity-50" />
              <p>Select a channel</p>
            </div>
          </div>
        )}
      </div>

      {/* Create channel modal */}
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
