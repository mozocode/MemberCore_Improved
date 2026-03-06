export { initApi, getApi, type ApiConfig } from './api'
export { authService, type SigninPayload, type SignupPayload, type AuthResponse } from './auth.service'
export { chatService, type ListMessagesResponse, type SendMessagePayload, type ChannelReadState, type ChatSummary } from './chat.service'
export { eventService } from './event.service'
export { duesService } from './dues.service'
export {
  directoryService,
  type ImportMembersCsvResult,
  type CsvFileForUpload,
} from './directory.service'
export { pollService } from './poll.service'
export { documentService } from './document.service'
export { organizationService, type Organization } from './organization.service'
export { billingService } from './billing.service'

// Offline queue and sync
export {
  type QueuedAction,
  type StorageAdapter,
  type NetworkAdapter,
  generateIdempotencyKey,
  OfflineQueue,
  executeAction,
  useOfflineQueue,
  createNativeStorageAdapter,
  createNativeNetworkAdapter,
} from './offline'

// Web-only adapters — import from '@membercore/services/offline/adapters.web' directly
// to keep localStorage / window references out of React Native bundles.

// TanStack Query hooks and keys
export {
  queryKeys,
  useOrganizations,
  useOrganization,
  useChannels,
  useMessages,
  useSendMessage,
  useToggleReaction,
  useChatSummary,
  useEvents,
  useEvent,
  useRsvp,
  useDuesStatus,
  useCheckout,
  useDirectory,
  useDirectorySearch,
  usePolls,
  usePoll,
  useVote,
  useBillingState,
} from './queries'
