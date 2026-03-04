import * as admin from 'firebase-admin'
import { onNewChatMessage } from './triggers/onNewChatMessage'
import { onEventCreated } from './triggers/onEventCreated'
import { onPollCreated } from './triggers/onPollCreated'
import { onMembershipUpdated } from './triggers/onMembershipUpdated'
import { registerDevice, unregisterDevice } from './api/deviceRegistration'

admin.initializeApp()

// Firestore triggers — push notifications
export { onNewChatMessage, onEventCreated, onPollCreated, onMembershipUpdated }

// Callable functions — device token management
export { registerDevice, unregisterDevice }
