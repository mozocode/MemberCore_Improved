export interface AuthTokenResult {
  token: string
  expiresAt: number
}

export function isTokenExpired(expiresAt: number): boolean {
  return Date.now() >= expiresAt - 60_000
}
