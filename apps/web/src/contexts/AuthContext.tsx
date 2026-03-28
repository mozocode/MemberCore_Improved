import React, { createContext, useContext, useEffect, useState } from 'react'
import useSWR from 'swr'
import { api } from '@/lib/api'

const authFetcher = (url: string) => api.get(url).then((r) => r.data)

interface User {
  id: string
  email: string
  name: string
  avatar?: string
  phone_number?: string
  is_platform_admin?: boolean
}

interface AuthContextType {
  user: User | null
  loading: boolean
  setUser: (user: User | null | ((prev: User | null) => User | null)) => void
  signin: (email: string, password: string) => Promise<void>
  signinWithGoogle: (idToken: string) => Promise<void>
  signup: (email: string, firstName: string, lastName: string, password: string) => Promise<void>
  signout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('token')
}

function getStoredUser(): User | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem('auth_user')
    if (!raw) return null
    return JSON.parse(raw) as User
  } catch {
    return null
  }
}

function setStoredUser(user: User | null) {
  if (typeof window === 'undefined') return
  if (!user) {
    localStorage.removeItem('auth_user')
    return
  }
  localStorage.setItem('auth_user', JSON.stringify(user))
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => getStoredUser())
  const token = getToken()
  const [authResolved, setAuthResolved] = useState<boolean>(() => !token)
  const { data, error, isLoading, mutate } = useSWR<User | null>(
    token ? '/auth/me' : null,
    authFetcher,
    { revalidateOnFocus: true, revalidateOnReconnect: true, shouldRetryOnError: true },
  )

  useEffect(() => {
    if (data) {
      setUser(data)
      setStoredUser(data)
      setAuthResolved(true)
    }
    if (error) {
      const status = (error as { response?: { status?: number } })?.response?.status
      const url = String((error as { config?: { url?: string } })?.config?.url || '')
      // Only clear session on confirmed auth failure from /auth/me.
      if (status === 401 && url.includes('/auth/me')) {
        localStorage.removeItem('token')
        setStoredUser(null)
        setUser(null)
        setAuthResolved(true)
      } else {
        // Keep users unblocked if /auth/me has a transient failure.
        // We already have token/local user state, so don't leave loading spinner stuck.
        setAuthResolved(true)
      }
    }
  }, [data, error])

  useEffect(() => {
    if (!token) {
      setAuthResolved(true)
      setStoredUser(null)
      setUser(null)
      return
    }
    // If we already have a user (signin/signup path or cached user), don't block UI.
    // Otherwise wait for /auth/me to resolve.
    setAuthResolved(!!user)
  }, [token, user])

  const loading = !!token && (!authResolved || (isLoading && !data && !user))

  const signin = async (email: string, password: string) => {
    const { data: res } = await api.post('/auth/signin', { email, password })
    localStorage.setItem('token', res.access_token)
    setUser(res.user)
    setStoredUser(res.user)
    setAuthResolved(true)
    mutate(res.user, false)
  }

  const signinWithGoogle = async (idToken: string) => {
    const { data: res } = await api.post('/auth/google', { id_token: idToken })
    localStorage.setItem('token', res.access_token)
    setUser(res.user)
    setStoredUser(res.user)
    setAuthResolved(true)
    mutate(res.user, false)
  }

  const signup = async (email: string, firstName: string, lastName: string, password: string) => {
    const { data: res } = await api.post('/auth/signup', {
      email,
      first_name: firstName,
      last_name: lastName,
      password,
    })
    localStorage.setItem('token', res.access_token)
    setUser(res.user)
    setStoredUser(res.user)
    setAuthResolved(true)
    mutate(res.user, false)
  }

  const signout = () => {
    localStorage.removeItem('token')
    setStoredUser(null)
    setUser(null)
    setAuthResolved(true)
    mutate(null, false)
  }

  return (
    <AuthContext.Provider value={{ user, loading, setUser, signin, signinWithGoogle, signup, signout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
