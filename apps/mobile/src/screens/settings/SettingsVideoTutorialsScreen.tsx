import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Feather } from '@expo/vector-icons'
import type { RootStackScreenProps } from '../../navigation/types'

export function SettingsVideoTutorialsScreen({
  route,
}: RootStackScreenProps<'SettingsVideoTutorials'>) {
  const { orgId: _orgId } = route.params

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Feather
          name="play-circle"
          size={48}
          color="rgba(113,113,122,0.5)"
          style={styles.icon}
        />
        <Text style={styles.title}>Video Tutorials</Text>
        <Text style={styles.subtitle}>
          Coming soon. Watch short videos on how to use the platform.
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    backgroundColor: '#18181b',
    borderRadius: 12,
    padding: 32,
    borderWidth: 1,
    borderColor: 'rgba(39,39,42,0.8)',
    alignItems: 'center',
    width: '100%',
  },
  icon: {
    marginBottom: 16,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#a1a1aa',
    textAlign: 'center',
    lineHeight: 18,
  },
})
