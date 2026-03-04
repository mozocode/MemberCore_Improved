import type { StorageAdapter, NetworkAdapter } from './types'

/**
 * React Native storage adapter using AsyncStorage.
 *
 * Usage: import AsyncStorage from '@react-native-async-storage/async-storage'
 *        const adapter = createNativeStorageAdapter(AsyncStorage)
 */
export function createNativeStorageAdapter(asyncStorage: {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
}): StorageAdapter {
  return {
    getItem: (key) => asyncStorage.getItem(key),
    setItem: (key, value) => asyncStorage.setItem(key, value),
    removeItem: (key) => asyncStorage.removeItem(key),
  }
}

/**
 * React Native network adapter using NetInfo.
 *
 * Usage: import NetInfo from '@react-native-community/netinfo'
 *        const adapter = createNativeNetworkAdapter(NetInfo)
 */
export function createNativeNetworkAdapter(netInfo: {
  fetch(): Promise<{ isConnected: boolean | null }>
  addEventListener(
    listener: (state: { isConnected: boolean | null }) => void,
  ): () => void
}): NetworkAdapter {
  let _isOnline = true

  netInfo.fetch().then((state) => {
    _isOnline = state.isConnected !== false
  })

  return {
    isOnline() {
      return _isOnline
    },
    onStatusChange(callback) {
      return netInfo.addEventListener((state) => {
        const online = state.isConnected !== false
        _isOnline = online
        callback(online)
      })
    },
  }
}
