import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { User } from '@membercore/core'
import { initApi, authService } from '@membercore/services'

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://membercore-api-112612371535.us-central1.run.app/api'
const TOKEN_KEY = 'membercore_token'

interface AuthState {
  user: User | null
  token: string | null
  loading: boolean
  signin: (email: string, password: string) => Promise<void>
  signup: (name: string, email: string, password: string) => Promise<void>
  signout: () => Promise<void>
}

const AuthContext = createContext<AuthState>({
  user: null,
  token: null,
  loading: true,
  signin: async () => {},
  signup: async () => {},
  signout: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const tokenRef = useRef<string | null>(null)

  const clearAuth = useCallback(() => {
    tokenRef.current = null
    setUser(null)
    setToken(null)
    AsyncStorage.removeItem(TOKEN_KEY)
  }, [])

  const setupApi = useCallback((newToken: string | null) => {
    tokenRef.current = newToken
    initApi({
      baseURL: API_URL,
      getToken: () => tokenRef.current,
      onUnauthorized: () => {
        clearAuth()
      },
    })
  }, [clearAuth])

  useEffect(() => {
    setupApi(null)

    const restore = async () => {
      try {
        const saved = await AsyncStorage.getItem(TOKEN_KEY)
        if (saved) {
          setupApi(saved)
          setToken(saved)
          const me = await authService.getMe()
          setUser(me)
        }
      } catch {
        await AsyncStorage.removeItem(TOKEN_KEY)
      } finally {
        setLoading(false)
      }
    }
    restore()
  }, [setupApi])

  const signin = useCallback(async (email: string, password: string) => {
    const res = await authService.signin({ email, password })
    await AsyncStorage.setItem(TOKEN_KEY, res.access_token)
    setupApi(res.access_token)
    setToken(res.access_token)
    setUser(res.user)
  }, [setupApi])

  const signup = useCallback(async (name: string, email: string, password: string) => {
    const res = await authService.signup({ name, email, password })
    if (!res?.access_token || !res?.user?.id) {
      throw new Error('Invalid signup response')
    }
    await AsyncStorage.setItem(TOKEN_KEY, res.access_token)
    setupApi(res.access_token)
    setToken(res.access_token)
    setUser(res.user)
  }, [setupApi])

  const signout = useCallback(async () => {
    clearAuth()
  }, [clearAuth])

  return (
    <AuthContext.Provider value={{ user, token, loading, signin, signup, signout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
