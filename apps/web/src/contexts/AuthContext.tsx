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
  signup: (email: string, firstName: string, lastName: string, password: string) => Promise<void>
  signout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('token')
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const token = getToken()
  const { data, error, isLoading, mutate } = useSWR<User | null>(
    token ? '/auth/me' : null,
    authFetcher,
    { revalidateOnFocus: true, revalidateOnReconnect: true },
  )

  useEffect(() => {
    if (data) setUser(data)
    if (error) {
      localStorage.removeItem('token')
      setUser(null)
    }
  }, [data, error])

  const loading = !!token && isLoading && !data

  const signin = async (email: string, password: string) => {
    const { data: res } = await api.post('/auth/signin', { email, password })
    localStorage.setItem('token', res.access_token)
    setUser(res.user)
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
    mutate(res.user, false)
  }

  const signout = () => {
    localStorage.removeItem('token')
    setUser(null)
    mutate(null, false)
  }

  return (
    <AuthContext.Provider value={{ user, loading, setUser, signin, signup, signout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
