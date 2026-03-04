import type { BillingState } from '@membercore/core'
import { getApi } from './api'

export const billingService = {
  /**
   * Get billing state for an organization.
   * Available to all members (read-only).
   */
  async getState(orgId: string): Promise<BillingState> {
    const { data } = await getApi().get(`/billing/${orgId}/billing`)
    return data
  },

  /**
   * Create a Stripe Checkout Session for a new Pro subscription.
   * WEB ONLY — never call from mobile app.
   */
  async createCheckout(
    orgId: string,
    successUrl: string,
    cancelUrl: string,
  ): Promise<{ checkout_url: string; session_id: string }> {
    const { data } = await getApi().post(`/billing/${orgId}/billing/checkout`, {
      success_url: successUrl,
      cancel_url: cancelUrl,
      plan: 'pro',
    })
    return data
  },

  /**
   * Create a Stripe Customer Portal session for managing billing.
   * WEB ONLY — never call from mobile app.
   */
  async createPortal(
    orgId: string,
    returnUrl: string,
  ): Promise<{ portal_url: string }> {
    const { data } = await getApi().post(
      `/billing/${orgId}/billing/portal`,
      null,
      { params: { return_url: returnUrl } },
    )
    return data
  },
}
