import type { OrgDoc, Template, GoogleFormLink } from '@membercore/core'
import { getApi } from './api'

export const documentService = {
  async listDocuments(orgId: string): Promise<OrgDoc[]> {
    const { data } = await getApi().get(`/documents/${orgId}`)
    return data
  },

  async getDocument(orgId: string, docId: string): Promise<OrgDoc> {
    const { data } = await getApi().get(`/documents/${orgId}/${docId}`)
    return data
  },

  async createDocument(orgId: string, doc: Partial<OrgDoc>): Promise<OrgDoc> {
    const { data } = await getApi().post(`/documents/${orgId}`, doc)
    return data
  },

  async deleteDocument(orgId: string, docId: string): Promise<void> {
    await getApi().delete(`/documents/${orgId}/${docId}`)
  },

  async listTemplates(orgId: string): Promise<Template[]> {
    const { data } = await getApi().get(`/documents/${orgId}/templates`)
    return data
  },

  async listFormLinks(orgId: string): Promise<GoogleFormLink[]> {
    const { data } = await getApi().get(`/documents/${orgId}/google-forms`)
    return data
  },
}
