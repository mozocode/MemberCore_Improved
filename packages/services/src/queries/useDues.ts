import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { duesService } from '../dues.service'
import { queryKeys } from './queryKeys'

export function useDuesStatus(orgId: string) {
  return useQuery({
    queryKey: queryKeys.dues.status(orgId),
    queryFn: () => duesService.getStatus(orgId),
    staleTime: 60 * 1000,
    enabled: !!orgId,
  })
}

export function useCheckout(orgId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ planId, amount }: { planId: string; amount: number }) =>
      duesService.checkout(orgId, planId, amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dues.status(orgId) })
    },
  })
}
