import { useEffect, useState, useCallback } from 'react'
import type { BillingState, GatedFeature } from '@membercore/core'
import { isBillingActive, isFeatureAvailable } from '@membercore/core'
import { billingService } from '@membercore/services'

/**
 * Hook for reading billing state on mobile.
 * Mobile reads billing state but NEVER initiates purchases.
 */
export function useBillingGate(orgId: string) {
  const [billing, setBilling] = useState<BillingState | null>(null)
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    try {
      const data = await billingService.getState(orgId)
      setBilling(data)
    } catch {
      setBilling(null)
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => {
    fetch()
  }, [fetch])

  const canAccess = useCallback(
    (feature: GatedFeature): boolean => {
      if (!billing) return false
      return isFeatureAvailable(billing, feature)
    },
    [billing],
  )

  const isActive = billing ? isBillingActive(billing) : false

  return {
    billing,
    loading,
    isActive,
    canAccess,
    refresh: fetch,
  }
}
