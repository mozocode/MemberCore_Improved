import { useState, useEffect, useRef } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'
import { ConversationList } from '@/components/messages/ConversationList'
import { ChatView } from '@/components/messages/ChatView'
import { NewMessageModal } from '@/components/messages/NewMessageModal'
import { MessageSquare, PenSquare, Loader2 } from 'lucide-react'
import type { Conversation } from '@/components/messages/ConversationItem'

export function OrgMessages() {
  const { orgId } = useParams<{ orgId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeConversationId = searchParams.get('c')
  const { user } = useAuth()

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewMessage, setShowNewMessage] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!user?.id || !orgId) return
    function fetchConvs() {
      api
        .get(`/organizations/${orgId}/dm/conversations`)
        .then((r) => setConversations(r.data || []))
        .catch(() => setConversations([]))
        .finally(() => setLoading(false))
    }
    fetchConvs()
    pollRef.current = setInterval(fetchConvs, 5000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [orgId, user?.id])

  useEffect(() => {
    if (activeConversationId && user?.id) {
      api
        .post(`/organizations/${orgId}/dm/conversations/${activeConversationId}/read`)
        .catch(() => {})
    }
  }, [activeConversationId, orgId, user?.id])

  const handleSelectConversation = (convId: string) => {
    setSearchParams({ c: convId })
  }

  const handleStartNewConversation = async (otherUser: { id: string; name?: string; email?: string; avatar?: string }) => {
    if (!user || !orgId) return
    try {
      const { data } = await api.post(`/organizations/${orgId}/dm/conversations`, {
        other_user_id: otherUser.id,
      })
      setSearchParams({ c: data.id })
      setShowNewMessage(false)
    } catch (err) {
      console.error('Failed to create conversation:', err)
    }
  }

  if (!user) return null

  return (
    <div className="flex h-[calc(100vh-4rem)] lg:h-[calc(100vh-3rem)] -m-4 md:-m-6 lg:-m-8">
      {/* Conversation list */}
      <div
        className={`
          w-full lg:w-96 border-r border-zinc-800 bg-black flex flex-col shrink-0
          ${activeConversationId ? 'hidden lg:flex' : 'flex'}
        `}
      >
        <div className="p-4 border-b border-zinc-800 shrink-0">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-white">Messages</h1>
            <button
              type="button"
              onClick={() => setShowNewMessage(true)}
              className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="New message"
            >
              <PenSquare className="w-5 h-5" />
            </button>
          </div>
        </div>
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
          </div>
        ) : (
          <ConversationList
            conversations={conversations}
            activeId={activeConversationId}
            currentUserId={user.id}
            onSelect={handleSelectConversation}
          />
        )}
      </div>

      {/* Chat view */}
      <div
        className={`
          flex-1 flex flex-col bg-zinc-950 min-w-0
          ${activeConversationId ? 'flex' : 'hidden lg:flex'}
        `}
      >
        {activeConversationId ? (
          <ChatView
            conversationId={activeConversationId}
            orgId={orgId!}
            currentUser={user}
            onBack={() => setSearchParams({})}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
              <h2 className="text-xl font-medium text-white mb-2">Your Messages</h2>
              <p className="text-zinc-400 mb-4">Select a conversation or start a new one</p>
              <button
                type="button"
                onClick={() => setShowNewMessage(true)}
                className="px-4 py-2 bg-white text-black rounded-lg font-medium hover:bg-zinc-200 min-h-[44px]"
              >
                Start a Conversation
              </button>
            </div>
          </div>
        )}
      </div>

      {showNewMessage && (
        <NewMessageModal
          orgId={orgId!}
          onClose={() => setShowNewMessage(false)}
          onSelectMember={handleStartNewConversation}
        />
      )}
    </div>
  )
}
