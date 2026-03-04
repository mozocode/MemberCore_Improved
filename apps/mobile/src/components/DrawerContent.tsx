import React, { useEffect, useState, useRef } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Feather } from '@expo/vector-icons'
import type { DrawerContentComponentProps } from '@react-navigation/drawer'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { organizationService, getApi } from '@membercore/services'
import type { RootStackParamList, OrgDrawerParamList } from '../navigation/types'

interface Org {
  id: string
  name: string
  location?: string
  logo?: string | null
  icon_color?: string
  dues_label?: string
}

const MENU_ITEMS: {
  id: keyof OrgDrawerParamList
  label: string
  icon: keyof typeof Feather.glyphMap
}[] = [
  { id: 'Chat', label: 'Chat', icon: 'message-square' },
  { id: 'Messages', label: 'Messages', icon: 'mail' },
  { id: 'Calendar', label: 'Calendar', icon: 'calendar' },
  { id: 'Directory', label: 'Directory', icon: 'map-pin' },
  { id: 'Members', label: 'Members', icon: 'users' },
  { id: 'Dues', label: 'Dues', icon: 'dollar-sign' },
  { id: 'Documents', label: 'Documents', icon: 'file-text' },
  { id: 'Polls', label: 'Polls', icon: 'bar-chart-2' },
  { id: 'Settings', label: 'Settings', icon: 'settings' },
]

export function DrawerContent(props: DrawerContentComponentProps) {
  const { state, navigation } = props
  const insets = useSafeAreaInsets()
  const rootNav = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const [org, setOrg] = useState<Org | null>(null)
  const [unreadMessages, setUnreadMessages] = useState(0)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const activeRoute = state.routes[state.index]?.name
  const orgId =
    (state.routes[0]?.params as { orgId?: string } | undefined)?.orgId || ''

  useEffect(() => {
    if (!orgId) return
    organizationService
      .get(orgId)
      .then((data) => setOrg(data as unknown as Org))
      .catch(() => {})
  }, [orgId])

  useEffect(() => {
    if (!orgId) return
    const fetchUnread = () => {
      getApi()
        .get(`/organizations/${orgId}/dm/conversations`)
        .then((r) => {
          const convs = r.data || []
          const total = convs.reduce((sum: number, c: any) => sum + (c.unread_count || 0), 0)
          setUnreadMessages(total)
        })
        .catch(() => {})
    }
    fetchUnread()
    pollRef.current = setInterval(fetchUnread, 30000)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [orgId])

  const iconColor = org?.icon_color || '#ffffff'

  const handleNav = (screen: keyof OrgDrawerParamList) => {
    navigation.navigate(screen, { orgId })
    navigation.closeDrawer()
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Back to organizations */}
      <TouchableOpacity
        style={styles.backRow}
        onPress={() => {
          navigation.closeDrawer()
          rootNav.navigate('OrgSelector')
        }}
        activeOpacity={0.7}
      >
        <Feather name="x" size={20} color="#a1a1aa" />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.backToOrgs}
        onPress={() => {
          navigation.closeDrawer()
          rootNav.navigate('OrgSelector')
        }}
        activeOpacity={0.7}
      >
        <Text style={styles.backText}>Back to Organizations</Text>
      </TouchableOpacity>

      {/* Org info */}
      {org && (
        <View style={styles.orgInfo}>
          <View style={styles.orgRow}>
            {org.logo ? (
              <Image source={{ uri: org.logo }} style={styles.orgLogo} />
            ) : (
              <View style={[styles.orgLogoPlaceholder, { backgroundColor: '#27272a' }]}>
                <Text style={[styles.orgInitial, { color: iconColor }]}>
                  {org.name.charAt(0)}
                </Text>
              </View>
            )}
            <View style={styles.orgTextBox}>
              <Text style={styles.orgName} numberOfLines={1}>
                {org.name}
              </Text>
              {org.location ? (
                <Text style={styles.orgLocation} numberOfLines={1}>
                  {org.location}
                </Text>
              ) : null}
            </View>
          </View>
        </View>
      )}

      {/* Navigation items */}
      <ScrollView style={styles.nav} showsVerticalScrollIndicator={false}>
        {MENU_ITEMS.map((item) => {
          const isActive = activeRoute === item.id
          const badge = item.id === 'Messages' ? unreadMessages : 0
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.navItem, isActive && styles.navItemActive]}
              onPress={() => handleNav(item.id)}
              activeOpacity={0.7}
            >
              <Feather
                name={item.icon}
                size={20}
                color={iconColor}
              />
              <Text
                style={[styles.navLabel, isActive && styles.navLabelActive]}
              >
                {item.id === 'Dues' && org?.dues_label ? org.dues_label : item.label}
              </Text>
              {badge > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
                </View>
              )}
            </TouchableOpacity>
          )
        })}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  // Close button row — matches web: py-3 px-4 border-b
  backRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  backToOrgs: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    minHeight: 44,
    justifyContent: 'center',
  },
  backText: {
    fontSize: 14,
    color: '#a1a1aa',
  },
  // Org info — matches web: px-4 py-6 border-b
  orgInfo: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  orgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  orgLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  orgLogoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orgInitial: {
    fontSize: 20,
    fontWeight: '700',
  },
  orgTextBox: { flex: 1, minWidth: 0 },
  orgName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  orgLocation: {
    fontSize: 14,
    color: '#a1a1aa',
    marginTop: 2,
  },
  // Nav items — matches web: w-full flex items-center gap-3 px-4 py-4
  nav: { flex: 1, paddingVertical: 8 },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    minHeight: 44,
  },
  navItemActive: {
    backgroundColor: '#27272a',
  },
  navLabel: {
    fontSize: 18,
    color: '#a1a1aa',
    flex: 1,
  },
  navLabelActive: {
    color: '#ffffff',
  },
  badge: {
    backgroundColor: '#3b82f6',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
})
