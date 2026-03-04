import * as admin from 'firebase-admin'

export interface PushTarget {
  userId: string
  orgId: string
}

/**
 * Fetch all device tokens for a set of users who are members of an org.
 * Reads from users/{uid}/devices collection.
 */
export async function getDeviceTokens(
  userIds: string[],
  excludeUserId?: string,
): Promise<string[]> {
  const db = admin.firestore()
  const tokens: string[] = []

  for (const uid of userIds) {
    if (uid === excludeUserId) continue
    const snap = await db.collection(`users/${uid}/devices`).get()
    snap.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
      const data = doc.data()
      if (data.token) {
        tokens.push(data.token as string)
      }
    })
  }

  return tokens
}

/**
 * Get all member user IDs for an organization.
 */
export async function getOrgMemberIds(orgId: string): Promise<string[]> {
  const db = admin.firestore()
  const snap = await db
    .collection(`organizations/${orgId}/members`)
    .where('status', '==', 'approved')
    .get()

  return snap.docs.map((doc: FirebaseFirestore.QueryDocumentSnapshot) => doc.data().user_id).filter(Boolean)
}

/**
 * Get member user IDs who have access to a specific channel.
 * For non-restricted channels, returns all org members.
 * For restricted channels, returns only allowed members/roles.
 */
export async function getChannelRecipients(
  orgId: string,
  channelId: string,
  excludeSenderId?: string,
): Promise<string[]> {
  const db = admin.firestore()
  const channelDoc = await db
    .doc(`organizations/${orgId}/channels/${channelId}`)
    .get()
  const channelData = channelDoc.data()

  if (!channelData) return []

  const allMembers = await getOrgMemberIds(orgId)

  if (!channelData.is_restricted) {
    return allMembers.filter((uid) => uid !== excludeSenderId)
  }

  const allowedMembers = channelData.allowed_members || []
  const allowedRoles = channelData.allowed_roles || []

  if (allowedRoles.length === 0) {
    return allowedMembers.filter((uid: string) => uid !== excludeSenderId)
  }

  const membersSnap = await db
    .collection(`organizations/${orgId}/members`)
    .where('status', '==', 'approved')
    .get()

  const eligible: string[] = []
  membersSnap.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
    const data = doc.data()
    const uid = data.user_id as string
    if (uid === excludeSenderId) return
    if (allowedMembers.includes(uid) || allowedRoles.includes(data.role)) {
      eligible.push(uid)
    }
  })

  return eligible
}

/**
 * Send a multicast push notification. Automatically cleans up stale tokens.
 */
export async function sendPush(
  tokens: string[],
  notification: { title: string; body: string },
  data?: Record<string, string>,
): Promise<void> {
  if (tokens.length === 0) return

  const messaging = admin.messaging()

  const batchSize = 500
  for (let i = 0; i < tokens.length; i += batchSize) {
    const batch = tokens.slice(i, i + batchSize)
    const response = await messaging.sendEachForMulticast({
      tokens: batch,
      notification,
      data: data || {},
      android: {
        priority: 'high',
        notification: { sound: 'default' },
      },
      apns: {
        payload: {
          aps: { sound: 'default', badge: 1 },
        },
      },
    })

    // Clean up invalid tokens
    const tokensToRemove: string[] = []
    response.responses.forEach((resp: admin.messaging.SendResponse, idx: number) => {
      if (resp.error) {
        const code = resp.error.code
        if (
          code === 'messaging/invalid-registration-token' ||
          code === 'messaging/registration-token-not-registered'
        ) {
          tokensToRemove.push(batch[idx])
        }
      }
    })

    if (tokensToRemove.length > 0) {
      await cleanupStaleTokens(tokensToRemove)
    }
  }
}

async function cleanupStaleTokens(staleTokens: string[]): Promise<void> {
  const db = admin.firestore()
  const batch = db.batch()

  for (const token of staleTokens) {
    const snap = await db
      .collectionGroup('devices')
      .where('token', '==', token)
      .get()
    snap.forEach((doc: FirebaseFirestore.QueryDocumentSnapshot) => batch.delete(doc.ref))
  }

  await batch.commit()
}
