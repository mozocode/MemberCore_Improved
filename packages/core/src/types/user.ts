export interface User {
  id: string
  email: string
  name: string
  avatar?: string | null
  phone_number?: string | null
  is_platform_admin?: boolean
  is_active?: boolean
  created_at?: string | null
  updated_at?: string | null
}

export interface Member {
  id: string
  user_id: string
  organization_id: string
  role: 'owner' | 'admin' | 'member' | 'restricted'
  status: 'approved' | 'pending' | 'rejected'
  title?: string | null
  nickname?: string | null
  role_label?: string | null
  allowed_channels?: string[]
  joined_at?: string | null
  approved_at?: string | null
  approved_by?: string | null
}
