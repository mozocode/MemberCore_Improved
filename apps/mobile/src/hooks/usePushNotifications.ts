import { useEffect, useRef, useCallback } from 'react'
import { Platform, Alert } from 'react-native'
import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'
import { getApi } from '@membercore/services'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

export function usePushNotifications(
  userId: string | undefined,
  onNotificationTap?: (data: Record<string, string>) => void,
) {
  const notificationListener = useRef<Notifications.Subscription>()
  const responseListener = useRef<Notifications.Subscription>()

  const registerForPush = useCallback(async () => {
    if (!userId) return

    const { status: existingStatus } = await Notifications.getPermissionsAsync()
    let finalStatus = existingStatus

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync()
      finalStatus = status
    }

    if (finalStatus !== 'granted') {
      return
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    })

    const platform = Platform.OS as 'ios' | 'android'

    try {
      await getApi().post('/push/register', {
        token: tokenData.data,
        platform,
      })
    } catch {
      // Registration failed; will retry on next app start
    }

    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#3b82f6',
      })
    }
  }, [userId])

  useEffect(() => {
    registerForPush()

    notificationListener.current = Notifications.addNotificationReceivedListener((_notification) => {
      // Notification received while app is foregrounded — no action needed
    })

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, string>
      onNotificationTap?.(data)
    })

    return () => {
      if (notificationListener.current) {
        if (typeof notificationListener.current.remove === 'function') {
          notificationListener.current.remove()
        } else if (typeof Notifications.removeNotificationSubscription === 'function') {
          Notifications.removeNotificationSubscription(notificationListener.current)
        }
      }
      if (responseListener.current) {
        if (typeof responseListener.current.remove === 'function') {
          responseListener.current.remove()
        } else if (typeof Notifications.removeNotificationSubscription === 'function') {
          Notifications.removeNotificationSubscription(responseListener.current)
        }
      }
    }
  }, [registerForPush, onNotificationTap])
}
