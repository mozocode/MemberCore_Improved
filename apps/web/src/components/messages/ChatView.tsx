import { useState, useEffect, useRef } from 'react'
import { ArrowLeft, Send, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { MessageBubble } from './MessageBubble'

interface Message {
  id: string
  sender_id: string
  text: string
  sent_at?: string | null
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
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    api
      .get(`/organizations/${orgId}/dm/conversations/${conversationId}`)
      .then((r) => setConversation(r.data))
      .catch(() => setConversation(null))
  }, [orgId, conversationId])

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
    if (!newMessage.trim() || sending) return
    const text = newMessage.trim()
    setNewMessage('')
    setSending(true)
    try {
      const { data } = await api.post(`/organizations/${orgId}/dm/conversations/${conversationId}/messages`, {
        text,
      })
      setMessages((prev) => [...prev, data])
    } catch {
      setNewMessage(text)
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  const grouped = groupMessagesByDate(messages)

  return (
    <div className="flex flex-col h-full">
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
              <h2 className="font-medium text-white truncate">{otherParticipant.name}</h2>
              {otherParticipant.email && (
                <p className="text-xs text-zinc-500 truncate">{otherParticipant.email}</p>
              )}
            </div>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
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
                    />
                  ))}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <form onSubmit={handleSend} className="p-4 border-t border-zinc-800 bg-black shrink-0">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={`Message ${otherParticipant?.name || ''}...`}
            className="flex-1 bg-zinc-900 border border-zinc-700 rounded-full px-4 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600"
            disabled={sending}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="p-2.5 bg-white text-black rounded-full disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-200 min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>
  )
}
