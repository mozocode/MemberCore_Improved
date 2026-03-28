import { useState, useEffect, useRef, useCallback, useMemo, Fragment } from 'react'
import { createPortal } from 'react-dom'
import { useParams } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { useLocation } from 'react-router-dom'
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
  Pin,
  Reply,
  Copy,
  Paperclip,
  Pencil,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ChannelSettingsModal } from '@/components/ChannelSettingsModal'
import { cn } from '@/lib/utils'
import { compressImageFile } from '@/lib/imageCompression'

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
  pinned_message_id?: string | null
}

interface Message {
  id: string
  channel_id: string
  sender_id: string
  sender_name: string
  sender_nickname?: string | null
  sender_avatar?: string | null
  content: string
  image_data_url?: string | null
  link_preview?: {
    url: string
    title?: string
    description?: string
    image?: string
    site_name?: string
  } | null
  type: 'text' | 'event' | 'poll'
  created_at: string
  edited_at?: string | null
  reply_to_message_id?: string | null
  reply_to_snippet?: string | null
  reactions?: { emoji: string; count: number; reactedByMe: boolean }[]
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
  const location = useLocation()
  const { user } = useAuth()
  const [channels, setChannels] = useState<Channel[]>([])
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingChannels, setLoadingChannels] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [input, setInput] = useState('')
  const [selectedImageDataUrl, setSelectedImageDataUrl] = useState<string | null>(null)
  const [selectedImageName, setSelectedImageName] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [editingMessage, setEditingMessage] = useState<Message | null>(null)
  const [createModal, setCreateModal] = useState(false)
  const [newChannelName, setNewChannelName] = useState('')
  const [newChannelVisibility, setNewChannelVisibility] = useState<'public' | 'restricted'>('public')
  const [createError, setCreateError] = useState('')
  const [createLoading, setCreateLoading] = useState(false)
  const [settingsModalOpen, setSettingsModalOpen] = useState(false)
  const [myRole, setMyRole] = useState<string | null>(null)
  const [pinnedMessageId, setPinnedMessageId] = useState<string | null>(null)
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const [longPressState, setLongPressState] = useState<{ message: Message; rect: DOMRect } | null>(null)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchTargetRef = useRef<EventTarget | null>(null)
  const lastTapRef = useRef<{ messageId: string; time: number } | null>(null)
  const touchStartRef = useRef<{ x: number; y: number; message: Message } | null>(null)
  const longPressOpenedThisTouchRef = useRef(false)
  const suppressClickAfterLongPressRef = useRef(false)
  const wsRef = useRef<WebSocket | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesScrollRef = useRef<HTMLDivElement>(null)
  const messagesThreadRef = useRef<HTMLDivElement>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeChannelIdRef = useRef<string | null>(null)
  const isNearBottomRef = useRef(true)
  const prevMessageCountRef = useRef(0)

  const [pinnedBarDismissed, setPinnedBarDismissed] = useState(false)
  const [newMessagesBelow, setNewMessagesBelow] = useState(false)
  const [expandedReactionMessageId, setExpandedReactionMessageId] = useState<string | null>(null)
  const [swipeRevealMessageId, setSwipeRevealMessageId] = useState<string | null>(null)
  const [lastReadMessageId, setLastReadMessageId] = useState<string | null>(null)
  const [lastReadTimestamp, setLastReadTimestamp] = useState<string | null>(null)
  const forceScrollToLatestRef = useRef(false)
  const forceInitialLatestOnLoadRef = useRef(true)
  /**
   * Primary control for chat anchoring: when true we keep the viewport pinned to the latest message
   * (initial open, after send, layout/image growth, new inbound messages). Set false when the user
   * scrolls away from the bottom; set true again when they scroll back within the near-bottom threshold.
   */
  const stickToBottomRef = useRef(true)
  /** After first programmatic scroll-to-bottom for this channel; avoids clearing stickToBottom on pre-scroll layout. */
  const scrollAnchorAppliedRef = useRef(false)
  const putReadThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const putReadRef = useRef<(messageId: string, timestamp?: string) => void>(() => {})
  const forceBottomTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [summaryBullets, setSummaryBullets] = useState<string[]>([])
  const [summaryLoading, setSummaryLoading] = useState(false)
  const summaryCacheRef = useRef<{ channelId: string; lastReadId: string | null; bullets: string[] } | null>(null)
  const forceScrollToBottom = useCallback(() => {
    if (!stickToBottomRef.current) return
    const scroller = messagesScrollRef.current
    if (scroller) {
      scroller.scrollTop = scroller.scrollHeight
      isNearBottomRef.current = true
      scrollAnchorAppliedRef.current = true
      return
    }
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' })
    isNearBottomRef.current = true
    scrollAnchorAppliedRef.current = true
  }, [])

  const scheduleForceScrollToBottomBurst = useCallback(() => {
    forceBottomTimersRef.current.forEach((t) => clearTimeout(t))
    forceBottomTimersRef.current = []
    // Re-apply bottom anchoring for late content expansion (images/cards). Respect stickToBottomRef throughout.
    const delays = [0, 50, 120, 320, 700, 1200, 1700, 2400, 3200]
    delays.forEach((ms) => {
      const timer = setTimeout(() => {
        if (!stickToBottomRef.current) return
        forceScrollToBottom()
      }, ms)
      forceBottomTimersRef.current.push(timer)
    })
  }, [forceScrollToBottom])

  useEffect(() => {
    return () => {
      forceBottomTimersRef.current.forEach((t) => clearTimeout(t))
      forceBottomTimersRef.current = []
    }
  }, [])


  const token = localStorage.getItem('token')

  const GROUP_WINDOW_MS = 5 * 60 * 1000
  function groupMessages(msgs: Message[]): Message[][] {
    const groups: Message[][] = []
    for (const m of msgs) {
      const isEventOrPoll = m.type === 'event' || m.type === 'poll'
      const prev = groups[groups.length - 1]
      if (
        prev &&
        prev[0].sender_id === m.sender_id &&
        !isEventOrPoll &&
        prev.every((p) => p.type !== 'event' && p.type !== 'poll')
      ) {
        const lastTime = new Date(prev[prev.length - 1].created_at).getTime()
        const currTime = new Date(m.created_at).getTime()
        if (currTime - lastTime <= GROUP_WINDOW_MS) {
          prev.push(m)
          continue
        }
      }
      groups.push([m])
    }
    return groups
  }

  const { firstUnreadMessageId, unreadCount, showSummaryCta } = useMemo(() => {
    let first: string | null = null
    let count = 0
    const hasLastRead = lastReadMessageId != null || (lastReadTimestamp != null && lastReadTimestamp.length > 0)
    if (!hasLastRead || messages.length === 0) {
      return { firstUnreadMessageId: null, unreadCount: 0, showSummaryCta: false }
    }
    const cutoffTime = lastReadTimestamp ? new Date(lastReadTimestamp).getTime() : 0
    let startIndex = 0
    if (lastReadMessageId) {
      const idx = messages.findIndex((m) => m.id === lastReadMessageId)
      startIndex = idx === -1 ? 0 : idx + 1
    } else if (cutoffTime) {
      startIndex = messages.findIndex((m) => (m.created_at ? new Date(m.created_at).getTime() : 0) > cutoffTime)
      if (startIndex === -1) startIndex = messages.length
    }
    if (startIndex < messages.length) {
      first = messages[startIndex].id
      count = messages.length - startIndex
    }
    const sixHoursMs = 6 * 60 * 60 * 1000
    const inactiveLongEnough = lastReadTimestamp ? Date.now() - new Date(lastReadTimestamp).getTime() > sixHoursMs : false
    const showCta = count >= 15 || (count > 0 && inactiveLongEnough)
    return { firstUnreadMessageId: first, unreadCount: count, showSummaryCta: showCta }
  }, [messages, lastReadMessageId, lastReadTimestamp])

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

  const putRead = useCallback(
    (messageId: string, timestamp?: string) => {
      if (!orgId || !activeChannel) return
      const doPut = () => {
        api
          .put(`/chat/${orgId}/channels/${activeChannel!.id}/read`, {
            last_read_message_id: messageId,
            last_read_timestamp: timestamp || messages.find((m) => m.id === messageId)?.created_at || new Date().toISOString(),
          })
          .then(() => {
            setLastReadMessageId(messageId)
            setLastReadTimestamp(timestamp || messages.find((m) => m.id === messageId)?.created_at || null)
          })
          .catch(() => {})
      }
      if (putReadThrottleRef.current) clearTimeout(putReadThrottleRef.current)
      putReadThrottleRef.current = setTimeout(doPut, 800)
    },
    [orgId, activeChannel, messages],
  )
  putReadRef.current = putRead

  const fetchMessages = useCallback(async (silentRefetch = false) => {
    if (!orgId || !activeChannel) return
    const channelId = activeChannel.id
    if (!silentRefetch) {
      setLoadingMessages(true)
      setMessages((prev) => (prev.length ? [] : prev))
    }
    try {
      const res = await api.get<{
        messages: Message[]
        pinned_message_id?: string | null
        last_read_message_id?: string | null
        last_read_timestamp?: string | null
      }>(`/chat/${orgId}/channels/${channelId}/messages`)
      if (activeChannelIdRef.current !== channelId) return
      const data = res.data
      setMessages(Array.isArray(data?.messages) ? data.messages : [])
      setPinnedMessageId(data?.pinned_message_id ?? null)
      setLastReadMessageId(data?.last_read_message_id ?? null)
      setLastReadTimestamp(data?.last_read_timestamp ?? null)
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
    setPinnedBarDismissed(false)
    forceInitialLatestOnLoadRef.current = true
    stickToBottomRef.current = true
    scrollAnchorAppliedRef.current = false
    prevMessageCountRef.current = 0
    summaryCacheRef.current = null
    setSummaryOpen(false)
  }, [activeChannel?.id])

  useEffect(() => {
    const navState = location.state as { forceLatestChatAt?: number } | null
    if (!navState?.forceLatestChatAt) return
    // When Chat is clicked from sidebar, always land on newest message.
    forceScrollToLatestRef.current = true
    stickToBottomRef.current = true
    setNewMessagesBelow(false)
  }, [location.state])

  useEffect(() => {
    if (!swipeRevealMessageId) return
    const t = setTimeout(() => setSwipeRevealMessageId(null), 3000)
    return () => clearTimeout(t)
  }, [swipeRevealMessageId])

  useEffect(() => {
    const el = messagesScrollRef.current
    if (!el) return
    const check = () => {
      const { scrollHeight, scrollTop, clientHeight } = el
      const near = scrollHeight - scrollTop - clientHeight < 120
      isNearBottomRef.current = near
      if (near) {
        stickToBottomRef.current = true
      } else if (scrollAnchorAppliedRef.current) {
        stickToBottomRef.current = false
      }
    }
    el.addEventListener('scroll', check, { passive: true })
    check()
    return () => el.removeEventListener('scroll', check)
  }, [activeChannel?.id])

  // Re-anchor when thread height changes (images, event cards, link previews). Observing the scroll box
  // misses scrollHeight growth; observing the thread subtree catches layout shifts.
  useEffect(() => {
    const thread = messagesThreadRef.current
    if (!thread || loadingMessages) return
    let t: ReturnType<typeof setTimeout> | null = null
    const run = () => {
      if (!stickToBottomRef.current) return
      forceScrollToBottom()
    }
    const ro = new ResizeObserver(() => {
      if (!stickToBottomRef.current) return
      if (t) clearTimeout(t)
      t = setTimeout(run, 32)
    })
    ro.observe(thread)
    return () => {
      ro.disconnect()
      if (t) clearTimeout(t)
    }
  }, [activeChannel?.id, loadingMessages, messages.length, forceScrollToBottom])

  useEffect(() => {
    if (loadingMessages) return
    if (!forceScrollToLatestRef.current && !forceInitialLatestOnLoadRef.current) return
    forceScrollToLatestRef.current = false
    forceInitialLatestOnLoadRef.current = false
    stickToBottomRef.current = true
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        forceScrollToBottom()
        scheduleForceScrollToBottomBurst()
      })
    })
  }, [loadingMessages, messages.length, activeChannel?.id, forceScrollToBottom, scheduleForceScrollToBottomBurst])

  useEffect(() => {
    const el = messagesScrollRef.current
    if (!el || !activeChannel || !orgId) return
    let tick: ReturnType<typeof setTimeout> | null = null
    const onScroll = () => {
      if (tick) return
      tick = setTimeout(() => {
        tick = null
        const containerRect = el.getBoundingClientRect()
        const bottom = containerRect.bottom - 20
        const nodes = el.querySelectorAll('[data-message-id]')
        let bottommostId: string | null = null
        let maxBottom = 0
        nodes.forEach((node) => {
          const r = (node as HTMLElement).getBoundingClientRect()
          if (r.bottom <= bottom && r.bottom > maxBottom) {
            maxBottom = r.bottom
            bottommostId = node.getAttribute('data-message-id')
          }
        })
        if (bottommostId) {
          putRead(bottommostId)
        }
      }, 400)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      if (tick) clearTimeout(tick)
    }
  }, [activeChannel?.id, orgId, putRead])

  useEffect(() => {
    const count = messages.length
    const prevCount = prevMessageCountRef.current
    prevMessageCountRef.current = count
    if (count > prevCount && prevCount > 0) {
      if (stickToBottomRef.current) {
        setNewMessagesBelow(false)
        setTimeout(() => {
          if (!stickToBottomRef.current) return
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        }, 50)
      } else {
        setNewMessagesBelow(true)
      }
    }
  }, [messages.length])

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
            if (stickToBottomRef.current && m.id) {
              putReadRef.current(m.id, m.created_at)
            }
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
    if ((!text && !selectedImageDataUrl) || !activeChannel || !orgId || sending) return
    setSending(true)
    if (editingMessage && activeChannel && orgId) {
      try {
        const res = await api.patch(`/chat/${orgId}/channels/${activeChannel.id}/messages/${editingMessage.id}`, {
          content: text,
        })
        const editedAt = res.data?.edited_at || new Date().toISOString()
        setMessages((prev) =>
          prev.map((m) => (m.id === editingMessage.id ? { ...m, content: text, edited_at: editedAt } : m)),
        )
        setInput('')
        setEditingMessage(null)
      } catch {
        // ignore edit failures for now
      } finally {
        setSending(false)
      }
      return
    }
    const replySnippet = replyingTo ? ((replyingTo.content || '').slice(0, 200) || (replyingTo.image_data_url ? '[Image]' : '')) : ''
    const replyPayload =
      replyingTo ?
        {
          reply_to_message_id: replyingTo.id,
          reply_to_snippet: replySnippet,
        }
      : {}
    try {
      stickToBottomRef.current = true
      const ws = wsRef.current
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: 'message',
            channel_id: activeChannel.id,
            content: text,
            image_data_url: selectedImageDataUrl,
            ...replyPayload,
          }),
        )
        setInput('')
        setSelectedImageDataUrl(null)
        setSelectedImageName(null)
        setReplyingTo(null)
      } else {
        const res = await api.post(`/chat/${orgId}/channels/${activeChannel.id}/messages`, {
          content: text,
          image_data_url: selectedImageDataUrl,
          ...replyPayload,
        })
        if (res.data?.id) {
          setMessages((prev) => [...prev, { ...res.data, sender_name: res.data.sender_name || 'Unknown' }])
          setInput('')
          setSelectedImageDataUrl(null)
          setSelectedImageName(null)
          setReplyingTo(null)
        }
      }
    } catch {
      setSending(false)
    } finally {
      setSending(false)
    }
  }

  const handlePickImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const compressed = await compressImageFile(file, { maxSize: 1600, maxBytes: 600_000 })
      setSelectedImageDataUrl(compressed)
      setSelectedImageName(file.name)
    } catch {
      // Ignore bad file reads; user can try another image.
    }
  }

  const canManage = myRole === 'owner' || myRole === 'admin'
  const canPin = canManage
  const handlePin = async (message: Message) => {
    if (!orgId || !activeChannel || !canPin) return
    closeLongPressPanel()
    try {
      const newPin = activeChannel.pinned_message_id === message.id ? null : message.id
      await api.put(`/chat/${orgId}/channels/${activeChannel.id}/pin`, {
        message_id: newPin,
      })
      setPinnedMessageId(newPin)
      setChannels((prev) =>
        prev.map((c) => (c.id === activeChannel.id ? { ...c, pinned_message_id: newPin } : c)),
      )
      setActiveChannel((prev) => (prev?.id === activeChannel.id ? { ...prev!, pinned_message_id: newPin } : prev))
    } catch {
      // ignore
    }
  }

  const handleCopy = (message: Message) => {
    closeLongPressPanel()
    const text = message.content || (message.event_data?.title && `Event: ${message.event_data.title}`) || ''
    if (text) navigator.clipboard.writeText(text)
  }

  const toggleReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!orgId || !activeChannel) return
    try {
      const res = await api.post(
        `/chat/${orgId}/channels/${activeChannel.id}/messages/${messageId}/reactions`,
        { emoji },
      )
      const reactions = (res.data as { reactions?: { emoji: string; count: number; reactedByMe: boolean }[] })?.reactions
      if (reactions !== undefined) {
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, reactions } : m)),
        )
      }
    } catch (err) {
      console.error('Reaction toggle failed:', err)
    }
  }, [orgId, activeChannel])

  const REACTION_EMOJIS = ['👍', '❤️', '😂', '🔥']
  const [emojiPickerTarget, setEmojiPickerTarget] = useState<{ message: Message; rect: DOMRect } | null>(null)
  const emojiPickerMessageRef = useRef<Message | null>(null)

  const EMOJI_CATEGORIES: { label: string; emojis: string[] }[] = [
    { label: 'Smileys', emojis: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😊','😇','😍','🥰','😘','😗','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','😮‍💨','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐'] },
    { label: 'Gestures', emojis: ['👍','👎','👊','✊','🤛','🤜','🤞','✌️','🤟','🤘','👌','🤌','🤏','👈','👉','👆','👇','☝️','✋','🤚','🖐️','🖖','👋','🤙','💪','🙏','🤝','👏','🫶'] },
    { label: 'Hearts', emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','❤️‍🩹','💕','💞','💓','💗','💖','💘','💝'] },
    { label: 'Celebration', emojis: ['🎉','🎊','🥳','🎈','🎁','🎂','🍾','🥂','✨','🌟','⭐','💫','🏆','🥇','🥈','🥉','🎖️','🏅'] },
    { label: 'Animals', emojis: ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔','🐧','🐦','🦅','🦆','🦉','🐺','🐗','🐴','🦄','🐝','🐛','🦋','🐌','🐙'] },
    { label: 'Food', emojis: ['🍎','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍑','🍒','🥭','🍍','🥝','🍔','🍕','🌮','🌯','🍣','🍜','🍝','🍩','🍪','🎂','🍰','🧁','🍫','🍬','🍭','☕','🍺'] },
    { label: 'Objects', emojis: ['🔥','💯','💢','💥','💫','💦','💨','🕳️','💣','💬','👁️‍🗨️','🗯️','💤','💮','♨️','🚀','⚡','☀️','🌙','⭐','🌈','☁️','🔔','🎵','🎶','📌','📍','🏷️','💡','🔑'] },
  ]

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

  useEffect(() => {
    if (!longPressState) return
    const close = () => setLongPressState(null)
    const isInsidePanel = (target: Node | null) => {
      if (!target) return false
      const panel = document.getElementById('long-press-panel')
      const backdrop = document.getElementById('long-press-backdrop')
      if (target === backdrop) return true
      if (panel && panel.contains(target)) return true
      // Walk up from target to check if any ancestor is the panel (covers portal edge-cases)
      let node: Node | null = target
      while (node) {
        if (node === panel) return true
        if ((node as HTMLElement).id === 'long-press-panel') return true
        node = node.parentNode
      }
      return false
    }
    let armed = false
    const armTimer = setTimeout(() => { armed = true }, 150)
    const onMouse = (e: MouseEvent) => {
      if (!armed) return
      if (isInsidePanel(e.target as Node)) return
      close()
    }
    const onTouch = (e: TouchEvent) => {
      if (!armed) return
      const target = e.target as Node
      if (isInsidePanel(target)) return
      close()
    }
    document.addEventListener('mousedown', onMouse, true)
    document.addEventListener('touchstart', onTouch, { capture: true, passive: true })
    return () => {
      clearTimeout(armTimer)
      document.removeEventListener('mousedown', onMouse, true)
      document.removeEventListener('touchstart', onTouch, true)
    }
  }, [longPressState])

  const openLongPressPanel = useCallback((message: Message, sourceElement: HTMLElement) => {
    longPressOpenedThisTouchRef.current = true
    suppressClickAfterLongPressRef.current = true
    const msgEl = sourceElement.closest('[data-message-container]') as HTMLElement | null
    const el = msgEl ?? sourceElement
    const rect = el.getBoundingClientRect()
    if (navigator.vibrate) navigator.vibrate(10)
    setLongPressState({ message, rect })
  }, [])

  const handleDoubleTapLike = useCallback(
    (message: Message) => {
      const now = Date.now()
      const last = lastTapRef.current
      if (last?.messageId === message.id && now - last.time < 350) {
        lastTapRef.current = null
        toggleReaction(message.id, '👍')
        if (navigator.vibrate) navigator.vibrate(5)
        return true
      }
      lastTapRef.current = { messageId: message.id, time: now }
      return false
    },
    [toggleReaction],
  )

  const closeLongPressPanel = useCallback(() => {
    setLongPressState(null)
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

  const createChannelButton =
    myRole !== 'restricted' ? (
      <button
        type="button"
        onClick={() => setCreateModal(true)}
        className="p-2.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
        aria-label="Create channel"
      >
        <Plus size={22} />
      </button>
    ) : null

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
            <div
              ref={messagesScrollRef}
              className="flex-1 overflow-y-auto overflow-x-hidden p-4 min-h-0 relative flex flex-col"
              style={{ WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' } as React.CSSProperties}
              onContextMenu={(e) => e.preventDefault()}
            >
              <div className="flex flex-col min-h-full min-h-0 flex-1 w-full">
              {pinnedMessageId && messages.some((m) => m.id === pinnedMessageId) && !pinnedBarDismissed && (
                <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-zinc-800/80 border border-zinc-700 text-sm text-zinc-300 mb-4">
                  <Pin size={14} className="shrink-0 text-amber-500" />
                  <span className="truncate flex-1">
                    1 pinned message: {messages.find((m) => m.id === pinnedMessageId)?.content?.slice(0, 60) || 'Message'}
                    {(messages.find((m) => m.id === pinnedMessageId)?.content?.length ?? 0) > 60 ? '…' : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const el = document.getElementById(`msg-${pinnedMessageId}`)
                      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    }}
                    className="text-zinc-400 hover:text-white underline shrink-0"
                  >
                    Jump
                  </button>
                  <button type="button" onClick={() => setPinnedBarDismissed(true)} className="p-1 rounded hover:bg-zinc-700 text-zinc-500 shrink-0" aria-label="Dismiss">
                    <X size={14} />
                  </button>
                </div>
              )}
              {newMessagesBelow && (
                <div className="sticky top-0 z-10 flex justify-center py-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      stickToBottomRef.current = true
                      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
                      setNewMessagesBelow(false)
                    }}
                    className="px-4 py-1.5 rounded-full bg-zinc-800 border border-zinc-600 text-sm text-white shadow-lg hover:bg-zinc-700"
                  >
                    New messages
                  </button>
                </div>
              )}
              {loadingMessages ? (
                <div className="flex flex-1 min-h-[240px] items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center py-12 text-zinc-500 min-h-[240px]">
                  <MessageSquare size={48} className="mb-3 opacity-50" />
                  <p>No messages yet. Start the conversation!</p>
                </div>
              ) : (
                <div ref={messagesThreadRef} className="mt-auto w-full flex flex-col min-h-0">
                {groupMessages(messages).map((group) => (
                  <div key={group[0].id} className={cn('space-y-0.5', group.length > 1 ? 'mb-3' : 'mb-4')}>
                    {group.map((m, idxInGroup) => {
                      const isFirstInGroup = idxInGroup === 0
                      const showUnreadDivider = m.id === firstUnreadMessageId
                      return (
                  <Fragment key={m.id}>
                    {showUnreadDivider && (
                      <>
                        {showSummaryCta && (
                          <div className="py-2 mb-1">
                            <button
                              type="button"
                              onClick={async () => {
                                setSummaryOpen((open) => !open)
                                if (summaryOpen) return
                                const cache = summaryCacheRef.current
                                if (cache && cache.channelId === activeChannel?.id && cache.lastReadId === lastReadMessageId) {
                                  setSummaryBullets(cache.bullets)
                                  return
                                }
                                setSummaryLoading(true)
                                try {
                                  const res = await api.post<{ bullets: string[] }>(
                                    `/chat/${orgId}/channels/${activeChannel!.id}/summary`,
                                    {
                                      last_read_message_id: lastReadMessageId || undefined,
                                      last_read_timestamp: lastReadTimestamp || undefined,
                                    },
                                  )
                                  const bullets = res.data?.bullets ?? []
                                  setSummaryBullets(bullets)
                                  summaryCacheRef.current = {
                                    channelId: activeChannel!.id,
                                    lastReadId: lastReadMessageId,
                                    bullets,
                                  }
                                } catch {
                                  setSummaryBullets([])
                                } finally {
                                  setSummaryLoading(false)
                                }
                              }}
                              className="w-full text-left py-2 px-3 rounded-lg bg-zinc-800/80 border border-zinc-700 text-sm text-zinc-300 hover:bg-zinc-700/80 transition-colors"
                            >
                              You missed {unreadCount} messages — Catch up with summary →
                            </button>
                            {summaryOpen && (
                              <div className="mt-2 py-3 px-3 rounded-lg bg-zinc-900 border border-zinc-700 text-sm text-zinc-300">
                                <p className="font-medium text-white mb-2">Summary</p>
                                {summaryLoading ? (
                                  <div className="flex items-center gap-2 text-zinc-500">
                                    <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                                  </div>
                                ) : summaryBullets.length > 0 ? (
                                  <ul className="list-disc list-inside space-y-1">
                                    {summaryBullets.map((b, i) => (
                                      <li key={i}>{b}</li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-zinc-500">No summary available.</p>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setSummaryOpen(false)}
                                  className="mt-2 text-xs text-zinc-500 hover:text-zinc-400"
                                >
                                  Collapse
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                        <div className="flex items-center gap-2 py-2 text-zinc-500 text-xs">
                          <span className="flex-1 border-t border-zinc-700" />
                          <span>New messages</span>
                          <span className="flex-1 border-t border-zinc-700" />
                        </div>
                      </>
                    )}
                  <div
                    role="article"
                    id={`msg-${m.id}`}
                    data-message-id={m.id}
                    data-message-container
                    className={cn(
                      'flex gap-3 group rounded-xl p-3 min-h-[44px] transition-colors',
                      'cursor-pointer',
                      'bg-zinc-900 border border-zinc-800/80',
                      'hover:bg-zinc-800/90 hover:border-zinc-700 active:bg-zinc-800 active:border-zinc-600',
                      !isFirstInGroup && 'pl-11',
                      longPressState?.message.id === m.id && 'bg-zinc-800 border-zinc-500',
                    )}
                    style={{ WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none', touchAction: 'manipulation' } as React.CSSProperties}
                    onClickCapture={(e) => {
                      if (suppressClickAfterLongPressRef.current) {
                        e.preventDefault()
                        e.stopPropagation()
                        suppressClickAfterLongPressRef.current = false
                        return
                      }
                      const target = e.target as Node
                      const el = target instanceof Element ? target : target?.parentElement
                      if (el?.closest('a, button')) return
                      e.preventDefault()
                      e.stopPropagation()
                      openLongPressPanel(m, e.currentTarget as HTMLElement)
                    }}
                    onClick={() => {
                      if (suppressClickAfterLongPressRef.current) {
                        suppressClickAfterLongPressRef.current = false
                      }
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      openLongPressPanel(m, e.currentTarget as HTMLElement)
                    }}
                    onTouchStart={(e) => {
                      const touch = e.changedTouches?.[0] || e.touches?.[0]
                      if (touch) {
                        const containerEl = e.currentTarget as HTMLElement
                        touchStartRef.current = { x: touch.clientX, y: touch.clientY, message: m }
                        touchTargetRef.current = containerEl
                        longPressTimerRef.current = setTimeout(() => {
                          openLongPressPanel(m, containerEl)
                          longPressTimerRef.current = null
                        }, 400)
                      }
                    }}
                    onTouchEnd={(e) => {
                      if (longPressTimerRef.current) {
                        clearTimeout(longPressTimerRef.current)
                        longPressTimerRef.current = null
                      }
                      const start = touchStartRef.current
                      const touch = e.changedTouches?.[0]
                      const openedPanel = longPressOpenedThisTouchRef.current
                      longPressOpenedThisTouchRef.current = false
                      if (openedPanel) {
                        touchStartRef.current = null
                        touchTargetRef.current = null
                        return
                      }
                      if (start && touch && start.message.id === m.id) {
                        const deltaX = touch.clientX - start.x
                        const deltaY = touch.clientY - start.y
                        if (deltaX > 60 && Math.abs(deltaY) < 80) {
                          setReplyingTo(m)
                          if (navigator.vibrate) navigator.vibrate(5)
                        } else if (deltaX < -50 && Math.abs(deltaY) < 80) {
                          setSwipeRevealMessageId(m.id)
                          if (navigator.vibrate) navigator.vibrate(5)
                        } else {
                          handleDoubleTapLike(m)
                        }
                      }
                      touchStartRef.current = null
                      touchTargetRef.current = null
                    }}
                    onTouchMove={(e) => {
                      if (!longPressTimerRef.current) return
                      const touch = e.touches?.[0]
                      const start = touchStartRef.current
                      if (touch && start && (Math.abs(touch.clientX - start.x) > 15 || Math.abs(touch.clientY - start.y) > 15)) {
                        clearTimeout(longPressTimerRef.current)
                        longPressTimerRef.current = null
                      }
                    }}
                  >
                    {/* Avatar */}
                    {isFirstInGroup ? (
                      m.sender_avatar ? (
                        <img
                          src={m.sender_avatar}
                          alt=""
                          className="h-8 w-8 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
                          <User size={14} className="text-zinc-400" />
                        </div>
                      )
                    ) : (
                      <div className="w-8 shrink-0" aria-hidden />
                    )}
                    <div className="min-w-0 flex-1 flex flex-col gap-0">
                      {/* Header: display name + timestamp */}
                      {isFirstInGroup && (
                        <header className="flex items-baseline gap-2 flex-wrap">
                          <span className="font-medium text-white">
                            {m.sender_nickname || m.sender_name || 'Unknown'}
                          </span>
                          <span className="text-xs text-zinc-500">
                            {m.created_at ? new Date(m.created_at).toLocaleString() : ''}
                          </span>
                        </header>
                      )}
                      {!isFirstInGroup && (
                        <span className="text-xs text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Message time">
                          {m.created_at ? new Date(m.created_at).toLocaleString() : ''}
                        </span>
                      )}
                      {/* MessageBody: reply preview, text, event/poll cards */}
                      <div className="min-w-0">
                        {m.reply_to_snippet && (
                          <p className="text-xs text-zinc-500 mt-0.5 border-l-2 border-zinc-600 pl-2">
                            Reply to: {m.reply_to_snippet.slice(0, 80)}
                            {m.reply_to_snippet.length > 80 ? '…' : ''}
                          </p>
                        )}
                        {m.type === 'event' && m.event_data ? (
                        <>
                          {isFirstInGroup && <p className="text-xs text-zinc-500 mb-0.5">New Event</p>}
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
                        </>
                      ) : m.type === 'poll' && (m.poll_data || m.poll_options) ? (
                        <>
                          {isFirstInGroup && <p className="text-xs text-zinc-500 mb-0.5">New Poll</p>}
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
                        </>
                      ) : (
                        <>
                          {m.image_data_url && (
                            <img
                              src={m.image_data_url}
                              alt="Chat attachment"
                              className="mt-1 rounded-lg border border-zinc-700 max-h-72 w-auto object-contain"
                            />
                          )}
                          {m.content && <p className="text-zinc-300 text-sm mt-0.5 break-words">{m.content}</p>}
                          {m.link_preview?.url && (
                            <a
                              href={m.link_preview.url}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-2 block rounded-xl border border-zinc-700 bg-zinc-900 overflow-hidden max-w-md hover:border-zinc-600 transition-colors"
                            >
                              {m.link_preview.image ? (
                                <img
                                  src={m.link_preview.image}
                                  alt={m.link_preview.title || 'Link preview'}
                                  className="w-full h-36 object-cover bg-zinc-800"
                                />
                              ) : null}
                              <div className="p-3">
                                {m.link_preview.site_name && (
                                  <p className="text-[11px] uppercase tracking-wide text-zinc-500">{m.link_preview.site_name}</p>
                                )}
                                <p className="text-sm font-semibold text-white mt-1">
                                  {m.link_preview.title || m.link_preview.url}
                                </p>
                                {m.link_preview.description && (
                                  <p className="text-xs text-zinc-400 mt-1 break-words">{m.link_preview.description}</p>
                                )}
                                <p className="text-xs text-zinc-500 mt-2 truncate">{m.link_preview.url}</p>
                              </div>
                            </a>
                          )}
                          {m.edited_at && <p className="text-[11px] text-zinc-500 mt-1">(edited)</p>}
                        </>
                      )}
                      </div>
                      {/* ReactionRow: only when reactions exist */}
                      {(() => {
                        const reactionList = m.reactions || []
                        const withCount = reactionList.filter((r) => r.count > 0)
                        const isExpanded = expandedReactionMessageId === m.id
                        if (withCount.length === 0 && !isExpanded) return null
                        return (
                          <div className="mt-1.5 relative">
                            <div
                              className="flex flex-wrap items-center gap-1"
                              onClick={(e) => {
                                if (withCount.length > 0) setExpandedReactionMessageId((id) => (id === m.id ? null : m.id))
                                e.stopPropagation()
                              }}
                            >
                              {withCount.map((r) => (
                                <button
                                  key={r.emoji}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    toggleReaction(m.id, r.emoji)
                                  }}
                                  className={cn(
                                    'inline-flex items-center gap-1 px-2 py-0.5 rounded text-sm border transition-colors',
                                    r.reactedByMe
                                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                                      : 'bg-zinc-800/80 border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-300',
                                  )}
                                >
                                  <span>{r.emoji}</span>
                                  <span className="text-xs">{r.count}</span>
                                </button>
                              ))}
                            </div>
                            {isExpanded && (
                              <>
                                <div
                                  className="fixed inset-0 z-[100]"
                                  onClick={() => setExpandedReactionMessageId(null)}
                                  aria-hidden
                                />
                                <div className="absolute left-0 top-full mt-1 py-2 px-2 rounded-lg bg-zinc-900 border border-zinc-700 shadow-xl z-[101] flex flex-wrap gap-1 min-w-[160px]">
                                  {REACTION_EMOJIS.map((emoji) => {
                                    const existing = reactionList.find((r) => r.emoji === emoji)
                                    return (
                                      <button
                                        key={emoji}
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); toggleReaction(m.id, emoji) }}
                                        className={cn(
                                          'p-2 rounded-lg border text-lg transition-colors',
                                          existing?.reactedByMe ? 'bg-amber-500/20 border-amber-500/50' : 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700',
                                        )}
                                      >
                                        {emoji}
                                        {(existing?.count ?? 0) > 0 && <span className="ml-1 text-xs">{existing!.count}</span>}
                                      </button>
                                    )
                                  })}
                                </div>
                              </>
                            )}
                          </div>
                        )
                      })()}
                      {swipeRevealMessageId === m.id && (
                        <div className="flex items-center gap-2 mt-1.5 pl-11">
                          <button
                            type="button"
                            onClick={() => { setReplyingTo(m); setSwipeRevealMessageId(null) }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 text-sm"
                          >
                            <Reply size={14} />
                            Reply
                          </button>
                          {canPin && (
                            <button
                              type="button"
                              onClick={() => { handlePin(m); setSwipeRevealMessageId(null) }}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 text-sm"
                            >
                              <Pin size={14} />
                              Pin
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  </Fragment>
                      )
                    })}
                  </div>
                ))}
                <div ref={messagesEndRef} className="h-0 w-full shrink-0" aria-hidden />
                </div>
              )}
              </div>
            </div>

            {/* Fixed input bar - safe-area so it stays above browser UI on mobile */}
            {replyingTo && (
              <div className="shrink-0 flex items-center gap-2 px-4 py-2 bg-zinc-800/80 border-t border-zinc-800 text-sm text-zinc-400">
                <Reply size={14} className="shrink-0" />
                <span className="truncate flex-1">
                  Replying to {replyingTo.sender_nickname || replyingTo.sender_name}: {((replyingTo.content || '').slice(0, 50) || (replyingTo.image_data_url ? '[Image]' : ''))}…
                </span>
                {editingMessage && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingMessage(null)
                      setInput('')
                    }}
                    className="ml-2 text-xs text-zinc-500 hover:text-zinc-300"
                  >
                    Cancel edit
                  </button>
                )}
                <button type="button" onClick={() => setReplyingTo(null)} className="p-1 hover:text-white">
                  <X size={16} />
                </button>
              </div>
            )}
            {editingMessage && (
              <div className="shrink-0 flex items-center gap-2 px-4 py-2 bg-zinc-800/80 border-t border-zinc-800 text-sm text-zinc-400">
                <Pencil size={14} className="shrink-0" />
                <span className="truncate flex-1">Editing your message</span>
                <button
                  type="button"
                  onClick={() => {
                    setEditingMessage(null)
                    setInput('')
                  }}
                  className="p-1 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>
            )}
            {selectedImageDataUrl && (
              <div className="shrink-0 px-4 py-2 border-t border-zinc-800 bg-zinc-900/70">
                <div className="relative inline-block">
                  <img src={selectedImageDataUrl} alt="Selected attachment" className="max-h-32 rounded-lg border border-zinc-700 object-contain" />
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedImageDataUrl(null)
                      setSelectedImageName(null)
                    }}
                    className="absolute -top-2 -right-2 rounded-full bg-zinc-800 border border-zinc-600 p-1 text-zinc-300 hover:text-white"
                    aria-label="Remove image"
                  >
                    <X size={12} />
                  </button>
                </div>
                {selectedImageName && <p className="text-xs text-zinc-500 mt-1 truncate">{selectedImageName}</p>}
              </div>
            )}
            <form onSubmit={handleSend} className="shrink-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-zinc-800 bg-black">
              <div className="flex gap-2">
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePickImage}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0 bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800 min-h-[44px] min-w-[44px]"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={sending}
                  aria-label="Attach image"
                >
                  <Paperclip size={16} />
                </Button>
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={
                    editingMessage
                      ? 'Edit message...'
                      : replyingTo
                        ? `Reply to ${replyingTo.sender_nickname || replyingTo.sender_name}...`
                        : `Message #${activeChannel.name}`
                  }
                  disabled={sending}
                  className="flex-1 bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-500 min-h-[44px]"
                />
                <Button type="submit" disabled={sending || (!input.trim() && !selectedImageDataUrl)} size="icon" className="shrink-0 bg-white text-black hover:bg-zinc-200 min-h-[44px] min-w-[44px]">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : editingMessage ? <Pencil size={18} /> : <Send size={18} />}
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

      {/* Long-press / tap panel: portaled popup with reaction bar + action menu */}
      {longPressState &&
        createPortal(
          <>
            <div
              id="long-press-backdrop"
              role="presentation"
              className="fixed inset-0 bg-black/40 z-[9998]"
              style={{ touchAction: 'none' }}
              onClick={closeLongPressPanel}
            />
            <div
              id="long-press-panel"
              className="fixed z-[9999] flex flex-col rounded-xl bg-zinc-900 border border-zinc-700 shadow-2xl overflow-hidden"
              style={{
                left: Math.max(12, Math.min(
                  longPressState.rect.left + longPressState.rect.width / 2 - 120,
                  (typeof window !== 'undefined' ? window.innerWidth : 400) - 252,
                )),
                top: (() => {
                  const panelHeight = 200
                  const above = longPressState.rect.top - 12
                  const below = longPressState.rect.bottom + 12
                  const viewH = typeof window !== 'undefined' ? window.innerHeight : 800
                  if (below + panelHeight < viewH) return below
                  if (above - panelHeight > 0) return above - panelHeight
                  return Math.max(12, (viewH - panelHeight) / 2)
                })(),
                width: 240,
              }}
            >
              {/* Reaction bar: quick picks + "+" for full picker */}
              <div className="flex items-center justify-center gap-1 p-2 border-b border-zinc-700/50">
                {REACTION_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="p-2 rounded-lg hover:bg-zinc-800 active:bg-zinc-700 text-lg transition-colors"
                    onMouseDown={(e) => { e.stopPropagation(); e.preventDefault() }}
                    onClick={(e) => {
                      e.stopPropagation()
                      const msg = longPressState?.message
                      if (msg) toggleReaction(msg.id, emoji)
                      closeLongPressPanel()
                    }}
                  >
                    {emoji}
                  </button>
                ))}
                <button
                  type="button"
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-zinc-700 hover:bg-zinc-600 active:bg-zinc-500 transition-colors"
                  onMouseDown={(e) => { e.stopPropagation(); e.preventDefault() }}
                  onClick={(e) => {
                    e.stopPropagation()
                    const msg = longPressState?.message
                    const rect = longPressState?.rect
                    if (msg && rect) {
                      emojiPickerMessageRef.current = msg
                      setEmojiPickerTarget({ message: msg, rect })
                    }
                    closeLongPressPanel()
                  }}
                  aria-label="More reactions"
                >
                  <Plus size={22} className="text-white" />
                </button>
              </div>
              {/* Action buttons */}
              <div className="py-1">
                <button
                  type="button"
                  onClick={() => {
                    setReplyingTo(longPressState.message)
                    closeLongPressPanel()
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-zinc-200 hover:bg-zinc-800 active:bg-zinc-700 transition-colors"
                >
                  <Reply size={16} className="text-zinc-400" />
                  Reply
                </button>
                {canPin && (
                  <button
                    type="button"
                    onClick={() => handlePin(longPressState.message)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-zinc-200 hover:bg-zinc-800 active:bg-zinc-700 transition-colors"
                  >
                    <Pin size={16} className="text-zinc-400" />
                    {pinnedMessageId === longPressState.message.id ? 'Unpin message' : 'Pin message'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setInput(longPressState.message.content || '')
                    setEditingMessage(longPressState.message)
                    setReplyingTo(null)
                    setSelectedImageDataUrl(null)
                    setSelectedImageName(null)
                    closeLongPressPanel()
                  }}
                  disabled={longPressState.message.sender_id !== user?.id || longPressState.message.type !== 'text'}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-zinc-200 hover:bg-zinc-800 active:bg-zinc-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Pencil size={16} className="text-zinc-400" />
                  Edit message
                </button>
                <button
                  type="button"
                  onClick={() => handleCopy(longPressState.message)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-zinc-200 hover:bg-zinc-800 active:bg-zinc-700 transition-colors"
                >
                  <Copy size={16} className="text-zinc-400" />
                  Copy message
                </button>
              </div>
            </div>
          </>,
          document.body,
        )}

      {/* Standalone emoji picker — fully self-contained portal with native click handling */}
      {emojiPickerTarget && (() => {
        const targetMsg = emojiPickerMessageRef.current ?? emojiPickerTarget.message
        const targetRect = emojiPickerTarget.rect
        const handlePickEmoji = (emoji: string) => {
          const msgId = (emojiPickerMessageRef.current ?? targetMsg)?.id
          setEmojiPickerTarget(null)
          emojiPickerMessageRef.current = null
          if (msgId) toggleReaction(msgId, emoji)
        }
        const closePicker = () => {
          setEmojiPickerTarget(null)
          emojiPickerMessageRef.current = null
        }
        return createPortal(
          <div
            className="fixed inset-0 z-[9998]"
            onClick={closePicker}
          >
            <div className="fixed inset-0 bg-black/40" />
            <div
              className="fixed z-[9999] flex flex-col rounded-xl bg-zinc-900 border border-zinc-700 shadow-2xl"
              style={{
                left: Math.max(12, Math.min(
                  targetRect.left + targetRect.width / 2 - 140,
                  (typeof window !== 'undefined' ? window.innerWidth : 400) - 292,
                )),
                top: (() => {
                  const pickerHeight = 340
                  const above = targetRect.top - 12
                  const below = targetRect.bottom + 12
                  const viewH = typeof window !== 'undefined' ? window.innerHeight : 800
                  if (below + pickerHeight < viewH) return below
                  if (above - pickerHeight > 0) return above - pickerHeight
                  return Math.max(12, (viewH - pickerHeight) / 2)
                })(),
                width: 280,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-xs font-medium text-zinc-400 px-3 pt-2 pb-1">Pick a reaction</p>
              <div className="max-h-[300px] overflow-y-auto px-2 pb-2">
                {EMOJI_CATEGORIES.map((cat) => (
                  <div key={cat.label} className="mb-2">
                    <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider px-1 mb-1">{cat.label}</p>
                    <div className="flex flex-wrap gap-1">
                      {cat.emojis.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-zinc-800 active:bg-zinc-700 text-lg transition-colors cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation()
                            handlePickEmoji(emoji)
                          }}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>,
          document.body,
        )
      })()}

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
