import type { Channel, Message } from '@membercore/core'
import { getApi } from './api'

export interface ListMessagesResponse {
  messages: Message[]
  last_read_message_id?: string | null
  last_read_timestamp?: string | null
}

export interface SendMessagePayload {
  content: string
  image_data_url?: string
  type?: 'text' | 'event' | 'poll'
  reply_to_message_id?: string
  reply_to_snippet?: string
  event_data?: Record<string, unknown>
  poll_data?: Record<string, unknown>
}

export interface ChannelReadState {
  channel_id: string
  last_read_message_id: string
  last_read_timestamp: string
}

export interface ChatSummary {
  summary: string[]
  message_count: number
}

export const chatService = {
  async listChannels(orgId: string): Promise<Channel[]> {
    const { data } = await getApi().get(`/chat/${orgId}/channels`)
    return data
  },

  async createChannel(
    orgId: string,
    payload: { name: string; description?: string; is_restricted?: boolean; allowed_roles?: string[]; allowed_members?: string[] },
  ): Promise<Channel> {
    const { data } = await getApi().post(`/chat/${orgId}/channels`, payload)
    return data
  },

  async updateChannel(
    orgId: string,
    channelId: string,
    payload: Partial<Channel>,
  ): Promise<Channel> {
    const { data } = await getApi().put(
      `/chat/${orgId}/channels/${channelId}`,
      payload,
    )
    return data
  },

  async deleteChannel(orgId: string, channelId: string): Promise<void> {
    await getApi().delete(`/chat/${orgId}/channels/${channelId}`)
  },

  async listMessages(
    orgId: string,
    channelId: string,
    before?: string,
  ): Promise<ListMessagesResponse> {
    const params: Record<string, string> = {}
    if (before) params.before = before
    const { data } = await getApi().get(
      `/chat/${orgId}/channels/${channelId}/messages`,
      { params },
    )
    return data
  },

  async sendMessage(
    orgId: string,
    channelId: string,
    payload: SendMessagePayload,
  ): Promise<Message> {
    const { data } = await getApi().post(
      `/chat/${orgId}/channels/${channelId}/messages`,
      payload,
    )
    return data
  },

  async toggleReaction(
    orgId: string,
    channelId: string,
    messageId: string,
    emoji: string,
  ): Promise<{ reactions: Message['reactions'] }> {
    const { data } = await getApi().post(
      `/chat/${orgId}/channels/${channelId}/messages/${messageId}/reactions`,
      { emoji },
    )
    return data
  },

  async pinMessage(
    orgId: string,
    channelId: string,
    messageId: string,
  ): Promise<void> {
    await getApi().put(
      `/chat/${orgId}/channels/${channelId}/pin`,
      { message_id: messageId },
    )
  },

  async unpinMessage(
    orgId: string,
    channelId: string,
  ): Promise<void> {
    await getApi().delete(`/chat/${orgId}/channels/${channelId}/pin`)
  },

  async getReadState(
    orgId: string,
    channelId: string,
  ): Promise<ChannelReadState | null> {
    const { data } = await getApi().get(
      `/chat/${orgId}/channels/${channelId}/read`,
    )
    return data
  },

  async updateReadState(
    orgId: string,
    channelId: string,
    messageId: string,
  ): Promise<void> {
    await getApi().put(`/chat/${orgId}/channels/${channelId}/read`, {
      last_read_message_id: messageId,
    })
  },

  async getSummary(
    orgId: string,
    channelId: string,
  ): Promise<ChatSummary> {
    const { data } = await getApi().post(
      `/chat/${orgId}/channels/${channelId}/summary`,
    )
    return data
  },

  getWsUrl(orgId: string, baseUrl: string): string {
    if (baseUrl.startsWith('http')) {
      const wsBase = baseUrl.replace(/^http/, 'ws')
      return `${wsBase.replace(/\/$/, '')}/chat/${orgId}/ws`
    }
    if (typeof window !== 'undefined') {
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      return `${proto}//${window.location.host}${baseUrl}/chat/${orgId}/ws`
    }
    return `ws://localhost:8000${baseUrl}/chat/${orgId}/ws`
  },
}
