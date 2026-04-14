import type { Conversation } from './ConversationItem'
import { ConversationItem } from './ConversationItem'

interface ConversationListProps {
  conversations: Conversation[]
  activeId: string | null
  currentUserId: string
  onSelect: (convId: string) => void
}

export function ConversationList({ conversations, activeId, currentUserId, onSelect }: ConversationListProps) {
  if (conversations.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <p className="text-zinc-500 text-center text-sm">
          No conversations yet.<br />
          Start messaging a member!
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 min-w-0 max-w-full overflow-y-auto overflow-x-hidden">
      {conversations.map((conv) => (
        <ConversationItem
          key={conv.id}
          conversation={conv}
          currentUserId={currentUserId}
          isActive={conv.id === activeId}
          onClick={() => onSelect(conv.id)}
        />
      ))}
    </div>
  )
}
