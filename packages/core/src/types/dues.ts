export interface DuesPlan {
  id: string
  name: string
  amount: number
  total_amount?: number
  due_date?: string
  frequency: string
  payment_option?: 'full_only' | 'custom_only'
}

export interface Payment {
  id: string
  amount: number
  payment_method: string
  plan_id?: string
  created_at: string
}

export interface DuesStatus {
  status: string
  /** Admin override on the member record — when true, treat balance as satisfied regardless of totals. */
  dues_paid_in_full?: boolean
  total_paid: number
  plans: DuesPlan[]
  payment_history: Payment[]
  member_id: string | null
}
