import { useQuery } from '@tanstack/react-query'
import { directoryService } from '../directory.service'
import { queryKeys } from './queryKeys'

export function useDirectory(orgId: string) {
  return useQuery({
    queryKey: queryKeys.directory.all(orgId),
    queryFn: () => directoryService.list(orgId),
    staleTime: 2 * 60 * 1000,
    enabled: !!orgId,
  })
}

export function useDirectorySearch(orgId: string, query: string) {
  return useQuery({
    queryKey: queryKeys.directory.search(orgId, query),
    queryFn: () => directoryService.search(orgId, query),
    staleTime: 30 * 1000,
    enabled: !!orgId && query.trim().length > 0,
  })
}
