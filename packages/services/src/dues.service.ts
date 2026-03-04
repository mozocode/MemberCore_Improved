import type { DuesPlan, DuesStatus } from '@membercore/core'
import { getApi } from './api'

export const duesService = {
  async getStatus(orgId: string): Promise<DuesStatus> {
    const { data } = await getApi().get(`/dues/${orgId}/my-status`)
    return data
  },

  async listPlans(orgId: string): Promise<DuesPlan[]> {
    const { data } = await getApi().get(`/dues/${orgId}/plans`)
    return data
  },

  async createPlan(orgId: string, plan: Partial<DuesPlan>): Promise<DuesPlan> {
    const { data } = await getApi().post(`/dues/${orgId}/plans`, plan)
    return data
  },

  async updatePlan(orgId: string, planId: string, updates: Partial<DuesPlan>): Promise<DuesPlan> {
    const { data } = await getApi().put(`/dues/${orgId}/plans/${planId}`, updates)
    return data
  },

  async deletePlan(orgId: string, planId: string): Promise<void> {
    await getApi().delete(`/dues/${orgId}/plans/${planId}`)
  },

  async checkout(orgId: string, planId: string, amount?: number): Promise<{ url: string; checkout_url?: string }> {
    const { data } = await getApi().post(`/payments/${orgId}/checkout`, {
      plan_id: planId,
      ...(amount != null && amount > 0 ? { amount } : {}),
    })
    return data
  },
}
