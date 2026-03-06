import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
type MoreStackParamList = {
  MoreRoot: { orgId: string }
  Messages: { orgId: string }
  Directory: { orgId: string }
  Dues: { orgId: string }
  Documents: { orgId: string }
  Polls: { orgId: string }
  Settings: { orgId: string }
}

type MoreNav = NativeStackNavigationProp<MoreStackParamList, 'MoreRoot'>

const ITEMS: { name: keyof Omit<MoreStackParamList, 'MoreRoot'>; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { name: 'Messages', label: 'Messages', icon: 'mail' },
  { name: 'Directory', label: 'Directory', icon: 'map-pin' },
  { name: 'Dues', label: 'Dues', icon: 'dollar-sign' },
  { name: 'Documents', label: 'Documents', icon: 'file-text' },
  { name: 'Polls', label: 'Polls', icon: 'bar-chart-2' },
  { name: 'Settings', label: 'Settings', icon: 'settings' },
]

export function MoreScreen({ route }: { route: { params: { orgId: string } } }) {
  const navigation = useNavigation<MoreNav>()
  const orgId = route.params?.orgId ?? ''

  return (
    <View style={styles.container}>
      {ITEMS.map(({ name, label, icon }) => (
        <TouchableOpacity
          key={name}
          style={styles.row}
          onPress={() => navigation.navigate(name, { orgId })}
          activeOpacity={0.7}
        >
          <Feather name={icon} size={24} color="#a1a1aa" />
          <Text style={styles.label}>{label}</Text>
          <Feather name="chevron-right" size={20} color="#52525b" />
        </TouchableOpacity>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090b', paddingTop: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#27272a',
    gap: 16,
  },
  label: { flex: 1, fontSize: 17, color: '#fafafa', fontWeight: '500' },
})
