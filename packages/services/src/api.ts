import axios, { type AxiosInstance } from 'axios'

let _apiInstance: AxiosInstance | null = null

export interface ApiConfig {
  baseURL: string
  getToken: () => string | null
  onUnauthorized?: () => void
}

export function initApi(config: ApiConfig): AxiosInstance {
  const instance = axios.create({
    baseURL: config.baseURL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 30000,
  })

  instance.interceptors.request.use((reqConfig) => {
    const token = config.getToken()
    if (token) {
      reqConfig.headers.Authorization = `Bearer ${token}`
    }
    return reqConfig
  })

  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        const url = error.config?.url || ''
        if (!url.includes('/auth/signin') && !url.includes('/auth/signup')) {
          config.onUnauthorized?.()
        }
      }
      return Promise.reject(error)
    },
  )

  _apiInstance = instance
  return instance
}

export function getApi(): AxiosInstance {
  if (!_apiInstance) {
    throw new Error(
      'API not initialized. Call initApi() before using services.',
    )
  }
  return _apiInstance
}
