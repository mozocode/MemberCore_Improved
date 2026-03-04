import type { Member } from '@membercore/core'
import { getApi } from './api'

export interface ImportMembersCsvResult {
  imported_count: number
  skipped_count: number
  rows: Array<{
    row_index: number
    email: string
    status: 'imported' | 'duplicate' | 'invalid'
    error_message?: string
  }>
}

/** File for upload: React Native uses { uri, name }; web uses File. */
export type CsvFileForUpload =
  | { uri: string; name: string; type?: string }
  | File

export const directoryService = {
  async list(orgId: string): Promise<Member[]> {
    const { data } = await getApi().get(`/organizations/${orgId}/members`)
    return data
  },

  async get(orgId: string, memberId: string): Promise<Member> {
    const { data } = await getApi().get(`/organizations/${orgId}/members/${memberId}`)
    return data
  },

  async updateRole(orgId: string, memberId: string, role: string): Promise<void> {
    await getApi().put(`/organizations/${orgId}/members/${memberId}`, { role })
  },

  async removeMember(orgId: string, memberId: string): Promise<void> {
    await getApi().delete(`/organizations/${orgId}/members/${memberId}`)
  },

  async search(orgId: string, query: string): Promise<Member[]> {
    const { data } = await getApi().get(`/organizations/${orgId}/members`, {
      params: { search: query },
    })
    return data
  },

  async importMembersFromCsv(
    orgId: string,
    file: CsvFileForUpload,
  ): Promise<ImportMembersCsvResult> {
    const formData = new FormData()
    formData.append('file', file as any)
    const { data } = await getApi().post<ImportMembersCsvResult>(
      `/organizations/${orgId}/members/import-csv`,
      formData,
    )
    return data
  },
}
