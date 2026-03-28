import React, { useEffect, useState, useMemo, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs'
import type { OrgDrawerParamList } from '../navigation/types'
import { Feather } from '@expo/vector-icons'
import { organizationService, getApi } from '@membercore/services'
import { colors, MIN_TOUCH_TARGET } from '../theme'

interface Org {
  id: string
  name: string
  description?: string
  logo?: string | null
  icon_color?: string
  dues_label?: string
  trial_start_date?: string | { _seconds?: number }
  is_pro?: boolean
  platform_admin_owned?: boolean
}

const TRIAL_DAYS = 30

function parseTrialStart(val: unknown): Date | null {
  if (!val) return null
  if (typeof val === 'string') return new Date(val)
  if (val && typeof val === 'object' && '_seconds' in (val as any)) {
    return new Date(((val as any)._seconds as number) * 1000)
  }
  return null
}

function getTrialInfo(org: Org | null) {
  if (!org) return null
  if (org.is_pro || org.platform_admin_owned) return null
  const start = parseTrialStart(org.trial_start_date)
  if (!start) return null
  const end = new Date(start)
  end.setDate(end.getDate() + TRIAL_DAYS)
  const msLeft = end.getTime() - Date.now()
  if (msLeft <= 0) return { daysLeft: 0, expired: true }
  return { daysLeft: Math.floor(msLeft / (24 * 60 * 60 * 1000)), expired: false }
}

const NAV_ITEMS: { id: string; tab: string; icon: keyof typeof Feather.glyphMap; label: string; sublabel: string }[] = [
  { id: 'chat', tab: 'Chat', icon: 'message-square', label: 'Chat', sublabel: 'Private conversations for your organization.' },
  { id: 'messages', tab: 'Messages', icon: 'mail', label: 'Messages', sublabel: 'Direct messages with members.' },
  { id: 'calendar', tab: 'Calendar', icon: 'calendar', label: 'Calendar', sublabel: 'All upcoming events in one view.' },
  { id: 'directory', tab: 'Directory', icon: 'map-pin', label: 'Directory', sublabel: 'Discover relevant events across the platform.' },
  { id: 'members', tab: 'Members', icon: 'users', label: 'Members', sublabel: 'View and manage your members.' },
  { id: 'dues', tab: 'Dues', icon: 'dollar-sign', label: 'Dues', sublabel: 'Track contributions and payments.' },
  { id: 'documents', tab: 'Documents', icon: 'file-text', label: 'Documents', sublabel: 'Store and share important files.' },
  { id: 'polls', tab: 'Polls', icon: 'bar-chart-2', label: 'Polls', sublabel: 'Make decisions together.' },
  { id: 'settings', tab: 'Settings', icon: 'settings', label: 'Settings', sublabel: 'Control how your organization runs.' },
]

export function OrgHomeScreen({ route }: any) {
  const { orgId } = route.params
  const insets = useSafeAreaInsets()
  const nav = useNavigation<BottomTabNavigationProp<OrgDrawerParamList, 'Home'>>()
  const [org, setOrg] = useState<Org | null>(null)
  const [loading, setLoading] = useState(true)
  const [myRole, setMyRole] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [orgData, meData] = await Promise.allSettled([
        organizationService.get(orgId),
        getApi().get(`/organizations/${orgId}/members/me`),
      ])
      if (orgData.status === 'fulfilled') setOrg(orgData.value as unknown as Org)
      if (meData.status === 'fulfilled') setMyRole(String((meData.value as any).data?.role ?? 'member'))
      else setMyRole('member')
    } catch {
      setMyRole('member')
    }
  }, [orgId])

  useEffect(() => {
    fetchData().finally(() => setLoading(false))
  }, [fetchData])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }, [fetchData])

  // Redirect non-owners/admins to Chat (matches web behavior)
  useEffect(() => {
    if (loading || !myRole) return
    const role = myRole.toLowerCase()
    if (role !== 'owner' && role !== 'admin') {
      nav.navigate('Chat' as any)
    }
  }, [loading, myRole, nav])

  const trial = useMemo(() => getTrialInfo(org), [org])
  const iconColor = org?.icon_color || '#3f3f46'

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  if (!org) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Organization not found</Text>
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#71717a" />}
    >
      {/* Org header */}
      <View style={styles.orgHeader}>
        {org.logo ? (
          <Image source={{ uri: org.logo }} style={styles.orgLogo} />
        ) : (
          <View style={[styles.orgLogoPlaceholder, { backgroundColor: iconColor + '30' }]}>
            <Text style={[styles.orgLogoLetter, { color: iconColor }]}>
              {(org.name || '?').charAt(0)}
            </Text>
          </View>
        )}
        <View style={styles.orgHeaderInfo}>
          <Text style={styles.orgName} numberOfLines={1}>{org.name}</Text>
        </View>
      </View>

      {/* Welcome */}
      <View style={styles.welcomeSection}>
        <Text style={styles.welcomeTitle}>Welcome to {org.name}</Text>
        {org.description ? (
          <Text style={styles.welcomeDesc}>{org.description}</Text>
        ) : null}
      </View>

      {/* Trial countdown */}
      {trial && (
        <View style={[
          styles.trialCard,
          trial.expired
            ? styles.trialExpired
            : trial.daysLeft <= 5
              ? styles.trialWarning
              : styles.trialNormal,
        ]}>
          <Feather
            name="clock"
            size={24}
            color={trial.expired ? '#f87171' : trial.daysLeft <= 5 ? '#fbbf24' : '#71717a'}
          />
          <View style={styles.trialInfo}>
            {trial.expired ? (
              <>
                <Text style={[styles.trialTitle, { color: '#f87171' }]}>Pro trial expired</Text>
                <Text style={styles.trialDesc}>Upgrade to continue accessing Pro features.</Text>
              </>
            ) : (
              <>
                <Text style={[styles.trialTitle, trial.daysLeft <= 5 ? { color: '#fbbf24' } : {}]}>
                  {trial.daysLeft} days left in Pro trial
                </Text>
                <Text style={styles.trialDesc}>
                  Continue access to all Pro features after your 30 day trial.
                </Text>
              </>
            )}
            <TouchableOpacity
              style={styles.goProButton}
              onPress={() => nav.navigate('Settings', { orgId })}
              activeOpacity={0.7}
            >
              <Text style={styles.goProText}>Go Pro</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Navigation cards */}
      <View style={styles.navCards}>
        {NAV_ITEMS.map(({ id, tab, icon, label, sublabel }) => (
          <TouchableOpacity
            key={id}
            style={styles.navCard}
            activeOpacity={0.7}
            onPress={() => {
              if (tab === 'Chat' || tab === 'Calendar' || tab === 'Members') {
                nav.navigate(tab, { orgId })
              } else {
                nav.navigate(tab as keyof OrgDrawerParamList, { orgId } as any)
              }
            }}
          >
            <View style={[styles.navIconBox, { backgroundColor: iconColor + '30' }]}>
              <Feather name={icon} size={24} color={iconColor} />
            </View>
            <View style={styles.navCardInfo}>
              <Text style={styles.navLabel}>{label}</Text>
              <Text style={styles.navSublabel}>{sublabel}</Text>
            </View>
            <Feather name="chevron-right" size={20} color="#71717a" />
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  content: { paddingHorizontal: 24, paddingBottom: 48 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000000' },
  errorText: { color: '#a1a1aa', fontSize: 16 },

  // Org header — web: flex items-center gap-3 mb-6 pb-4 border-b
  orgHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  orgLogo: { width: 48, height: 48, borderRadius: 8 },
  orgLogoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  orgLogoLetter: { fontSize: 20, fontWeight: '700' },
  orgHeaderInfo: { flex: 1, minWidth: 0 },
  orgName: { fontSize: 18, fontWeight: '600', color: '#ffffff' },

  // Welcome — web: text-2xl font-bold mb-2
  welcomeSection: { marginBottom: 32 },
  welcomeTitle: { fontSize: 26, fontWeight: '700', color: '#ffffff', marginBottom: 8 },
  welcomeDesc: { fontSize: 16, color: '#a1a1aa', lineHeight: 22 },

  // Trial — web: rounded-xl border p-4
  trialCard: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 32,
    gap: 12,
    alignItems: 'flex-start',
  },
  trialNormal: { backgroundColor: '#18181b', borderColor: '#3f3f46' },
  trialWarning: { backgroundColor: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.3)' },
  trialExpired: { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)' },
  trialIcon: { marginTop: 2 },
  trialInfo: { flex: 1 },
  trialTitle: { fontSize: 16, fontWeight: '600', color: '#ffffff' },
  trialDesc: { fontSize: 14, color: '#a1a1aa', marginTop: 4, lineHeight: 20 },
  goProButton: {
    marginTop: 12,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  goProText: { color: '#000000', fontSize: 14, fontWeight: '600' },

  navCards: { gap: 14 },
  navCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 20,
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: 12,
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
  },
  navIconBox: {
    width: 52,
    height: 52,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navCardInfo: { flex: 1, minWidth: 0 },
  navLabel: { fontSize: 16, fontWeight: '600', color: '#ffffff' },
  navSublabel: { fontSize: 14, color: '#71717a', marginTop: 2 },
})
