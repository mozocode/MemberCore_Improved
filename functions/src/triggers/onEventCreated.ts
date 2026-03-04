import * as functions from 'firebase-functions'
import { getOrgMemberIds, getDeviceTokens, sendPush } from '../utils/notifications'

/**
 * Triggered when a new event is created.
 * Path: organizations/{orgId}/events/{eventId}
 */
export const onEventCreated = functions.firestore
  .document('organizations/{orgId}/events/{eventId}')
  .onCreate(async (snap: functions.firestore.QueryDocumentSnapshot, context: functions.EventContext) => {
    const { orgId } = context.params
    const event = snap.data()

    if (!event) return

    const creatorId = event.created_by
    const title = event.title || 'New Event'

    // Notify all org members except the creator
    const memberIds = await getOrgMemberIds(orgId)
    const recipientIds = memberIds.filter((uid) => uid !== creatorId)
    if (recipientIds.length === 0) return

    const tokens = await getDeviceTokens(recipientIds)
    if (tokens.length === 0) return

    const body = event.start_time
      ? `${title} — ${new Date(event.start_time).toLocaleDateString()}`
      : title

    await sendPush(
      tokens,
      {
        title: 'New Event',
        body,
      },
      {
        type: 'event_created',
        orgId,
        eventId: snap.id,
      },
    )
  })
