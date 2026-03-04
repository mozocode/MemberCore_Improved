import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { pollService } from '../poll.service'
import { queryKeys } from './queryKeys'

export function usePolls(orgId: string) {
  return useQuery({
    queryKey: queryKeys.polls.all(orgId),
    queryFn: () => pollService.list(orgId),
    staleTime: 60 * 1000,
    enabled: !!orgId,
  })
}

export function usePoll(orgId: string, pollId: string) {
  return useQuery({
    queryKey: queryKeys.polls.detail(orgId, pollId),
    queryFn: () => pollService.get(orgId, pollId),
    staleTime: 30 * 1000,
    enabled: !!orgId && !!pollId,
  })
}

export function useVote(orgId: string, pollId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (optionIds: string[]) => pollService.vote(orgId, pollId, optionIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.polls.detail(orgId, pollId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.polls.all(orgId) })
    },
  })
}
