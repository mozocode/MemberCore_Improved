/**
 * Generate a unique idempotency key for deduplicating offline writes.
 * Format: userId-actionType-timestamp-random
 */
export function generateIdempotencyKey(
  userId: string,
  actionType: string,
): string {
  const ts = Date.now()
  const rand = Math.random().toString(36).substring(2, 10)
  return `${userId}-${actionType}-${ts}-${rand}`
}
