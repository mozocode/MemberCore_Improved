import type { User } from '@membercore/core'
import { getApi } from './api'

export interface SigninPayload {
  email: string
  password: string
}

export interface SignupPayload {
  name: string
  email: string
  password: string
}

export interface AuthResponse {
  access_token: string
  token_type: string
  user: User
}

export interface ForgotPasswordPayload {
  email: string
}

export interface ResetPasswordPayload {
  token: string
  password: string
}

export interface GoogleAuthPayload {
  id_token: string
}

export const authService = {
  async signin(payload: SigninPayload): Promise<AuthResponse> {
    const { data } = await getApi().post('/auth/signin', payload)
    return data
  },

  async signup(payload: SignupPayload): Promise<AuthResponse> {
    const trimmed = payload.name.trim()
    const parts = trimmed.split(/\s+/)
    const first_name = parts[0] ?? trimmed
    const last_name = parts.slice(1).join(' ') ?? ''
    const { data } = await getApi().post('/auth/signup', {
      email: payload.email,
      password: payload.password,
      first_name,
      last_name,
    })
    return data
  },

  async getMe(): Promise<User> {
    const { data } = await getApi().get('/auth/me')
    return data
  },

  async forgotPassword(payload: ForgotPasswordPayload): Promise<{ ok: boolean; message: string }> {
    const { data } = await getApi().post('/auth/forgot-password', payload)
    return data
  },

  async resetPassword(payload: ResetPasswordPayload): Promise<{ ok: boolean; message: string }> {
    const { data } = await getApi().post('/auth/reset-password', payload)
    return data
  },

  async googleAuth(payload: GoogleAuthPayload): Promise<AuthResponse> {
    const { data } = await getApi().post('/auth/google', payload)
    return data
  },

  async updateProfile(updates: Partial<Pick<User, 'name' | 'avatar' | 'phone_number'>>): Promise<User> {
    const { data } = await getApi().put('/auth/me', updates)
    return data
  },
}
