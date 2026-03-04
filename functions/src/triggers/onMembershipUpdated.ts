import * as functions from 'firebase-functions'
import { getDeviceTokens, sendPush } from '../utils/notifications'

/**
 * Triggered when a member document is updated (e.g. approved/denied).
 * Path: organizations/{orgId}/members/{memberId}
 */
export const onMembershipUpdated = functions.firestore
  .document('organizations/{orgId}/members/{memberId}')
  .onUpdate(async (change: functions.Change<functions.firestore.QueryDocumentSnapshot>, context: functions.EventContext) => {
    const { orgId } = context.params
    const before = change.before.data()
    const after = change.after.data()

    if (!before || !after) return

    // Only notify when status changes
    if (before.status === after.status) return

    const userId = after.user_id
    if (!userId) return

    const tokens = await getDeviceTokens([userId])
    if (tokens.length === 0) return

    let title: string
    let body: string

    if (after.status === 'approved') {
      title = 'Membership Approved'
      body = 'Your membership request has been approved. Welcome!'
    } else if (after.status === 'rejected') {
      title = 'Membership Denied'
      body = 'Your membership request was not approved.'
    } else {
      return
    }

    await sendPush(
      tokens,
      { title, body },
      {
        type: 'membership_update',
        orgId,
        status: after.status,
      },
    )
  })
