import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'

const isiOS26OrNewer =
  Platform.OS === 'ios' && Number.parseInt(String(Platform.Version), 10) >= 26

/**
 * Temporary guard: RN iOS 26 has a TurboModule crash path with AsyncStorage.
 * Keep app launch stable by bypassing persisted storage on affected devices.
 */
export const storage = {
  async getItem(key: string): Promise<string | null> {
    if (isiOS26OrNewer) return null
    try {
      return await AsyncStorage.getItem(key)
    } catch {
      return null
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    if (isiOS26OrNewer) return
    try {
      await AsyncStorage.setItem(key, value)
    } catch {
      // no-op
    }
  },
  async removeItem(key: string): Promise<void> {
    if (isiOS26OrNewer) return
    try {
      await AsyncStorage.removeItem(key)
    } catch {
      // no-op
    }
  },
}
