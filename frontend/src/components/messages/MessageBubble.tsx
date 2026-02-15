import { formatTime } from '@/lib/dateUtils'

interface Message {
  id: string
  sender_id: string
  text: string
  sent_at?: string | null
}

interface MessageBubbleProps {
  message: Message
  isOwn: boolean
}

export function MessageBubble({ message, isOwn }: MessageBubbleProps) {
  const sentAt = message.sent_at

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`
          max-w-[75%] md:max-w-[60%] px-4 py-2.5 rounded-2xl
          ${isOwn
            ? 'bg-blue-600 text-white rounded-br-md'
            : 'bg-zinc-800 text-white rounded-bl-md'}
        `}
      >
        <p className="text-sm whitespace-pre-wrap break-words">{message.text}</p>
        <p className={`text-xs mt-1 ${isOwn ? 'text-blue-200' : 'text-zinc-500'}`}>
          {formatTime(sentAt)}
        </p>
      </div>
    </div>
  )
}
