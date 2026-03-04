import { formatRelativeTime } from '@/lib/dateUtils'

export interface Conversation {
  id: string
  participants: string[]
  participant_details?: Record<string, { name?: string; email?: string; avatar?: string }>
  other_participant?: { id: string; name?: string; email?: string; avatar?: string }
  created_at?: string | null
  updated_at?: string | null
  last_message?: { text: string; sender_id: string; sent_at?: string } | null
  unread_count?: number
}

interface ConversationItemProps {
  conversation: Conversation
  currentUserId: string
  isActive: boolean
  onClick: () => void
}

export function ConversationItem({ conversation, currentUserId, isActive, onClick }: ConversationItemProps) {
  const other = conversation.other_participant
  const unread = conversation.unread_count ?? 0
  const updatedAt = conversation.updated_at || conversation.last_message?.sent_at

  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 p-4 text-left min-h-[44px]
        border-b border-zinc-800/50 transition-colors
        ${isActive ? 'bg-zinc-800' : 'hover:bg-zinc-900'}
      `}
    >
      <div className="relative shrink-0">
        {other?.avatar ? (
          <img
            src={other.avatar}
            alt=""
            className="w-12 h-12 rounded-full object-cover"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-zinc-700 flex items-center justify-center">
            <span className="text-lg font-medium text-white">
              {(other?.name || '?').charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-blue-500 rounded-full text-xs text-white flex items-center justify-center font-medium">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={`font-medium truncate ${unread > 0 ? 'text-white' : 'text-zinc-300'}`}>
            {other?.name || 'Unknown'}
          </span>
          <span className="text-xs text-zinc-500 shrink-0">
            {updatedAt ? formatRelativeTime(updatedAt) : ''}
          </span>
        </div>
        {conversation.last_message && (
          <p className={`text-sm truncate mt-0.5 ${unread > 0 ? 'text-zinc-300 font-medium' : 'text-zinc-500'}`}>
            {conversation.last_message.sender_id === currentUserId ? 'You: ' : ''}
            {conversation.last_message.text}
          </p>
        )}
      </div>
    </button>
  )
}
