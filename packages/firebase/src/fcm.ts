export interface DeviceToken {
  token: string
  platform: 'ios' | 'android' | 'web'
  last_active: string
  org_ids: string[]
}

export interface NotificationPayload {
  title: string
  body: string
  data?: Record<string, string>
  channel_id?: string
}

export const FCM_TOPICS = {
  orgChannel: (orgId: string, channelId: string) =>
    `org_${orgId}_channel_${channelId}`,
  orgEvents: (orgId: string) => `org_${orgId}_events`,
  orgDues: (orgId: string) => `org_${orgId}_dues`,
} as const
