import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { eventService } from '../event.service'
import { queryKeys } from './queryKeys'

export function useEvents(orgId: string) {
  return useQuery({
    queryKey: queryKeys.events.all(orgId),
    queryFn: () => eventService.list(orgId),
    staleTime: 2 * 60 * 1000,
    enabled: !!orgId,
  })
}

export function useEvent(orgId: string, eventId: string) {
  return useQuery({
    queryKey: queryKeys.events.detail(orgId, eventId),
    queryFn: () => eventService.get(orgId, eventId),
    staleTime: 60 * 1000,
    enabled: !!orgId && !!eventId,
  })
}

export function useRsvp(orgId: string, eventId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (status: string) => eventService.rsvp(orgId, eventId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.events.detail(orgId, eventId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.events.all(orgId) })
    },
  })
}
