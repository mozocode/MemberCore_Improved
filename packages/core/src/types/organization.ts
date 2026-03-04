export interface Member {
  id: string
  user_id: string
  role: string
  status: string
  title?: string
  nickname?: string
  name: string
  email: string
  avatar?: string
  initial: string
}

export type MemberRole = 'owner' | 'admin' | 'member' | 'restricted'
export type MemberStatus = 'approved' | 'pending' | 'rejected' | 'suspended'
