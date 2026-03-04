import * as functions from 'firebase-functions'
import { getChannelRecipients, getDeviceTokens, sendPush } from '../utils/notifications'

/**
 * Triggered when a new message document is created in a channel.
 * Path: organizations/{orgId}/channels/{channelId}/messages/{messageId}
 */
export const onNewChatMessage = functions.firestore
  .document('organizations/{orgId}/channels/{channelId}/messages/{messageId}')
  .onCreate(async (snap: functions.firestore.QueryDocumentSnapshot, context: functions.EventContext) => {
    const { orgId, channelId } = context.params
    const message = snap.data()

    if (!message) return

    const senderId = message.sender_id
    const senderName = message.sender_name || 'Someone'
    const content = message.content || ''

    // Get all users who can see this channel (excluding sender)
    const recipientIds = await getChannelRecipients(orgId, channelId, senderId)
    if (recipientIds.length === 0) return

    // Fetch device tokens for those users
    const tokens = await getDeviceTokens(recipientIds)
    if (tokens.length === 0) return

    // Truncate message content for notification
    const bodyText = content.length > 100 ? content.substring(0, 100) + '...' : content

    await sendPush(
      tokens,
      {
        title: `${senderName} in #${message.channel_name || channelId}`,
        body: bodyText,
      },
      {
        type: 'chat_message',
        orgId,
        channelId,
        messageId: snap.id,
      },
    )
  })
