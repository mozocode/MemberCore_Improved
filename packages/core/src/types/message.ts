export interface ReactionAggregate {
  emoji: string
  count: number
  reactedByMe: boolean
}

export interface Channel {
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

export interface EventData {
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

export interface PollData {
  id: string
  question: string
  options?: { id: string; text: string }[]
}

export interface Message {
  id: string
  channel_id: string
  sender_id: string
  sender_name: string
  sender_nickname?: string | null
  sender_avatar?: string | null
  content: string
  image_data_url?: string | null
  type: 'text' | 'event' | 'poll'
  created_at: string
  reply_to_message_id?: string | null
  reply_to_snippet?: string | null
  reactions?: ReactionAggregate[]
  event_data?: EventData
  poll_data?: PollData
  poll_options?: string[]
}
