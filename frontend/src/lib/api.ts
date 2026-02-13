import axios from 'axios'

const API_URL = import.meta.env.VITE_BACKEND_URL || '/api'

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30s to allow backend/Firebase cold start
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const url = error.config?.url || ''
      if (!url.includes('/auth/signin') && !url.includes('/auth/signup')) {
        localStorage.removeItem('token')
        window.location.href = '/signin'
      }
    }
    return Promise.reject(error)
  }
)
