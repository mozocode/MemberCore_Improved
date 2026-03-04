import React from 'react'
import { View, StyleSheet } from 'react-native'

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#27272a',
  },
  line1: {
    height: 14,
    width: '60%',
    maxWidth: 180,
    borderRadius: 4,
    backgroundColor: '#27272a',
  },
  line2: {
    height: 10,
    width: '40%',
    maxWidth: 120,
    borderRadius: 4,
    backgroundColor: '#27272a',
    marginTop: 6,
    opacity: 0.8,
  },
})

/** Placeholder rows for list loading state. Renders 5 skeleton rows. */
export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.row}>
          <View style={styles.avatar} />
          <View style={{ flex: 1 }}>
            <View style={styles.line1} />
            <View style={styles.line2} />
          </View>
        </View>
      ))}
    </>
  )
}
