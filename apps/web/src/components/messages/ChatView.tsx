import { useState, useEffect, useRef } from 'react'
import { ArrowLeft, Send, Loader2, Paperclip, X } from 'lucide-react'
import { api } from '@/lib/api'
import { MessageBubble } from './MessageBubble'
import { compressImageFile } from '@/lib/imageCompression'
import { EMOJI_CATEGORIES } from '@membercore/core'

interface Message {
  id: string
  sender_id: string
  text: string
  image_data_url?: string | null
  link_preview?: {
    url: string
    title?: string
    description?: string
    image?: string
    site_name?: string
  } | null
  edited_at?: string | null
  sent_at?: string | null
  reactions?: { emoji: string; count: number; reactedByMe: boolean }[]
}

interface Conversation {
  id: string
  participants: string[]
  participant_details?: Record<string, { name?: string; email?: string; avatar?: string }>
  other_participant?: { id: string; name?: string; email?: string; avatar?: string }
}

interface ChatViewProps {
  conversationId: string
  orgId: string
  currentUser: { id: string; name?: string; email?: string; avatar?: string }
  onBack: () => void
}

function groupMessagesByDate(messages: Message[]): Record<string, Message[]> {
  const groups: Record<string, Message[]> = {}
  const today = new Date().toDateString()
  const yesterday = new Date(Date.now() - 86400000).toDateString()

  messages.forEach((msg) => {
    const msgDate = msg.sent_at ? new Date(msg.sent_at).toDateString() : today
    let label: string
    if (msgDate === today) {
      label = 'Today'
    } else if (msgDate === yesterday) {
      label = 'Yesterday'
    } else {
      label = msg.sent_at
        ? new Date(msg.sent_at).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
        : 'Today'
    }
    if (!groups[label]) groups[label] = []
    groups[label].push(msg)
  })

  return groups
}

export function ChatView({ conversationId, orgId, currentUser, onBack }: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [newMessage, setNewMessage] = useState('')
  const [selectedImageDataUrl, setSelectedImageDataUrl] = useState<string | null>(null)
  const [selectedImageName, setSelectedImageName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [editingMessage, setEditingMessage] = useState<Message | null>(null)
  const [emojiPickerMessageId, setEmojiPickerMessageId] = useState<string | null>(null)
  const [messageActionsId, setMessageActionsId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    api
      .get(`/organizations/${orgId}/dm/conversations/${conversationId}`)
      .then((r) => setConversation(r.data))
      .catch(() => setConversation(null))
    setEditingMessage(null)
    setNewMessage('')
    setSelectedImageDataUrl(null)
    setSelectedImageName(null)
    setMessageActionsId(null)
  }, [orgId, conversationId])

  useEffect(() => {
    if (!messageActionsId) return
    const closeIfOutside = (e: PointerEvent) => {
      const el = (e.target as HTMLElement).closest('[data-message-bubble-id]')
      const id = el?.getAttribute('data-message-bubble-id')
      if (id === messageActionsId) return
      setMessageActionsId(null)
    }
    document.addEventListener('pointerdown', closeIfOutside, true)
    return () => document.removeEventListener('pointerdown', closeIfOutside, true)
  }, [messageActionsId])

  useEffect(() => {
    function fetchMessages() {
      api
        .get(`/organizations/${orgId}/dm/conversations/${conversationId}/messages`)
        .then((r) => {
          setMessages(r.data || [])
          setLoading(false)
        })
        .catch(() => setMessages([]))
        .finally(() => setLoading(false))
    }
    fetchMessages()
    pollRef.current = setInterval(fetchMessages, 3000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [orgId, conversationId])

  useEffect(() => {
    if (currentUser?.id) {
      api.post(`/organizations/${orgId}/dm/conversations/${conversationId}/read`).catch(() => {})
    }
  }, [orgId, conversationId, currentUser?.id, messages.length])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const otherParticipant = conversation?.other_participant ?? null

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if ((!newMessage.trim() && !selectedImageDataUrl) || sending) return
    const text = newMessage.trim()
    setNewMessage('')
    setSending(true)
    try {
      if (editingMessage) {
        const { data } = await api.patch(
          `/organizations/${orgId}/dm/conversations/${conversationId}/messages/${editingMessage.id}`,
          { text },
        )
        setMessages((prev) =>
          prev.map((m) => (m.id === editingMessage.id ? { ...m, text, edited_at: data?.edited_at || new Date().toISOString() } : m)),
        )
        setEditingMessage(null)
      } else {
        const { data } = await api.post(`/organizations/${orgId}/dm/conversations/${conversationId}/messages`, {
          text,
          image_data_url: selectedImageDataUrl,
        })
        setMessages((prev) => [...prev, data])
        setSelectedImageDataUrl(null)
        setSelectedImageName(null)
      }
    } catch {
      setNewMessage(text)
    } finally {
      setSending(false)
      inputRef.current?.focus()
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
      // Ignore invalid image selection and allow retry.
    }
  }

  const grouped = groupMessagesByDate(messages)

  const toggleReaction = async (messageId: string, emoji: string) => {
    try {
      const { data } = await api.post(
        `/organizations/${orgId}/dm/conversations/${conversationId}/messages/${messageId}/reactions`,
        { emoji },
      )
      const reactions = data?.reactions || []
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, reactions } : m)))
    } catch {
      // ignore reaction errors
    }
  }

  const handleDeleteMessage = async (message: Message) => {
    if (!message?.id) return
    const confirmed = window.confirm('Delete this message? This cannot be undone.')
    if (!confirmed) return

    try {
      await api.delete(`/organizations/${orgId}/dm/conversations/${conversationId}/messages/${message.id}`)
      setMessages((prev) => prev.filter((m) => m.id !== message.id))
      if (editingMessage?.id === message.id) {
        setEditingMessage(null)
        setNewMessage('')
      }
      setMessageActionsId(null)
    } catch {
      window.alert('Failed to delete message. Please try again.')
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800 bg-black shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="lg:hidden p-2 -ml-2 text-zinc-400 hover:text-white rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        {otherParticipant && (
          <>
            {otherParticipant.avatar ? (
              <img
                src={otherParticipant.avatar}
                alt=""
                className="w-10 h-10 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center shrink-0">
                <span className="font-medium text-white">
                  {(otherParticipant.name || '?').charAt(0)}
                </span>
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="font-medium text-white truncate">{otherParticipant.name || 'Member'}</h2>
            </div>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-32 lg:pb-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-zinc-500 text-center">
              No messages yet.<br />
              Say hello! 👋
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([date, msgs]) => (
              <div key={date}>
                <div className="flex items-center justify-center my-4">
                  <span className="px-3 py-1 text-xs text-zinc-500 bg-zinc-800/50 rounded-full">
                    {date}
                  </span>
                </div>
                <div className="space-y-2">
                  {msgs.map((msg) => (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      isOwn={msg.sender_id === currentUser?.id}
                      canEdit={msg.sender_id === currentUser?.id}
                      canDelete={msg.sender_id === currentUser?.id}
                      showActions={messageActionsId === msg.id}
                      onLongPressActivate={() => setMessageActionsId(msg.id)}
                      onEdit={(m) => {
                        setMessageActionsId(null)
                        setEditingMessage(m)
                        setNewMessage(m.text || '')
                        setSelectedImageDataUrl(null)
                        setSelectedImageName(null)
                      }}
                      onDelete={handleDeleteMessage}
                      onOpenActions={(messageId) => {
                        setEmojiPickerMessageId(null)
                        setMessageActionsId((prev) => (prev === messageId ? null : messageId))
                      }}
                      onToggleReaction={toggleReaction}
                      onOpenEmojiPicker={(messageId) => {
                        setMessageActionsId(null)
                        setEmojiPickerMessageId(messageId)
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <form
        onSubmit={handleSend}
        className="fixed bottom-0 left-0 right-0 z-20 p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-zinc-800 bg-black shrink-0 lg:static lg:z-auto lg:pb-4"
      >
        {editingMessage && (
          <div className="mb-2 flex items-center justify-between rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300">
            <span>Editing your message</span>
            <button
              type="button"
              onClick={() => {
                setEditingMessage(null)
                setNewMessage('')
              }}
              className="text-zinc-500 hover:text-zinc-300"
            >
              Cancel
            </button>
          </div>
        )}
        {selectedImageDataUrl && (
          <div className="mb-3">
            <div className="relative inline-block">
              <img
                src={selectedImageDataUrl}
                alt="Selected attachment"
                className="max-h-32 rounded-lg border border-zinc-700 object-contain"
              />
              <button
                type="button"
                onClick={() => {
                  setSelectedImageDataUrl(null)
                  setSelectedImageName(null)
                }}
                className="absolute -top-2 -right-2 rounded-full bg-zinc-800 border border-zinc-600 p-1 text-zinc-300 hover:text-white"
                aria-label="Remove image"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            {selectedImageName && <p className="text-xs text-zinc-500 mt-1 truncate">{selectedImageName}</p>}
          </div>
        )}
        <div className="flex items-center gap-2">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePickImage}
          />
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            className="p-2.5 bg-zinc-900 text-zinc-200 rounded-full border border-zinc-700 hover:bg-zinc-800 min-h-[44px] min-w-[44px] flex items-center justify-center"
            disabled={sending}
            aria-label="Attach image"
          >
            <Paperclip className="w-4 h-4" />
          </button>
          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={editingMessage ? 'Edit message...' : `Message ${otherParticipant?.name || ''}...`}
            className="flex-1 bg-zinc-900 border border-zinc-700 rounded-full px-4 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={(!newMessage.trim() && !selectedImageDataUrl) || sending}
            className="p-2.5 bg-white text-black rounded-full disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-200 min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            {editingMessage ? 'Save' : <Send className="w-5 h-5" />}
          </button>
        </div>
      </form>
      {emojiPickerMessageId && (
        <div className="fixed inset-0 z-[9998]" onClick={() => setEmojiPickerMessageId(null)}>
          <div className="fixed inset-0 bg-black/50" />
          <div
            className="fixed left-1/2 top-1/2 z-[9999] w-[320px] max-w-[calc(100vw-24px)] max-h-[70vh] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-700">
              <p className="text-xs font-medium text-zinc-400">Pick a reaction</p>
              <button type="button" onClick={() => setEmojiPickerMessageId(null)} className="text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto px-2 py-2">
              {EMOJI_CATEGORIES.map((cat) => (
                <div key={cat.label} className="mb-2">
                  <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider px-1 mb-1">{cat.label}</p>
                  <div className="flex flex-wrap gap-1">
                    {cat.emojis.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-zinc-800 text-lg"
                        onClick={() => {
                          toggleReaction(emojiPickerMessageId, emoji)
                          setEmojiPickerMessageId(null)
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
        </div>
      )}
    </div>
  )
}
