import type { BillingState } from '@membercore/core'
import { getApi } from './api'

export type ProPlanKey = 'pro_monthly' | 'pro_annual'

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
   * Create a Stripe Checkout Session for Pro subscription (monthly or annual).
   * Returns checkout_url to open in browser (e.g. WebBrowser.openBrowserAsync).
   */
  async createCheckoutSession(
    orgId: string,
    plan: ProPlanKey,
  ): Promise<{ checkout_url: string; session_id: string }> {
    const { data } = await getApi().post<{ checkout_url: string; session_id: string }>(
      `/billing/${orgId}/billing/create-checkout-session`,
      { plan },
    )
    return data
  },

  /**
   * Create a Stripe Checkout Session for a new Pro subscription (web: pass URLs).
   * WEB ONLY — optional; mobile uses createCheckoutSession(orgId, plan).
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
