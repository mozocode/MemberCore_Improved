import * as functions from 'firebase-functions'
import { getOrgMemberIds, getDeviceTokens, sendPush } from '../utils/notifications'

/**
 * Triggered when a new poll is created.
 * Path: organizations/{orgId}/polls/{pollId}
 */
export const onPollCreated = functions.firestore
  .document('organizations/{orgId}/polls/{pollId}')
  .onCreate(async (snap: functions.firestore.QueryDocumentSnapshot, context: functions.EventContext) => {
    const { orgId } = context.params
    const poll = snap.data()

    if (!poll) return

    const creatorId = poll.created_by
    const question = poll.question || 'New Poll'

    const memberIds = await getOrgMemberIds(orgId)
    const recipientIds = memberIds.filter((uid) => uid !== creatorId)
    if (recipientIds.length === 0) return

    const tokens = await getDeviceTokens(recipientIds)
    if (tokens.length === 0) return

    await sendPush(
      tokens,
      {
        title: 'New Poll',
        body: question.length > 100 ? question.substring(0, 100) + '...' : question,
      },
      {
        type: 'poll_created',
        orgId,
        pollId: snap.id,
      },
    )
  })
