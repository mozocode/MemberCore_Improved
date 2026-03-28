import React, { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  Image,
} from 'react-native'
import * as Clipboard from 'expo-clipboard'
import * as Haptics from 'expo-haptics'
import * as ImagePicker from 'expo-image-picker'
import { Feather } from '@expo/vector-icons'
import { getApi, billingService } from '@membercore/services'
import * as WebBrowser from 'expo-web-browser'
import { BulkImportMembersModal } from '../../components/BulkImportMembersModal'
import type { RootStackScreenProps } from '../../navigation/types'

type Tab = 'profile' | 'members' | 'billing' | 'danger'

interface OrgData {
  name: string
  description: string
  location: string
  icon_color: string
  slug: string
  logo: string
  invite_code: string
  menu_hidden_pages: string[]
}

interface Member {
  id: string
  user_id: string
  name: string
  email: string
  role: string
  status: string
}

interface BillingData {
  plan: string
  billing_plan?: 'pro_monthly' | 'pro_annual' | null
  billing_status: string
  trial_end_date: string | null
  period_end: string | null
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'profile', label: 'Profile' },
  { key: 'members', label: 'Members' },
  { key: 'billing', label: 'Billing' },
  { key: 'danger', label: 'Danger' },
]

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  owner: { bg: 'rgba(245,158,11,0.2)', text: '#fbbf24' },
  admin: { bg: 'rgba(168,85,247,0.2)', text: '#a78bfa' },
  member: { bg: 'rgba(74,222,128,0.2)', text: '#4ade80' },
  restricted: { bg: 'rgba(161,161,170,0.2)', text: '#a1a1aa' },
}

const STATUS_COLORS: Record<string, string> = {
  active: '#22c55e',
  trial: '#3b82f6',
  past_due: '#ef4444',
  inactive: '#71717a',
}

const ROLE_OPTIONS = ['owner', 'admin', 'member', 'restricted']

export function SettingsOrgScreen({ route, navigation }: RootStackScreenProps<'SettingsOrg'>) {
  const { orgId } = route.params
  const [tab, setTab] = useState<Tab>('profile')

  return (
    <View style={styles.container}>
      <View style={styles.tabRow}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabPill, tab === t.key ? styles.tabActive : styles.tabInactive]}
            activeOpacity={0.7}
            onPress={() => setTab(t.key)}
          >
            <Text style={tab === t.key ? styles.tabActiveText : styles.tabInactiveText}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'profile' && <ProfileTab orgId={orgId} />}
      {tab === 'members' && <MembersTab orgId={orgId} />}
      {tab === 'billing' && <BillingTab orgId={orgId} />}
      {tab === 'danger' && <DangerTab orgId={orgId} navigation={navigation} />}
    </View>
  )
}

/* ─── Profile Tab ─── */

function ProfileTab({ orgId }: { orgId: string }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [form, setForm] = useState<OrgData>({
    name: '',
    description: '',
    location: '',
    icon_color: '#ffffff',
    slug: '',
    logo: '',
    invite_code: '',
    menu_hidden_pages: [],
  })

  useEffect(() => {
    getApi()
      .get(`/organizations/${orgId}`)
      .then((r) => setForm(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [orgId])

  const pickLogo = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Please allow access to your photo library.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    })
    if (result.canceled || !result.assets?.[0]) return
    const asset = result.assets[0]
    setUploadingLogo(true)
    try {
      const formData = new FormData()
      formData.append('file', {
        uri: asset.uri,
        name: 'logo.jpg',
        type: 'image/jpeg',
      } as any)
      await getApi().put(`/organizations/${orgId}/logo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setForm((p) => ({ ...p, logo: asset.uri }))
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } catch {
      Alert.alert('Error', 'Failed to upload logo.')
    } finally {
      setUploadingLogo(false)
    }
  }

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      await getApi().put(`/organizations/${orgId}`, {
        name: form.name,
        description: form.description,
        location: form.location,
        icon_color: form.icon_color,
      })
      Alert.alert('Saved', 'Organization settings updated.')
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.detail || 'Could not save settings.')
    } finally {
      setSaving(false)
    }
  }, [orgId, form])

  const copyInviteCode = useCallback(async () => {
    if (form.invite_code) {
      await Clipboard.setStringAsync(form.invite_code)
      Alert.alert('Copied', 'Invite code copied to clipboard.')
    }
  }, [form.invite_code])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#71717a" />
      </View>
    )
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={styles.card}>
        <Text style={styles.label}>Name *</Text>
        <TextInput
          style={styles.input}
          value={form.name}
          onChangeText={(t) => setForm((p) => ({ ...p, name: t }))}
          placeholder="Organization name"
          placeholderTextColor="#71717a"
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.multilineInput]}
          value={form.description}
          onChangeText={(t) => setForm((p) => ({ ...p, description: t.slice(0, 500) }))}
          placeholder="Describe your organization"
          placeholderTextColor="#71717a"
          multiline
          maxLength={500}
        />
        <Text style={styles.charCount}>{form.description?.length || 0}/500</Text>

        <Text style={styles.label}>Location</Text>
        <TextInput
          style={styles.input}
          value={form.location}
          onChangeText={(t) => setForm((p) => ({ ...p, location: t }))}
          placeholder="City, State"
          placeholderTextColor="#71717a"
        />

        <Text style={styles.label}>Icon Color</Text>
        <View style={styles.colorRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={form.icon_color}
            onChangeText={(t) => setForm((p) => ({ ...p, icon_color: t }))}
            placeholder="#ffffff"
            placeholderTextColor="#71717a"
            autoCapitalize="none"
          />
          <View
            style={[
              styles.colorPreview,
              { backgroundColor: form.icon_color || '#ffffff' },
            ]}
          />
        </View>

        <Text style={styles.label}>Organization Logo</Text>
        <TouchableOpacity style={styles.logoUploadRow} onPress={pickLogo} disabled={uploadingLogo} activeOpacity={0.7}>
          {form.logo ? (
            <Image source={{ uri: form.logo }} style={styles.logoPreview} />
          ) : (
            <View style={styles.logoPlaceholder}>
              <Feather name="image" size={24} color="#71717a" />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.logoUploadText}>{uploadingLogo ? 'Uploading...' : 'Tap to change logo'}</Text>
            <Text style={styles.logoUploadHint}>Square image, at least 256x256px</Text>
          </View>
          {uploadingLogo ? (
            <ActivityIndicator size="small" color="#71717a" />
          ) : (
            <Feather name="upload" size={18} color="#71717a" />
          )}
        </TouchableOpacity>

        <Text style={styles.label}>Invite Code</Text>
        <View style={styles.inviteRow}>
          <Text style={styles.inviteCode}>{form.invite_code || '—'}</Text>
          <TouchableOpacity style={styles.copyButton} onPress={copyInviteCode}>
            <Feather name="copy" size={16} color="#000000" />
            <Text style={styles.copyButtonText}>Copy</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.saveButton, saving && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={saving || !form.name.trim()}
        activeOpacity={0.7}
      >
        {saving ? (
          <ActivityIndicator size="small" color="#000000" />
        ) : (
          <Text style={styles.saveButtonText}>Save Changes</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  )
}

/* ─── Members Tab ─── */

function MembersTab({ orgId }: { orgId: string }) {
  const [loading, setLoading] = useState(true)
  const [members, setMembers] = useState<Member[]>([])
  const [roleModalMember, setRoleModalMember] = useState<Member | null>(null)
  const [bulkImportVisible, setBulkImportVisible] = useState(false)

  const fetchMembers = useCallback(async () => {
    try {
      const r = await getApi().get(`/organizations/${orgId}/members`)
      setMembers(r.data)
    } catch {
      setMembers([])
    }
  }, [orgId])

  useEffect(() => {
    fetchMembers().finally(() => setLoading(false))
  }, [fetchMembers])

  const changeRole = useCallback(
    async (memberId: string, role: string) => {
      try {
        await getApi().put(`/organizations/${orgId}/members/${memberId}`, { role })
        setMembers((prev) =>
          prev.map((m) => (m.id === memberId ? { ...m, role } : m)),
        )
      } catch (err: any) {
        Alert.alert('Error', err?.response?.data?.detail || 'Could not change role.')
      }
      setRoleModalMember(null)
    },
    [orgId],
  )

  const approveMember = useCallback(
    async (memberId: string) => {
      try {
        await getApi().post(`/organizations/${orgId}/members/${memberId}/approve`)
        setMembers((prev) =>
          prev.map((m) => (m.id === memberId ? { ...m, status: 'approved' } : m)),
        )
      } catch (err: any) {
        Alert.alert('Error', err?.response?.data?.detail || 'Could not approve member.')
      }
    },
    [orgId],
  )

  const removeMember = useCallback(
    (member: Member) => {
      Alert.alert(
        'Remove Member',
        `Are you sure you want to remove ${member.name}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: async () => {
              try {
                await getApi().delete(`/organizations/${orgId}/members/${member.id}`)
                setMembers((prev) => prev.filter((m) => m.id !== member.id))
              } catch (err: any) {
                Alert.alert(
                  'Error',
                  err?.response?.data?.detail || 'Could not remove member.',
                )
              }
            },
          },
        ],
      )
    },
    [orgId],
  )

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#71717a" />
      </View>
    )
  }

  return (
    <View style={{ flex: 1 }}>
      <TouchableOpacity
        style={styles.bulkImportButton}
        onPress={() => setBulkImportVisible(true)}
        activeOpacity={0.7}
      >
        <Feather name="upload-cloud" size={18} color="#3b82f6" />
        <Text style={styles.bulkImportButtonText}>Bulk Import from CSV</Text>
      </TouchableOpacity>
      <FlatList
        data={members}
        keyExtractor={(m) => m.id}
        contentContainerStyle={members.length === 0 ? styles.emptyContainer : styles.listContent}
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={11}
        removeClippedSubviews={true}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="users" size={48} color="#71717a" style={{ opacity: 0.5 }} />
            <Text style={styles.emptyText}>No members found</Text>
          </View>
        }
        renderItem={({ item }) => {
          const roleColor = ROLE_COLORS[item.role] ?? ROLE_COLORS.restricted
          const isPending = item.status === 'pending'

          return (
            <View style={styles.memberCard}>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.memberEmail} numberOfLines={1}>
                  {item.email}
                </Text>
              </View>

              <View style={styles.memberActions}>
                <View style={styles.memberBadgeRow}>
                  <View style={[styles.roleBadge, { backgroundColor: roleColor.bg }]}>
                    <Text style={[styles.roleText, { color: roleColor.text }]}>
                      {item.role}
                    </Text>
                  </View>
                  {isPending && (
                    <View style={styles.pendingBadge}>
                      <Text style={styles.pendingText}>Pending</Text>
                    </View>
                  )}
                </View>

                <View style={styles.memberButtons}>
                  {isPending && (
                    <TouchableOpacity
                      style={styles.approveBtn}
                      onPress={() => approveMember(item.id)}
                    >
                      <Feather name="check" size={14} color="#22c55e" />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.roleChangeBtn}
                    onPress={() => setRoleModalMember(item)}
                  >
                    <Feather name="shield" size={14} color="#a1a1aa" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() => removeMember(item)}
                  >
                    <Feather name="x" size={14} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )
        }}
      />

      {/* Role change modal */}
      <Modal
        visible={roleModalMember !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setRoleModalMember(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setRoleModalMember(null)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Change role for {roleModalMember?.name}
            </Text>
            {ROLE_OPTIONS.map((role) => (
              <TouchableOpacity
                key={role}
                style={[
                  styles.modalOption,
                  roleModalMember?.role === role && styles.modalOptionActive,
                ]}
                onPress={() => {
                  if (roleModalMember) changeRole(roleModalMember.id, role)
                }}
              >
                <Text
                  style={[
                    styles.modalOptionText,
                    roleModalMember?.role === role && styles.modalOptionTextActive,
                  ]}
                >
                  {(role || 'member').charAt(0).toUpperCase() + (role || 'member').slice(1)}
                </Text>
                {roleModalMember?.role === role && (
                  <Feather name="check" size={16} color="#ffffff" />
                )}
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setRoleModalMember(null)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <BulkImportMembersModal
        visible={bulkImportVisible}
        onClose={() => setBulkImportVisible(false)}
        orgId={orgId}
        onSuccess={fetchMembers}
      />
    </View>
  )
}

/* ─── Billing Tab ─── */

type ProPlanKey = 'pro_monthly' | 'pro_annual'

function BillingTab({ orgId }: { orgId: string }) {
  const [loading, setLoading] = useState(true)
  const [billing, setBilling] = useState<BillingData | null>(null)
  const [selectedPlan, setSelectedPlan] = useState<ProPlanKey>('pro_annual')
  const [upgradeLoading, setUpgradeLoading] = useState(false)

  const fetchBilling = useCallback(() => {
    getApi()
      .get(`/billing/${orgId}/billing`)
      .then((r) => setBilling(r.data))
      .catch(() => setBilling(null))
      .finally(() => setLoading(false))
  }, [orgId])

  useEffect(() => {
    setLoading(true)
    fetchBilling()
  }, [fetchBilling])

  const handleUpgrade = useCallback(async () => {
    if (!billing || billing.plan === 'pro') return
    setUpgradeLoading(true)
    try {
      const { checkout_url } = await billingService.createCheckoutSession(orgId, selectedPlan)
      if (checkout_url) {
        await WebBrowser.openBrowserAsync(checkout_url)
        fetchBilling()
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      Alert.alert('Upgrade failed', typeof msg === 'string' ? msg : 'Could not start checkout. Try again.')
    } finally {
      setUpgradeLoading(false)
    }
  }, [orgId, selectedPlan, billing?.plan, fetchBilling])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#71717a" />
      </View>
    )
  }

  if (!billing) {
    return (
      <View style={styles.center}>
        <Feather name="credit-card" size={48} color="#71717a" style={{ opacity: 0.5 }} />
        <Text style={styles.emptyText}>Billing information unavailable</Text>
      </View>
    )
  }

  const statusColor = STATUS_COLORS[billing.billing_status] || '#71717a'
  const isPro = billing.plan === 'pro'
  const planLabel = billing.billing_plan === 'pro_annual' ? 'Pro Annual' : billing.billing_plan === 'pro_monthly' ? 'Pro Monthly' : 'Pro'

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      {isPro ? (
        <>
          <View style={styles.card}>
            <View style={styles.billingRow}>
              <Text style={styles.label}>Plan</Text>
              <Text style={styles.value}>{planLabel}</Text>
            </View>
            <View style={styles.billingRow}>
              <Text style={styles.label}>Status</Text>
              <Text style={[styles.value, { color: statusColor }]}>
                {billing.billing_status?.replace('_', ' ').toUpperCase() || 'N/A'}
              </Text>
            </View>
            {billing.period_end && (
              <View style={[styles.billingRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.label}>Renews</Text>
                <Text style={styles.value}>
                  {new Date(billing.period_end).toLocaleDateString()}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.card}>
            <View style={styles.billingInfoRow}>
              <Feather name="info" size={16} color="#3b82f6" />
              <Text style={styles.billingInfoText}>
                Update payment method or cancel on the MemberCore website.
              </Text>
            </View>
          </View>
        </>
      ) : (
        <>
          <Text style={styles.billingPlanHeading}>Choose your plan</Text>
          <TouchableOpacity
            style={[
              styles.planCard,
              selectedPlan === 'pro_annual' && styles.planCardSelected,
            ]}
            onPress={() => setSelectedPlan('pro_annual')}
            activeOpacity={0.7}
          >
            <View style={styles.planCardHeader}>
              <View style={styles.planBadge}>
                <Text style={styles.planBadgeText}>Best Value</Text>
              </View>
              <Text style={styles.planTitle}>Pro Annual</Text>
              <Text style={styles.planPrice}>$970 / year</Text>
              <Text style={styles.planSubtext}>2 months free vs monthly</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.planCard,
              selectedPlan === 'pro_monthly' && styles.planCardSelected,
            ]}
            onPress={() => setSelectedPlan('pro_monthly')}
            activeOpacity={0.7}
          >
            <View style={styles.planCardHeader}>
              <Text style={styles.planTitle}>Pro Monthly</Text>
              <Text style={styles.planPrice}>$97 / month</Text>
              <Text style={styles.planSubtext}>Flat rate, unlimited members</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.upgradeButton, upgradeLoading && styles.upgradeButtonDisabled]}
            onPress={handleUpgrade}
            disabled={upgradeLoading}
            activeOpacity={0.7}
          >
            {upgradeLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.upgradeButtonText}>Upgrade to MemberCore Pro</Text>
            )}
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  )
}

/* ─── Danger Tab ─── */

function DangerTab({
  orgId,
  navigation,
}: {
  orgId: string
  navigation: RootStackScreenProps<'SettingsOrg'>['navigation']
}) {
  const [deleteText, setDeleteText] = useState('')
  const [deleting, setDeleting] = useState(false)

  const canDelete = deleteText === 'DELETE'

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Delete Organization',
      'This action is permanent and cannot be undone. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true)
            try {
              await getApi().delete(`/organizations/${orgId}`)
              Alert.alert('Deleted', 'Organization has been deleted.', [
                { text: 'OK', onPress: () => navigation.navigate('OrgSelector') },
              ])
            } catch (err: any) {
              Alert.alert(
                'Error',
                err?.response?.data?.detail || 'Could not delete organization.',
              )
            } finally {
              setDeleting(false)
            }
          },
        },
      ],
    )
  }, [orgId, navigation])

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={styles.dangerCard}>
        <View style={styles.dangerHeader}>
          <Feather name="alert-triangle" size={20} color="#ef4444" />
          <Text style={styles.dangerTitle}>Delete Organization</Text>
        </View>
        <Text style={styles.dangerDesc}>
          This will permanently delete the organization, all members, events, documents, and
          associated data. This action cannot be undone.
        </Text>

        <Text style={styles.label}>Type "DELETE" to confirm</Text>
        <TextInput
          style={styles.input}
          value={deleteText}
          onChangeText={setDeleteText}
          placeholder='Type "DELETE"'
          placeholderTextColor="#71717a"
          autoCapitalize="characters"
        />

        <TouchableOpacity
          style={[styles.deleteButton, !canDelete && styles.deleteButtonDisabled]}
          onPress={handleDelete}
          disabled={!canDelete || deleting}
          activeOpacity={0.7}
        >
          {deleting ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.deleteButtonText}>Delete Organization</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

/* ─── Styles ─── */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
    gap: 12,
  },
  scrollContent: { padding: 16, paddingBottom: 48 },

  /* Tabs */
  tabRow: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: '#111113',
    marginHorizontal: 16,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginTop: 12,
    marginBottom: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  tabPill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },
  tabActive: { backgroundColor: '#ffffff' },
  tabInactive: { backgroundColor: 'transparent' },
  tabActiveText: { color: '#000000', fontSize: 13, fontWeight: '700' },
  tabInactiveText: { color: '#a1a1aa', fontSize: 13, fontWeight: '600' },

  /* Card */
  card: {
    backgroundColor: '#18181b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(39,39,42,0.8)',
    marginBottom: 16,
  },

  /* Form */
  label: {
    color: '#a1a1aa',
    fontSize: 13,
    marginBottom: 6,
    marginTop: 12,
  },
  value: {
    color: '#ffffff',
    fontSize: 15,
  },
  input: {
    backgroundColor: '#27272a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: 'rgba(63,63,70,0.6)',
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  charCount: {
    color: '#71717a',
    fontSize: 11,
    textAlign: 'right',
    marginTop: 4,
  },
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoUploadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#27272a',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(63,63,70,0.6)',
  },
  logoPreview: { width: 48, height: 48, borderRadius: 8 },
  logoPlaceholder: {
    width: 48, height: 48, borderRadius: 8, backgroundColor: '#3f3f46',
    justifyContent: 'center', alignItems: 'center',
  },
  logoUploadText: { color: '#ffffff', fontSize: 14, fontWeight: '500' },
  logoUploadHint: { color: '#71717a', fontSize: 12, marginTop: 2 },
  colorPreview: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'rgba(63,63,70,0.6)',
  },

  /* Invite code */
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#27272a',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(63,63,70,0.6)',
  },
  inviteCode: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '500',
    fontFamily: 'monospace',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
  },
  copyButtonText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '600',
  },

  /* Save button */
  saveButton: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '600',
  },

  /* Members */
  listContent: { padding: 16, paddingBottom: 32 },
  emptyContainer: { flexGrow: 1 },
  bulkImportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(59,130,246,0.15)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.3)',
  },
  bulkImportButtonText: { color: '#3b82f6', fontSize: 15, fontWeight: '600' },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyText: { color: '#71717a', fontSize: 15, marginTop: 12 },
  memberCard: {
    backgroundColor: '#18181b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(39,39,42,0.8)',
    marginBottom: 10,
  },
  memberInfo: {
    marginBottom: 10,
  },
  memberName: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '500',
  },
  memberEmail: {
    color: '#71717a',
    fontSize: 13,
    marginTop: 2,
  },
  memberActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  memberBadgeRow: {
    flexDirection: 'row',
    gap: 6,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  roleText: { fontSize: 11, fontWeight: '600' },
  pendingBadge: {
    backgroundColor: 'rgba(251,191,36,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  pendingText: {
    color: '#fbbf24',
    fontSize: 11,
    fontWeight: '600',
  },
  memberButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  approveBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(34,197,94,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleChangeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#27272a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(239,68,68,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Role modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  modalContent: {
    backgroundColor: '#18181b',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: 'rgba(39,39,42,0.8)',
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 16,
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  modalOptionActive: {
    backgroundColor: '#27272a',
  },
  modalOptionText: {
    color: '#a1a1aa',
    fontSize: 15,
  },
  modalOptionTextActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  modalCancel: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#27272a',
  },
  modalCancelText: {
    color: '#a1a1aa',
    fontSize: 14,
    fontWeight: '600',
  },

  /* Billing */
  billingPlanHeading: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 12,
  },
  planCard: {
    backgroundColor: '#18181b',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#3f3f46',
    padding: 16,
    marginBottom: 12,
  },
  planCardSelected: {
    borderColor: '#3b82f6',
    backgroundColor: 'rgba(59,130,246,0.08)',
  },
  planCardHeader: { gap: 4 },
  planBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#22c55e',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 4,
  },
  planBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  planTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
  },
  planPrice: {
    color: '#a1a1aa',
    fontSize: 15,
    marginTop: 2,
  },
  planSubtext: {
    color: '#71717a',
    fontSize: 13,
    marginTop: 2,
  },
  upgradeButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  upgradeButtonDisabled: { opacity: 0.6 },
  upgradeButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  billingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(39,39,42,0.5)',
  },
  billingInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  billingInfoText: {
    color: '#a1a1aa',
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },

  /* Danger */
  dangerCard: {
    backgroundColor: '#18181b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  dangerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  dangerTitle: {
    color: '#ef4444',
    fontSize: 17,
    fontWeight: '600',
  },
  dangerDesc: {
    color: '#a1a1aa',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  deleteButton: {
    backgroundColor: '#ef4444',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  deleteButtonDisabled: {
    opacity: 0.4,
  },
  deleteButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
})
