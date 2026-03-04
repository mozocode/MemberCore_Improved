import type { QueuedAction, StorageAdapter, NetworkAdapter } from './types'

const QUEUE_STORAGE_KEY = 'membercore_offline_queue'
const DEDUP_WINDOW_MS = 5 * 60 * 1000

/**
 * Cross-platform offline action queue.
 * Queues writes when offline, replays them when connectivity is restored.
 * Uses idempotency keys to prevent duplicate actions within a 5-minute window.
 */
export class OfflineQueue {
  private queue: QueuedAction[] = []
  private processing = false
  private storage: StorageAdapter
  private network: NetworkAdapter
  private executor: (action: QueuedAction) => Promise<void>
  private unsubscribeNetwork?: () => void

  constructor(
    storage: StorageAdapter,
    network: NetworkAdapter,
    executor: (action: QueuedAction) => Promise<void>,
  ) {
    this.storage = storage
    this.network = network
    this.executor = executor
  }

  /**
   * Initialize: load persisted queue and start listening to network changes.
   */
  async init(): Promise<void> {
    await this.loadQueue()

    this.unsubscribeNetwork = this.network.onStatusChange((online) => {
      if (online) {
        this.processQueue()
      }
    })

    if (this.network.isOnline() && this.queue.length > 0) {
      this.processQueue()
    }
  }

  /**
   * Enqueue an action. If online, execute immediately.
   */
  async enqueue(action: Omit<QueuedAction, 'status'>): Promise<void> {
    // Dedup: reject if same idempotency key already exists within window
    const isDuplicate = this.queue.some(
      (q) =>
        q.idempotencyKey === action.idempotencyKey &&
        Date.now() - q.createdAt < DEDUP_WINDOW_MS,
    )
    if (isDuplicate) return

    const queued: QueuedAction = { ...action, status: 'pending' }
    this.queue.push(queued)
    await this.persistQueue()

    if (this.network.isOnline()) {
      this.processQueue()
    }
  }

  /**
   * Process all pending actions in order.
   */
  private async processQueue(): Promise<void> {
    if (this.processing) return
    this.processing = true

    try {
      while (this.queue.length > 0) {
        const next = this.queue.find((a) => a.status === 'pending')
        if (!next) break
        if (!this.network.isOnline()) break

        next.status = 'in_flight'
        await this.persistQueue()

        try {
          await this.executor(next)
          next.status = 'completed'
        } catch (err: unknown) {
          next.retryCount += 1
          if (next.retryCount >= next.maxRetries) {
            next.status = 'failed'
            next.error = err instanceof Error ? err.message : 'Unknown error'
          } else {
            next.status = 'pending'
            // Exponential backoff: wait before retrying
            const delay = Math.min(1000 * Math.pow(2, next.retryCount), 30000)
            await new Promise((r) => setTimeout(r, delay))
          }
        }

        await this.persistQueue()
      }

      // Clean up completed/failed actions older than the dedup window
      const now = Date.now()
      this.queue = this.queue.filter(
        (a) =>
          a.status === 'pending' ||
          a.status === 'in_flight' ||
          now - a.createdAt < DEDUP_WINDOW_MS,
      )
      await this.persistQueue()
    } finally {
      this.processing = false
    }
  }

  /**
   * Get current queue status for UI display.
   */
  getPending(): QueuedAction[] {
    return this.queue.filter((a) => a.status === 'pending' || a.status === 'in_flight')
  }

  getFailed(): QueuedAction[] {
    return this.queue.filter((a) => a.status === 'failed')
  }

  /**
   * Retry all failed actions.
   */
  async retryFailed(): Promise<void> {
    for (const action of this.queue) {
      if (action.status === 'failed') {
        action.status = 'pending'
        action.retryCount = 0
        action.error = undefined
      }
    }
    await this.persistQueue()
    this.processQueue()
  }

  /**
   * Clear a specific failed action from the queue.
   */
  async dismiss(actionId: string): Promise<void> {
    this.queue = this.queue.filter((a) => a.id !== actionId)
    await this.persistQueue()
  }

  /**
   * Clean up listeners and persist final state.
   */
  async destroy(): Promise<void> {
    this.unsubscribeNetwork?.()
    await this.persistQueue()
  }

  private async persistQueue(): Promise<void> {
    try {
      await this.storage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(this.queue))
    } catch {
      // Storage may be full; drop completed items and retry
      this.queue = this.queue.filter((a) => a.status !== 'completed')
      try {
        await this.storage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(this.queue))
      } catch {
        // Silently fail if storage is completely unavailable
      }
    }
  }

  private async loadQueue(): Promise<void> {
    try {
      const raw = await this.storage.getItem(QUEUE_STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as QueuedAction[]
        // Reset any in-flight actions to pending (interrupted by app restart)
        this.queue = parsed.map((a) =>
          a.status === 'in_flight' ? { ...a, status: 'pending' as const } : a,
        )
      }
    } catch {
      this.queue = []
    }
  }
}
