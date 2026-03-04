import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { Feather } from '@expo/vector-icons'
import NetInfo from '@react-native-community/netinfo'

export function NetworkBanner() {
  const [isOffline, setIsOffline] = useState(false)

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOffline(!(state.isConnected && state.isInternetReachable !== false))
    })
    return () => unsubscribe()
  }, [])

  if (!isOffline) return null

  return (
    <View style={styles.banner}>
      <Feather name="wifi-off" size={16} color="#fbbf24" />
      <Text style={styles.text}>No internet connection</Text>
      <TouchableOpacity
        onPress={() => NetInfo.fetch().then((s) => setIsOffline(!(s.isConnected && s.isInternetReachable !== false)))}
        hitSlop={8}
      >
        <Text style={styles.retry}>Retry</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#78350f',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  text: {
    color: '#fbbf24',
    fontSize: 13,
    fontWeight: '500',
  },
  retry: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
})
