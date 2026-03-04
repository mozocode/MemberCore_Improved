export interface PollOption {
  id: string
  text: string
  vote_count: number
}

export interface Poll {
  id: string
  question: string
  description?: string
  options: PollOption[]
  allow_multiple_votes: boolean
  is_anonymous: boolean
  ends_at?: string
  is_open: boolean
  total_votes: number
  my_votes: string[]
  created_at: string
}
