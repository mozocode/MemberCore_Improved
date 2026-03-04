export interface Attendee {
  user_id: string
  name: string
  initial: string
  avatar?: string
}

export interface Event {
  id: string
  title: string
  description?: string
  location?: string
  start_time: string
  end_time?: string
  all_day?: boolean
  cover_image?: string
  is_paid?: boolean
  price?: number
  tickets_sold?: number
  max_attendees?: number
  event_type?: string
  my_rsvp?: string
  rsvp_counts?: { yes: number; maybe: number; no: number }
  attendees?: { yes: Attendee[]; maybe: Attendee[]; no: Attendee[] }
  created_by?: string
}

export interface TicketDetail {
  ticket_id: string
  short_code?: string
  event_id: string
  event_title: string
  event_start_time?: string
  event_end_time?: string
  event_location?: string
  event_cover_image?: string
  organization_id: string
  organization_name: string
  status: string
  checked_in: boolean
  checked_in_at?: string
  amount: number
  amount_cents?: number
  quantity: number
  purchased_at?: string
  qr_code?: string
}
