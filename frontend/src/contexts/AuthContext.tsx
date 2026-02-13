import React, { createContext, useContext, useEffect, useState } from 'react'
import { api } from '@/lib/api'

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      api
        .get('/auth/me')
        .then((res) => setUser(res.data))
        .catch(() => {
          localStorage.removeItem('token')
          setUser(null)
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const signin = async (email: string, password: string) => {
    const { data } = await api.post('/auth/signin', { email, password })
    localStorage.setItem('token', data.access_token)
    setUser(data.user)
  }

  const signup = async (email: string, firstName: string, lastName: string, password: string) => {
    const { data } = await api.post('/auth/signup', { email, first_name: firstName, last_name: lastName, password })
    localStorage.setItem('token', data.access_token)
    setUser(data.user)
  }

  const signout = () => {
    localStorage.removeItem('token')
    setUser(null)
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
