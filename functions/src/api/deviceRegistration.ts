import * as functions from 'firebase-functions'
import { HttpsError } from 'firebase-functions/v1/auth'
import * as admin from 'firebase-admin'

interface RegisterDeviceData {
  token: string
  platform: 'ios' | 'android' | 'web'
  orgIds?: string[]
}

/**
 * Callable function to register a device token for push notifications.
 * Called from the mobile app after FCM setup.
 */
export const registerDevice = functions.https.onCall(
  async (data: RegisterDeviceData, context: functions.https.CallableContext) => {
    if (!context.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in')
    }

    const uid = context.auth.uid
    const { token, platform, orgIds } = data

    if (!token || !platform) {
      throw new HttpsError('invalid-argument', 'token and platform are required')
    }

    const db = admin.firestore()
    const deviceRef = db.doc(`users/${uid}/devices/${token}`)

    await deviceRef.set(
      {
        token,
        platform,
        org_ids: orgIds || [],
        last_active: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    )

    return { success: true }
  },
)

/**
 * Callable function to unregister a device token.
 * Called on sign-out.
 */
export const unregisterDevice = functions.https.onCall(
  async (data: { token: string }, context: functions.https.CallableContext) => {
    if (!context.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in')
    }

    const uid = context.auth.uid
    const { token } = data

    if (!token) {
      throw new HttpsError('invalid-argument', 'token is required')
    }

    const db = admin.firestore()
    await db.doc(`users/${uid}/devices/${token}`).delete()

    return { success: true }
  },
)
