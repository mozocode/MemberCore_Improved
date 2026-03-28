import { useRef, useEffect } from 'react'
import { formatTime } from '@/lib/dateUtils'
import { REACTION_EMOJIS } from '@membercore/core'

const LONG_PRESS_MS = 500
const MOVE_THRESHOLD_PX = 12

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

interface MessageBubbleProps {
  message: Message
  isOwn: boolean
  canEdit?: boolean
  onEdit?: (message: Message) => void
  onToggleReaction?: (messageId: string, emoji: string) => void
  onOpenEmojiPicker?: (messageId: string) => void
  /** True after user long-presses this bubble (edit + quick reactions visible). */
  showActions?: boolean
  onLongPressActivate?: () => void
}

export function MessageBubble({
  message,
  isOwn,
  canEdit = false,
  onEdit,
  onToggleReaction,
  onOpenEmojiPicker,
  showActions = false,
  onLongPressActivate,
}: MessageBubbleProps) {
  const sentAt = message.sent_at
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pointerStart = useRef<{ x: number; y: number } | null>(null)

  const cancelLongPressTimer = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
    pointerStart.current = null
  }

  useEffect(() => () => cancelLongPressTimer(), [])

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`
          max-w-[75%] md:max-w-[60%] px-4 py-2.5 rounded-2xl touch-manipulation
          ${isOwn
            ? 'bg-blue-600 text-white rounded-br-md'
            : 'bg-zinc-800 text-white rounded-bl-md'}
        `}
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={(e) => {
          if (e.button !== 0) return
          if ((e.target as HTMLElement).closest('button, a[href]')) return
          pointerStart.current = { x: e.clientX, y: e.clientY }
          cancelLongPressTimer()
          longPressTimer.current = setTimeout(() => {
            longPressTimer.current = null
            onLongPressActivate?.()
          }, LONG_PRESS_MS)
        }}
        onPointerMove={(e) => {
          if (!pointerStart.current || !longPressTimer.current) return
          const dx = e.clientX - pointerStart.current.x
          const dy = e.clientY - pointerStart.current.y
          if (dx * dx + dy * dy > MOVE_THRESHOLD_PX * MOVE_THRESHOLD_PX) {
            cancelLongPressTimer()
          }
        }}
        onPointerUp={cancelLongPressTimer}
        onPointerCancel={cancelLongPressTimer}
        data-message-bubble-id={message.id}
      >
        {showActions && canEdit && onEdit && (
          <button
            type="button"
            onClick={() => onEdit(message)}
            className={`text-[11px] mb-1 underline ${isOwn ? 'text-blue-200' : 'text-zinc-400'}`}
          >
            Edit
          </button>
        )}
        {message.image_data_url && (
          <img
            src={message.image_data_url}
            alt="Message attachment"
            className="rounded-lg mb-2 max-h-72 w-auto object-contain border border-zinc-700"
          />
        )}
        {message.text && <p className="text-sm whitespace-pre-wrap break-words">{message.text}</p>}
        {message.link_preview?.url && (
          <a
            href={message.link_preview.url}
            target="_blank"
            rel="noreferrer"
            className="mt-2 block rounded-xl border border-zinc-700 bg-zinc-900 overflow-hidden hover:border-zinc-600 transition-colors"
          >
            {message.link_preview.image ? (
              <img
                src={message.link_preview.image}
                alt={message.link_preview.title || 'Link preview'}
                className="w-full max-h-40 object-cover bg-zinc-800"
              />
            ) : null}
            <div className="p-2.5">
              {message.link_preview.site_name && (
                <p className="text-[10px] uppercase tracking-wide text-zinc-500">{message.link_preview.site_name}</p>
              )}
              <p className="text-xs font-semibold text-white mt-1 break-words">
                {message.link_preview.title || message.link_preview.url}
              </p>
              {message.link_preview.description && (
                <p className="text-[11px] text-zinc-400 mt-1 break-words">{message.link_preview.description}</p>
              )}
            </div>
          </a>
        )}
        <p className={`text-xs mt-1 ${isOwn ? 'text-blue-200' : 'text-zinc-500'}`}>
          {formatTime(sentAt)}
          {message.edited_at ? ' • edited' : ''}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {(message.reactions || []).filter((r) => r.count > 0).map((r) => (
            <button
              key={r.emoji}
              type="button"
              onClick={() => onToggleReaction?.(message.id, r.emoji)}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border ${
                r.reactedByMe
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                  : 'bg-zinc-900/70 border-zinc-700 text-zinc-300'
              }`}
            >
              <span>{r.emoji}</span>
              <span>{r.count}</span>
            </button>
          ))}
          {showActions &&
            REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onToggleReaction?.(message.id, emoji)}
                className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-zinc-700 bg-zinc-900/60 text-sm hover:bg-zinc-800"
                aria-label={`React ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          {showActions && (
            <button
              type="button"
              onClick={() => onOpenEmojiPicker?.(message.id)}
              className="inline-flex items-center justify-center w-7 h-7 rounded-full border border-zinc-700 bg-zinc-900/60 text-sm hover:bg-zinc-800"
              aria-label="More reactions"
            >
              +
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
