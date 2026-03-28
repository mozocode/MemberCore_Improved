import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import type { User } from '@membercore/core'
import { initApi, getApi, authService } from '@membercore/services'
import { storage } from '../utils/storage'

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://membercore-api-112612371535.us-central1.run.app/api'
const TOKEN_KEY = 'membercore_token'
const USER_KEY = 'membercore_user'
const RESTORE_TIMEOUT_MS = 8000

interface AuthState {
  user: User | null
  token: string | null
  loading: boolean
  signin: (email: string, password: string) => Promise<void>
  signinWithGoogle: (idToken: string) => Promise<void>
  signup: (name: string, email: string, password: string) => Promise<void>
  signupWithGoogle: (idToken: string) => Promise<void>
  forgotPassword: (email: string) => Promise<string>
  signout: () => Promise<void>
}

const AuthContext = createContext<AuthState>({
  user: null,
  token: null,
  loading: true,
  signin: async () => {},
  signinWithGoogle: async () => {},
  signup: async () => {},
  signupWithGoogle: async () => {},
  forgotPassword: async () => '',
  signout: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const tokenRef = useRef<string | null>(null)
  const unauthorizedCheckInFlightRef = useRef(false)

  const clearAuthState = useCallback(() => {
    tokenRef.current = null
    setUser(null)
    setToken(null)
  }, [])

  const clearAuth = useCallback(async () => {
    clearAuthState()
    await Promise.all([storage.removeItem(TOKEN_KEY), storage.removeItem(USER_KEY)])
  }, [clearAuthState])

  const persistUser = useCallback(async (nextUser: User | null) => {
    if (!nextUser) {
      await storage.removeItem(USER_KEY)
      return
    }
    await storage.setItem(USER_KEY, JSON.stringify(nextUser))
  }, [])

  const verifySessionAfterUnauthorized = useCallback(() => {
    if (!tokenRef.current || unauthorizedCheckInFlightRef.current) return
    unauthorizedCheckInFlightRef.current = true
    const tokenAtStart = tokenRef.current

    getApi()
      .get<User>('/auth/me')
      .then(async (res) => {
        if (tokenRef.current !== tokenAtStart) return
        setUser(res.data)
        await persistUser(res.data)
      })
      .catch(async (err: any) => {
        const status = err?.response?.status
        if (status === 401 && tokenRef.current === tokenAtStart) {
          clearAuthState()
          await Promise.all([storage.removeItem(TOKEN_KEY), storage.removeItem(USER_KEY)])
        }
      })
      .finally(() => {
        unauthorizedCheckInFlightRef.current = false
      })
  }, [clearAuthState, persistUser])

  const setupApi = useCallback((newToken: string | null) => {
    tokenRef.current = newToken
    initApi({
      baseURL: API_URL,
      getToken: () => tokenRef.current,
      onUnauthorized: () => {
        verifySessionAfterUnauthorized()
      },
    })
  }, [verifySessionAfterUnauthorized])

  useEffect(() => {
    setupApi(null)

    const restore = async () => {
      try {
        const [saved, savedUserRaw] = await Promise.all([
          storage.getItem(TOKEN_KEY),
          storage.getItem(USER_KEY),
        ])
        if (savedUserRaw) {
          try {
            setUser(JSON.parse(savedUserRaw) as User)
          } catch {
            await storage.removeItem(USER_KEY)
          }
        }
        if (saved) {
          setupApi(saved)
          setToken(saved)
          try {
            const me = await Promise.race([
              authService.getMe(),
              new Promise<null>((resolve) => setTimeout(() => resolve(null), RESTORE_TIMEOUT_MS)),
            ])
            // Timeout/null should not force-logout; keep prior token/session and retry later.
            if (me) {
              setUser(me)
              await persistUser(me)
            }
          } catch (err: any) {
            if (err?.response?.status === 401) {
              await clearAuth()
            }
          }
        }
      } catch {
        // Keep existing in-memory state if storage read fails.
      } finally {
        setLoading(false)
      }
    }
    restore()
  }, [clearAuth, persistUser, setupApi])

  const signin = useCallback(async (email: string, password: string) => {
    const res = await authService.signin({ email, password })
    await Promise.all([
      storage.setItem(TOKEN_KEY, res.access_token),
      persistUser(res.user),
    ])
    setupApi(res.access_token)
    setToken(res.access_token)
    setUser(res.user)
  }, [persistUser, setupApi])

  const signup = useCallback(async (name: string, email: string, password: string) => {
    const res = await authService.signup({ name, email, password })
    if (!res?.access_token || !res?.user?.id) {
      throw new Error('Invalid signup response')
    }
    await Promise.all([
      storage.setItem(TOKEN_KEY, res.access_token),
      persistUser(res.user),
    ])
    setupApi(res.access_token)
    setToken(res.access_token)
    setUser(res.user)
  }, [persistUser, setupApi])

  const signinWithGoogle = useCallback(async (idToken: string) => {
    const res = await authService.googleAuth({ id_token: idToken })
    await Promise.all([
      storage.setItem(TOKEN_KEY, res.access_token),
      persistUser(res.user),
    ])
    setupApi(res.access_token)
    setToken(res.access_token)
    setUser(res.user)
  }, [persistUser, setupApi])

  const signupWithGoogle = useCallback(async (idToken: string) => {
    const res = await authService.googleAuth({ id_token: idToken })
    await Promise.all([
      storage.setItem(TOKEN_KEY, res.access_token),
      persistUser(res.user),
    ])
    setupApi(res.access_token)
    setToken(res.access_token)
    setUser(res.user)
  }, [persistUser, setupApi])

  const signout = useCallback(async () => {
    clearAuth()
  }, [clearAuth])

  const forgotPassword = useCallback(async (email: string) => {
    const res = await authService.forgotPassword({ email })
    return res?.message || 'If that email exists, a reset link has been sent.'
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, loading, signin, signinWithGoogle, signup, signupWithGoogle, forgotPassword, signout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
