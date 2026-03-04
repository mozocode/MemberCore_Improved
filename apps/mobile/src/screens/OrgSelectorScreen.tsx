import React, { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Image,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import * as Linking from 'expo-linking'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Feather } from '@expo/vector-icons'
import { organizationService } from '@membercore/services'
import { getApi } from '@membercore/services'
import type { RootStackParamList } from '../navigation/types'
import { colors, MIN_TOUCH_TARGET } from '../theme'
import { useAuth } from '../contexts/AuthContext'

interface Org {
  id: string
  name: string
  type?: string
  logo?: string
  icon_color?: string
  membership_status?: 'approved' | 'pending'
  member_count?: number
}

type Nav = NativeStackNavigationProp<RootStackParamList, 'OrgSelector'>

export function OrgSelectorScreen() {
  const insets = useSafeAreaInsets()
  const nav = useNavigation<Nav>()
  const { user, signout } = useAuth()
  const [orgs, setOrgs] = useState<Org[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [joinModalOpen, setJoinModalOpen] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const [joinLoading, setJoinLoading] = useState(false)
  const [joinError, setJoinError] = useState('')

  const fetchOrgs = useCallback(async () => {
    try {
      const data = await organizationService.list()
      setOrgs(data as Org[])
    } catch {
      // silently fail
    }
  }, [])

  useEffect(() => {
    fetchOrgs().finally(() => setLoading(false))
  }, [fetchOrgs])

  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      const parsed = Linking.parse(event.url)
      if (parsed.path?.startsWith('join/')) {
        const code = parsed.path.replace('join/', '')
        if (code) {
          setInviteCode(code)
          setJoinError('')
          setJoinModalOpen(true)
        }
      }
    }
    const sub = Linking.addEventListener('url', handleDeepLink)
    Linking.getInitialURL().then((url) => { if (url) handleDeepLink({ url }) })
    return () => sub.remove()
  }, [])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchOrgs()
    setRefreshing(false)
  }, [fetchOrgs])

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signout() },
    ])
  }

  const handleJoinOrg = async () => {
    const code = inviteCode.trim().toUpperCase()
    if (!code) return
    setJoinLoading(true)
    setJoinError('')
    try {
      const api = getApi()
      const { data } = await api.post(`/organizations/join/${code}`)
      setJoinModalOpen(false)
      setInviteCode('')
      await fetchOrgs()
      if (data?.status === 'pending') {
        Alert.alert('Pending Approval', 'Your membership is pending approval. The organization owner will review your request.')
      } else if (data?.organization_id || data?.org_id) {
        const orgId = data.organization_id || data.org_id
        nav.navigate('OrgTabs', { orgId, screen: 'Home', params: { orgId } })
      }
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      if (typeof detail === 'string' && detail.toLowerCase().includes('already a member')) {
        setJoinModalOpen(false)
        setInviteCode('')
        await fetchOrgs()
        Alert.alert('Already a Member', 'You are already a member of this organization.')
      } else {
        const isNetworkError = !err?.response && (err?.message?.includes('Network') || err?.code === 'ERR_NETWORK')
        setJoinError(
          isNetworkError
            ? 'No internet connection. Please check your network and try again.'
            : typeof detail === 'string' ? detail : 'Invalid invite code or failed to join.',
        )
      }
    } finally {
      setJoinLoading(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Nav bar — matches web: px-4 py-4 border-b border-zinc-800 */}
      <View style={[styles.nav, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.brand}>MemberCore</Text>
        <View style={styles.navRight}>
          <Text style={styles.email} numberOfLines={1}>{user?.email}</Text>
          <TouchableOpacity onPress={() => setMenuOpen(!menuOpen)} hitSlop={8}>
            <Text style={styles.menuDots}>⋮</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Dropdown menu */}
      {menuOpen && (
        <View style={[styles.dropdown, { top: insets.top + 56 }]}>
          <TouchableOpacity
            style={styles.dropdownItem}
            onPress={() => {
              setMenuOpen(false)
              setJoinError('')
              setInviteCode('')
              setJoinModalOpen(true)
            }}
          >
            <Text style={styles.dropdownText}>Join an organization</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.dropdownItem, styles.dropdownItemLast]}
            onPress={() => {
              setMenuOpen(false)
              handleSignOut()
            }}
          >
            <Text style={[styles.dropdownText, { color: colors.danger }]}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Main content — matches web: px-4 py-8, title mb-8 */}
      <FlatList
        data={orgs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.main}
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={11}
        removeClippedSubviews={true}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListHeaderComponent={
          <Text style={styles.title}>Your Organizations</Text>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Feather name="users" size={48} color="#71717a" style={styles.emptyIcon} />
            <Text style={styles.emptyTitle}>No organizations yet</Text>
            <Text style={styles.emptySubtitle}>
              Join an organization using an invite code to get started.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isPending = item.membership_status === 'pending'
          return (
            <TouchableOpacity
              style={[styles.card, isPending && styles.cardPending]}
              onPress={() => {
                if (isPending) return
                nav.navigate('OrgTabs', { orgId: item.id, screen: 'Home', params: { orgId: item.id } })
              }}
              activeOpacity={isPending ? 1 : 0.7}
            >
              {item.logo ? (
                <Image source={{ uri: item.logo }} style={styles.orgLogo} />
              ) : (
                <View style={[styles.orgLogoPlaceholder, { backgroundColor: item.icon_color || '#3f3f46' }]}>
                  <Feather name="users" size={22} color="#ffffff" />
                </View>
              )}
              <View style={styles.info}>
                <Text style={styles.orgName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.orgType}>{item.type || 'Organization'}</Text>
              </View>
              {isPending && (
                <View style={styles.pendingBadge}>
                  <Text style={styles.pendingText}>Pending approval</Text>
                </View>
              )}
            </TouchableOpacity>
          )
        }}
        ListFooterComponent={null}
      />

      {/* Join Organization Modal */}
      <Modal
        visible={joinModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setJoinModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setJoinModalOpen(false)}
          >
            <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Join an organization</Text>
                <TouchableOpacity onPress={() => setJoinModalOpen(false)} hitSlop={8}>
                  <Feather name="x" size={20} color="#a1a1aa" />
                </TouchableOpacity>
              </View>
              <Text style={styles.modalSubtitle}>
                Enter the invite code you received from the organization.
              </Text>
              <TextInput
                style={styles.modalInput}
                placeholder="e.g. ABC12345"
                placeholderTextColor="#71717a"
                value={inviteCode}
                onChangeText={(t) => { setInviteCode(t); setJoinError('') }}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={20}
                returnKeyType="go"
                onSubmitEditing={handleJoinOrg}
              />
              {joinError ? (
                <Text style={styles.modalError}>{joinError}</Text>
              ) : null}
              <TouchableOpacity
                style={[styles.modalButton, (!inviteCode.trim() || joinLoading) && styles.modalButtonDisabled]}
                onPress={handleJoinOrg}
                disabled={!inviteCode.trim() || joinLoading}
                activeOpacity={0.7}
              >
                {joinLoading ? (
                  <ActivityIndicator size="small" color={colors.black} />
                ) : (
                  <Text style={styles.modalButtonText}>Continue</Text>
                )}
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },

  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    minHeight: MIN_TOUCH_TARGET,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  // web: text-xl font-bold
  brand: { fontSize: 20, fontWeight: '700', color: colors.text },
  // web: flex items-center gap-4
  navRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  // web: text-sm text-zinc-400
  email: { fontSize: 14, color: '#a1a1aa', maxWidth: 200 },
  menuDots: { fontSize: 22, color: '#a1a1aa', paddingHorizontal: 4 },

  dropdown: {
    position: 'absolute',
    right: 16,
    backgroundColor: '#18181b',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3f3f46',
    zIndex: 100,
    minWidth: 220,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  dropdownItem: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#3f3f46',
  },
  dropdownItemLast: { borderBottomWidth: 0 },
  // web: text-sm text-zinc-200
  dropdownText: { fontSize: 14, color: '#e4e4e7' },

  // Main — web: px-4 py-8
  main: {
    paddingHorizontal: 16,
    paddingTop: 32,
    paddingBottom: 48,
  },
  // web: text-2xl font-bold mb-8
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 32,
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181b',
    borderRadius: 10,
    padding: 20,
    minHeight: MIN_TOUCH_TARGET,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  cardPending: { opacity: 0.6 },

  // web: h-12 w-12 rounded-lg + gap-4
  orgLogo: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 16,
  },
  orgLogoPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  orgLogoIcon: {},

  info: { flex: 1 },
  // web: CardTitle ~18px bold
  orgName: { color: colors.text, fontSize: 18, fontWeight: '600' },
  // web: text-sm text-zinc-400
  orgType: { color: '#a1a1aa', fontSize: 14, marginTop: 2 },

  pendingBadge: {
    backgroundColor: '#27272a',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pendingText: { color: '#a1a1aa', fontSize: 13 },

  emptyContainer: { alignItems: 'center', paddingTop: 64 },
  emptyIcon: { marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: colors.text, marginBottom: 8 },
  emptySubtitle: { fontSize: 16, color: '#71717a', textAlign: 'center', maxWidth: 280, lineHeight: 22 },

  // Join Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#18181b',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#a1a1aa',
    marginBottom: 16,
    lineHeight: 20,
  },
  modalInput: {
    backgroundColor: '#27272a',
    borderWidth: 1,
    borderColor: '#3f3f46',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#ffffff',
    fontSize: 16,
    marginBottom: 8,
  },
  modalError: {
    color: '#ef4444',
    fontSize: 13,
    marginBottom: 8,
  },
  modalButton: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  modalButtonDisabled: {
    opacity: 0.5,
  },
  modalButtonText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '600',
  },
})
