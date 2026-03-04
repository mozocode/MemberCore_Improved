import { useEffect, useRef, useState, useCallback } from 'react'
import { OfflineQueue } from './OfflineQueue'
import { executeAction } from './executor'
import { generateIdempotencyKey } from './idempotency'
import type { QueuedAction, StorageAdapter, NetworkAdapter } from './types'

/**
 * React hook for using the offline queue.
 * Works on both web and React Native — just provide the appropriate adapters.
 */
export function useOfflineQueue(
  storage: StorageAdapter,
  network: NetworkAdapter,
  userId: string | undefined,
) {
  const queueRef = useRef<OfflineQueue | null>(null)
  const [pending, setPending] = useState<QueuedAction[]>([])
  const [failed, setFailed] = useState<QueuedAction[]>([])

  useEffect(() => {
    if (!userId) return

    const queue = new OfflineQueue(storage, network, executeAction)
    queueRef.current = queue
    queue.init()

    const interval = setInterval(() => {
      setPending(queue.getPending())
      setFailed(queue.getFailed())
    }, 2000)

    return () => {
      clearInterval(interval)
      queue.destroy()
      queueRef.current = null
    }
  }, [storage, network, userId])

  const enqueue = useCallback(
    async (
      type: QueuedAction['type'],
      payload: Record<string, unknown>,
    ) => {
      if (!queueRef.current || !userId) return

      const action: Omit<QueuedAction, 'status'> = {
        id: crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        idempotencyKey: generateIdempotencyKey(userId, type),
        type,
        payload,
        createdAt: Date.now(),
        retryCount: 0,
        maxRetries: 5,
      }

      await queueRef.current.enqueue(action)
    },
    [userId],
  )

  const retryFailed = useCallback(async () => {
    await queueRef.current?.retryFailed()
  }, [])

  const dismiss = useCallback(async (actionId: string) => {
    await queueRef.current?.dismiss(actionId)
  }, [])

  return {
    enqueue,
    pending,
    failed,
    retryFailed,
    dismiss,
    isOnline: network.isOnline(),
  }
}
