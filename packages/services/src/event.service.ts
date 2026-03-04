import type { Event } from '@membercore/core'
import { getApi } from './api'

export const eventService = {
  async list(orgId: string): Promise<Event[]> {
    const { data } = await getApi().get(`/events/${orgId}`)
    return data
  },

  async get(orgId: string, eventId: string): Promise<Event> {
    const { data } = await getApi().get(`/events/${orgId}/${eventId}`)
    return data
  },

  async create(orgId: string, payload: Partial<Event>): Promise<Event> {
    const { data } = await getApi().post(`/events/${orgId}`, payload)
    return data
  },

  async update(orgId: string, eventId: string, payload: Partial<Event>): Promise<Event> {
    const { data } = await getApi().put(`/events/${orgId}/${eventId}`, payload)
    return data
  },

  async delete(orgId: string, eventId: string): Promise<void> {
    await getApi().delete(`/events/${orgId}/${eventId}`)
  },

  async rsvp(orgId: string, eventId: string, status: string): Promise<void> {
    await getApi().post(`/events/${orgId}/${eventId}/rsvp`, { status })
  },
}
