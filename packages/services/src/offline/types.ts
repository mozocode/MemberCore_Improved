/**
 * Represents a queued action to be executed when connectivity is restored.
 */
export interface QueuedAction {
  id: string
  idempotencyKey: string
  type: 'send_message' | 'toggle_reaction' | 'rsvp' | 'vote' | 'update_read_state'
  payload: Record<string, unknown>
  createdAt: number
  retryCount: number
  maxRetries: number
  status: 'pending' | 'in_flight' | 'failed' | 'completed'
  error?: string
}

/**
 * Platform-specific storage adapter.
 * Web: uses IndexedDB/localStorage.
 * Mobile: uses AsyncStorage.
 */
export interface StorageAdapter {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
}

/**
 * Platform-specific network status adapter.
 */
export interface NetworkAdapter {
  isOnline(): boolean
  onStatusChange(callback: (online: boolean) => void): () => void
}
