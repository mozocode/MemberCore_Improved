import { getApi } from './api'

export interface Organization {
  id: string
  name: string
  type?: string
  avatar?: string
  description?: string
  is_verified?: boolean
  is_pro?: boolean
  member_count?: number
  my_role?: string
  my_status?: string
}

export const organizationService = {
  async list(): Promise<Organization[]> {
    const { data } = await getApi().get('/organizations')
    return data
  },

  async get(orgId: string): Promise<Organization> {
    const { data } = await getApi().get(`/organizations/${orgId}`)
    return data
  },

  async create(payload: { name: string; type?: string; description?: string }): Promise<Organization> {
    const { data } = await getApi().post('/organizations', payload)
    return data
  },

  async update(orgId: string, payload: Partial<Organization>): Promise<Organization> {
    const { data } = await getApi().put(`/organizations/${orgId}`, payload)
    return data
  },

  async delete(orgId: string): Promise<void> {
    await getApi().delete(`/organizations/${orgId}`)
  },

  async join(orgId: string): Promise<void> {
    await getApi().post(`/organizations/${orgId}/join`)
  },
}
