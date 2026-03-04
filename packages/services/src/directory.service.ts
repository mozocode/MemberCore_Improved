import type { Member } from '@membercore/core'
import { getApi } from './api'

export const directoryService = {
  async list(orgId: string): Promise<Member[]> {
    const { data } = await getApi().get(`/organizations/${orgId}/members`)
    return data
  },

  async get(orgId: string, memberId: string): Promise<Member> {
    const { data } = await getApi().get(`/organizations/${orgId}/members/${memberId}`)
    return data
  },

  async updateRole(orgId: string, memberId: string, role: string): Promise<void> {
    await getApi().put(`/organizations/${orgId}/members/${memberId}`, { role })
  },

  async removeMember(orgId: string, memberId: string): Promise<void> {
    await getApi().delete(`/organizations/${orgId}/members/${memberId}`)
  },

  async search(orgId: string, query: string): Promise<Member[]> {
    const { data } = await getApi().get(`/organizations/${orgId}/members`, {
      params: { search: query },
    })
    return data
  },
}
