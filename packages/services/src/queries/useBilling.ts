import { useQuery } from '@tanstack/react-query'
import { billingService } from '../billing.service'
import { queryKeys } from './queryKeys'

export function useBillingState(orgId: string) {
  return useQuery({
    queryKey: queryKeys.billing.state(orgId),
    queryFn: () => billingService.getState(orgId),
    staleTime: 60 * 1000,
    enabled: !!orgId,
    refetchOnWindowFocus: true,
  })
}
