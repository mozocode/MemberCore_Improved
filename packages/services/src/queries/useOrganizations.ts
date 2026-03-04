import { useQuery } from '@tanstack/react-query'
import { organizationService } from '../organization.service'
import { queryKeys } from './queryKeys'

export function useOrganizations() {
  return useQuery({
    queryKey: queryKeys.organizations.all,
    queryFn: () => organizationService.list(),
    staleTime: 5 * 60 * 1000,
  })
}

export function useOrganization(orgId: string) {
  return useQuery({
    queryKey: queryKeys.organizations.detail(orgId),
    queryFn: () => organizationService.get(orgId),
    staleTime: 5 * 60 * 1000,
    enabled: !!orgId,
  })
}
