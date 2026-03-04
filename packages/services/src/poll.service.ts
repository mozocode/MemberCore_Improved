import type { Poll } from '@membercore/core'
import { getApi } from './api'

export const pollService = {
  async list(orgId: string): Promise<Poll[]> {
    const { data } = await getApi().get(`/polls/${orgId}`)
    return data
  },

  async get(orgId: string, pollId: string): Promise<Poll> {
    const { data } = await getApi().get(`/polls/${orgId}/${pollId}`)
    return data
  },

  async create(
    orgId: string,
    payload: { question: string; description?: string; options: string[]; allow_multiple_votes?: boolean; is_anonymous?: boolean; ends_at?: string },
  ): Promise<Poll> {
    const { data } = await getApi().post(`/polls/${orgId}`, payload)
    return data
  },

  async vote(orgId: string, pollId: string, optionIds: string[]): Promise<void> {
    await getApi().post(`/polls/${orgId}/${pollId}/vote`, { option_ids: optionIds })
  },

  async close(orgId: string, pollId: string): Promise<void> {
    await getApi().put(`/polls/${orgId}/${pollId}/close`)
  },

  async delete(orgId: string, pollId: string): Promise<void> {
    await getApi().delete(`/polls/${orgId}/${pollId}`)
  },
}
