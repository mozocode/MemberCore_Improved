export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters'
  return null
}

export function validateChannelName(name: string): string | null {
  const trimmed = name.trim()
  if (!trimmed) return 'Channel name is required'
  if (trimmed.length > 50) return 'Channel name must be 50 characters or less'
  return null
}

export function validatePaymentAmount(
  amount: number,
  minimum: number,
  remaining: number,
): string | null {
  if (amount <= 0) return 'Amount must be greater than zero'
  if (amount < minimum) return `Minimum payment is $${minimum.toFixed(2)}`
  if (amount > remaining) return `Amount exceeds remaining balance of $${remaining.toFixed(2)}`
  return null
}
