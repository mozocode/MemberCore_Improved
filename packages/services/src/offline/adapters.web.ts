import type { StorageAdapter, NetworkAdapter } from './types'

/**
 * Web storage adapter using localStorage.
 * For larger data, could be replaced with IndexedDB via idb-keyval.
 */
export const webStorageAdapter: StorageAdapter = {
  async getItem(key: string) {
    return localStorage.getItem(key)
  },
  async setItem(key: string, value: string) {
    localStorage.setItem(key, value)
  },
  async removeItem(key: string) {
    localStorage.removeItem(key)
  },
}

/**
 * Web network adapter using navigator.onLine and online/offline events.
 */
export const webNetworkAdapter: NetworkAdapter = {
  isOnline() {
    return typeof navigator !== 'undefined' ? navigator.onLine : true
  },
  onStatusChange(callback: (online: boolean) => void) {
    const handleOnline = () => callback(true)
    const handleOffline = () => callback(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  },
}
