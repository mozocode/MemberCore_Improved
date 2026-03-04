import React, { useEffect, useState, useCallback } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, RefreshControl } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { getApi } from '@membercore/services'
import type { OrgDrawerScreenProps, RootStackParamList } from '../navigation/types'

type SettingsNav = NativeStackNavigationProp<RootStackParamList>

interface SettingOption {
  id: string
  title: string
  description: string
  icon: keyof typeof Feather.glyphMap
  route: keyof RootStackParamList
  permission: string
}

const ALL_SETTINGS: SettingOption[] = [
  { id: 'personal', title: 'Personal Settings', description: 'Update your name and profile photo.', icon: 'user', route: 'SettingsPersonal', permission: 'settings.personal' },
  { id: 'organization', title: 'Organization Settings', description: 'Edit organization info, location, logo, billing, and manage members.', icon: 'briefcase', route: 'SettingsOrg', permission: 'org.settings' },
  { id: 'my-tickets', title: 'My Tickets', description: 'View your purchased event tickets and QR codes.', icon: 'tag', route: 'SettingsMyTickets', permission: 'settings.personal' },
  { id: 'event-options', title: 'Event Options', description: 'Manage event check-ins and ticket verification.', icon: 'settings', route: 'SettingsEventOptions', permission: 'events.manage' },
  { id: 'analytics', title: 'Analytics Dashboard', description: 'View member growth, event attendance, revenue, and engagement metrics.', icon: 'bar-chart-2', route: 'SettingsAnalytics', permission: 'org.settings' },
  { id: 'dues', title: 'Payment Settings', description: 'Create and manage payment plans.', icon: 'dollar-sign', route: 'SettingsPayments', permission: 'dues.manage' },
  { id: 'documents', title: 'Document Settings', description: 'Upload and manage documents for your organization.', icon: 'file-text', route: 'SettingsDocuments', permission: 'documents.manage' },
  { id: 'directory', title: 'Directory Settings', description: 'Manage how your public events appear in the directory.', icon: 'map-pin', route: 'SettingsDirectory', permission: 'org.settings' },
  { id: 'affiliate', title: 'Affiliate Settings', description: 'Manage your affiliate program with Rewardful.', icon: 'link', route: 'SettingsAffiliate', permission: 'org.settings' },
  { id: 'video-tutorials', title: 'Video Tutorials', description: 'Watch short videos on how to use the platform.', icon: 'play-circle', route: 'SettingsVideoTutorials', permission: 'settings.personal' },
]

const PERMISSION_MAP: Record<string, string[]> = {
  owner: ['settings.personal', 'org.settings', 'events.manage', 'dues.manage', 'documents.manage'],
  admin: ['settings.personal', 'org.settings', 'events.manage', 'dues.manage', 'documents.manage'],
  member: ['settings.personal'],
  restricted: ['settings.personal'],
}

export function SettingsScreen({ route }: OrgDrawerScreenProps<'Settings'>) {
  const { orgId } = route.params
  const navigation = useNavigation<SettingsNav>()
  const [role, setRole] = useState<string>('member')
  const [refreshing, setRefreshing] = useState(false)

  const fetchRole = useCallback(async () => {
    try {
      const r = await getApi().get(`/organizations/${orgId}/members/me`)
      setRole(r.data?.role || 'member')
    } catch {
      setRole('member')
    }
  }, [orgId])

  useEffect(() => { fetchRole() }, [fetchRole])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchRole()
    setRefreshing(false)
  }, [fetchRole])

  const permissions = PERMISSION_MAP[role] || PERMISSION_MAP.member
  const visibleSettings = ALL_SETTINGS.filter((s) => permissions.includes(s.permission))

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#71717a" />}
    >
      {visibleSettings.map((setting) => (
        <TouchableOpacity
          key={setting.id}
          style={styles.card}
          activeOpacity={0.7}
          onPress={() =>
            navigation.navigate(setting.route as any, { orgId })
          }
        >
          <View style={styles.iconBox}>
            <Feather name={setting.icon} size={24} color="#a1a1aa" />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle}>{setting.title}</Text>
            <Text style={styles.cardDesc}>{setting.description}</Text>
          </View>
          <Feather name="chevron-right" size={20} color="#71717a" />
        </TouchableOpacity>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  content: { padding: 16, paddingBottom: 48 },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#18181b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(39,39,42,0.8)',
    gap: 12,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: '#27272a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInfo: { flex: 1, minWidth: 0 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#ffffff' },
  cardDesc: { fontSize: 13, color: '#71717a', marginTop: 2, lineHeight: 18 },
})
