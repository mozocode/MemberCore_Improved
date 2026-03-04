export type OrgPlan = 'free' | 'pro'

export type BillingPlanPro = 'pro_monthly' | 'pro_annual'

export type BillingStatus =
  | 'active'
  | 'trial'
  | 'past_due'
  | 'canceled'
  | 'inactive'
  | 'exempt'

export interface BillingState {
  plan: OrgPlan
  /** When plan is 'pro', which Pro tier (monthly vs annual). */
  billing_plan?: BillingPlanPro | null
  billing_status: BillingStatus
  trial_end_date?: string | null
  period_end?: string | null
  stripe_customer_id?: string | null
  is_billing_exempt?: boolean
}

/**
 * Features that can be gated by subscription plan.
 */
export type GatedFeature =
  | 'chat'
  | 'event_creation'
  | 'admin_features'
  | 'directory_publishing'
  | 'polls_creation'
  | 'documents_upload'
  | 'dues_management'
  | 'analytics'

/**
 * Features accessible even on inactive subscriptions.
 */
export const ALWAYS_ACCESSIBLE_FEATURES = [
  'calendar_view',
  'directory_view',
  'event_view',
  'profile',
] as const

/**
 * Features that require an active Pro subscription.
 */
export const PRO_GATED_FEATURES: GatedFeature[] = [
  'chat',
  'event_creation',
  'admin_features',
  'directory_publishing',
  'polls_creation',
  'documents_upload',
  'dues_management',
  'analytics',
]

/**
 * Check if the billing state allows full feature access.
 */
export function isBillingActive(billing: BillingState): boolean {
  return (
    billing.billing_status === 'active' ||
    billing.billing_status === 'trial' ||
    billing.billing_status === 'exempt'
  )
}

/**
 * Check if a specific feature is available given the billing state.
 */
export function isFeatureAvailable(
  billing: BillingState,
  feature: GatedFeature,
): boolean {
  if (billing.plan === 'free') return false
  return isBillingActive(billing)
}

/**
 * App Store-compliant message for subscription-gated actions.
 * NEVER include purchase CTAs, upgrade links, or pricing in mobile.
 */
export const BILLING_INACTIVE_MESSAGE =
  "Your organization's subscription is inactive. Update payment on the website to restore full access."

export const BILLING_MANAGED_ON_WEB_MESSAGE =
  'Subscriptions are managed on the MemberCore website.'
