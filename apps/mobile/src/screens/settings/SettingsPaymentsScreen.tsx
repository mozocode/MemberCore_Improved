import React, { useEffect, useState, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  ScrollView,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { getApi } from '@membercore/services'
import type { RootStackScreenProps } from '../../navigation/types'

interface PaymentPlan {
  id: string
  name: string
  amount: number
  total_amount?: number
  due_date?: string | null
  frequency: string
  payment_option?: string
}

interface TreasuryStats {
  total_collected: number
  paid_in_full_count: number
  paid_count: number
  past_due_count: number
  pending_count: number
}

interface MemberPlanBalanceRow {
  plan_id: string
  plan_name: string
  total: number
  paid: number
  paid_in_full: boolean
}

interface MemberStatusRow {
  member_id: string
  name?: string
  user_name?: string
  nickname?: string
  title?: string
  total_paid: number
  status: string
  paid_in_full?: boolean
  dues_waived?: boolean
  plan_balances?: MemberPlanBalanceRow[]
}

function memberRowDisplayName(m: MemberStatusRow): string {
  return m.name || m.user_name || m.nickname || 'Member'
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  paid_in_full: { bg: 'rgba(59,130,246,0.2)', text: '#60a5fa' },
  paid: { bg: 'rgba(34,197,94,0.2)', text: '#4ade80' },
  partial: { bg: 'rgba(245,158,11,0.2)', text: '#fbbf24' },
  pending: { bg: 'rgba(245,158,11,0.2)', text: '#fbbf24' },
  past_due: { bg: 'rgba(239,68,68,0.2)', text: '#f87171' },
}

const STATUS_LABELS: Record<string, string> = {
  paid_in_full: 'Paid in Full',
  paid: 'Paid',
  partial: 'Partial',
  pending: 'Pending',
  past_due: 'Past Due',
}

const TERMINOLOGY_OPTIONS = ['Dues', 'Contribution', 'Donation', 'Offering', 'Membership Fee', 'Payments', 'Sponsorship']

export function SettingsPaymentsScreen({
  route,
}: RootStackScreenProps<'SettingsPayments'>) {
  const { orgId } = route.params
  const api = getApi()

  const [plans, setPlans] = useState<PaymentPlan[]>([])
  const [treasury, setTreasury] = useState<TreasuryStats | null>(null)
  const [members, setMembers] = useState<MemberStatusRow[]>([])
  const [duesLabel, setDuesLabel] = useState('Dues')
  const [terminologyValue, setTerminologyValue] = useState('Dues')
  const [terminologySaving, setTerminologySaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [markingMemberId, setMarkingMemberId] = useState<string | null>(null)
  const [remindLoading, setRemindLoading] = useState(false)

  // Create/Edit Plan modal
  const [planModalVisible, setPlanModalVisible] = useState(false)
  const [editingPlan, setEditingPlan] = useState<PaymentPlan | null>(null)
  const [planName, setPlanName] = useState('')
  const [planAmount, setPlanAmount] = useState('')
  const [planTotalAmount, setPlanTotalAmount] = useState('')
  const [planDate, setPlanDate] = useState('')
  const [planPaymentOption, setPlanPaymentOption] = useState<'full_only' | 'custom_only'>('full_only')
  const [planError, setPlanError] = useState('')
  const [planLoading, setPlanLoading] = useState(false)

  // Record Payment modal
  const [recordModalVisible, setRecordModalVisible] = useState(false)
  const [recordMemberId, setRecordMemberId] = useState('')
  const [recordAmount, setRecordAmount] = useState('')
  const [recordNotes, setRecordNotes] = useState('')
  const [recordSubmitting, setRecordSubmitting] = useState(false)
  const [recordError, setRecordError] = useState('')

  // Terminology picker
  const [showTermPicker, setShowTermPicker] = useState(false)

  const treasuryPlansTotal = useMemo(
    () => plans.reduce((s, p) => s + (p.total_amount ?? p.amount ?? 0), 0),
    [plans],
  )

  const fetchPlans = useCallback(async () => {
    try {
      const [pRes, oRes] = await Promise.all([
        api.get(`/dues/${orgId}/plans`),
        api.get(`/organizations/${orgId}`),
      ])
      setPlans(Array.isArray(pRes.data) ? pRes.data : [])
      setDuesLabel(oRes.data?.dues_label || 'Dues')
      setTerminologyValue(oRes.data?.dues_label || 'Dues')
    } catch {
      setPlans([])
    }
  }, [orgId])

  const fetchTreasury = useCallback(async () => {
    try {
      const [statsRes, statusRes] = await Promise.all([
        api.get(`/dues/${orgId}/treasury`),
        api.get(`/dues/${orgId}/member-status`),
      ])
      setTreasury(statsRes.data)
      setMembers(Array.isArray(statusRes.data) ? statusRes.data : [])
    } catch {
      setTreasury(null)
      setMembers([])
    }
  }, [orgId])

  const fetchAll = useCallback(async () => {
    await Promise.all([fetchPlans(), fetchTreasury()])
  }, [fetchPlans, fetchTreasury])

  useEffect(() => {
    fetchAll().finally(() => setLoading(false))
  }, [fetchAll])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchAll()
    setRefreshing(false)
  }, [fetchAll])

  // Terminology
  const handleSaveTerminology = async () => {
    setTerminologySaving(true)
    try {
      await api.put(`/organizations/${orgId}`, { dues_label: terminologyValue })
      setDuesLabel(terminologyValue)
      Alert.alert('Saved', 'Terminology updated.')
    } catch {
      Alert.alert('Error', 'Failed to save terminology.')
    } finally {
      setTerminologySaving(false)
    }
  }

  // Create / Edit Plan
  const openCreatePlan = () => {
    setEditingPlan(null)
    setPlanName('')
    setPlanAmount('')
    setPlanTotalAmount('')
    setPlanDate('')
    setPlanPaymentOption('full_only')
    setPlanError('')
    setPlanModalVisible(true)
  }

  const openEditPlan = (p: PaymentPlan) => {
    setEditingPlan(p)
    setPlanName(p.name)
    setPlanAmount(String(p.amount))
    setPlanTotalAmount(p.total_amount != null ? String(p.total_amount) : '')
    setPlanDate(p.due_date || '')
    setPlanPaymentOption(p.payment_option === 'custom_only' ? 'custom_only' : 'full_only')
    setPlanError('')
    setPlanModalVisible(true)
  }

  const handleDeletePlan = (planId: string, planName: string) => {
    Alert.alert('Delete Plan', `Are you sure you want to delete "${planName}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/dues/${orgId}/plans/${planId}`)
            setPlanModalVisible(false)
            fetchPlans()
          } catch (err: any) {
            Alert.alert('Error', err?.response?.data?.detail || 'Failed to delete plan.')
          }
        },
      },
    ])
  }

  const handleSavePlan = async () => {
    setPlanError('')
    const amount = parseFloat(planAmount)
    const totalParsed = planTotalAmount.trim() ? parseFloat(planTotalAmount) : null
    if (!planName.trim()) { setPlanError('Name is required'); return }
    if (isNaN(amount) || amount <= 0) { setPlanError('Amount must be > 0'); return }
    if (totalParsed !== null && (isNaN(totalParsed) || totalParsed < amount)) { setPlanError('Total must be >= installment'); return }
    setPlanLoading(true)
    try {
      const payload = {
        name: planName.trim(),
        amount,
        total_amount: totalParsed ?? undefined,
        due_date: planDate || undefined,
        frequency: editingPlan?.frequency || 'one_time',
        payment_option: planPaymentOption,
      }
      if (editingPlan) {
        await api.put(`/dues/${orgId}/plans/${editingPlan.id}`, payload)
      } else {
        await api.post(`/dues/${orgId}/plans`, payload)
      }
      setPlanModalVisible(false)
      fetchPlans()
    } catch (err: any) {
      setPlanError(err?.response?.data?.detail || 'Failed to save plan')
    } finally {
      setPlanLoading(false)
    }
  }

  // Record Payment
  const handleRecordPayment = async () => {
    setRecordError('')
    const amount = parseFloat(recordAmount)
    if (!recordMemberId) { setRecordError('Select a member'); return }
    if (isNaN(amount) || amount <= 0) { setRecordError('Enter a valid amount'); return }
    setRecordSubmitting(true)
    try {
      await api.post(`/dues/${orgId}/manual-payment`, {
        member_id: recordMemberId,
        amount,
        payment_method: 'other',
        notes: recordNotes.trim() || undefined,
      })
      setRecordModalVisible(false)
      setRecordMemberId('')
      setRecordAmount('')
      setRecordNotes('')
      fetchTreasury()
    } catch (err: any) {
      setRecordError(err?.response?.data?.detail || 'Failed to record payment')
    } finally {
      setRecordSubmitting(false)
    }
  }

  // Mark Paid in Full
  const handleMarkPaidInFull = async (memberId: string, current: boolean) => {
    setMarkingMemberId(memberId)
    try {
      await api.post(`/dues/${orgId}/mark-paid-in-full`, { member_id: memberId, paid_in_full: !current })
      fetchTreasury()
    } finally {
      setMarkingMemberId(null)
    }
  }

  // Send Reminders (backend sends email via Resend, optional push + in-app; see API `message`)
  const handleSendReminders = async () => {
    setRemindLoading(true)
    try {
      const res = await api.post<{ message?: string; ok?: boolean }>(`/dues/${orgId}/remind`)
      const msg =
        typeof res.data?.message === 'string' && res.data.message.trim()
          ? res.data.message
          : 'Reminders processed.'
      Alert.alert('Reminders', msg)
      fetchTreasury()
    } catch {
      Alert.alert('Error', 'Failed to send reminders.')
    } finally {
      setRemindLoading(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ffffff" />}
      >
        {/* ── Terminology ── */}
        <View style={styles.card}>
          <Text style={styles.cardHeading}>Terminology</Text>
          <Text style={styles.cardSubtext}>What do you call payments?</Text>
          <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowTermPicker(true)} activeOpacity={0.7}>
            <Text style={styles.pickerBtnText}>{terminologyValue}</Text>
            <Feather name="chevron-down" size={18} color="#a1a1aa" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveBtn, (terminologySaving || terminologyValue === duesLabel) && styles.saveBtnDisabled]}
            onPress={handleSaveTerminology}
            disabled={terminologySaving || terminologyValue === duesLabel}
            activeOpacity={0.7}
          >
            {terminologySaving ? (
              <ActivityIndicator size="small" color="#000000" />
            ) : (
              <Text style={styles.saveBtnText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Payment Plans ── */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardHeading}>Payment Plans</Text>
            <TouchableOpacity style={styles.createPlanBtn} onPress={openCreatePlan} activeOpacity={0.7}>
              <Feather name="plus" size={16} color="#000000" />
              <Text style={styles.createPlanBtnText}>Create Plan</Text>
            </TouchableOpacity>
          </View>

          {plans.length === 0 ? (
            <Text style={styles.emptyText}>No payment plans yet</Text>
          ) : (
            plans.map((plan) => (
              <TouchableOpacity key={plan.id} style={styles.planRow} onPress={() => openEditPlan(plan)} activeOpacity={0.7}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.planName}>{plan.name}</Text>
                  <Text style={styles.planDetail}>
                    ${(plan.amount ?? 0).toFixed(2)} / ${(plan.total_amount ?? plan.amount ?? 0).toFixed(2)} total
                  </Text>
                </View>
                <Feather name="edit-2" size={16} color="#71717a" />
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* ── Treasury Dashboard ── */}
        <View style={styles.card}>
          <Text style={styles.cardHeading}>Treasury Dashboard</Text>
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.recordPaymentBtn}
              onPress={() => {
                setRecordError('')
                setRecordMemberId('')
                setRecordAmount('')
                setRecordNotes('')
                setRecordModalVisible(true)
              }}
              activeOpacity={0.7}
            >
              <Feather name="dollar-sign" size={16} color="#ffffff" />
              <Text style={styles.recordPaymentBtnText}>Record Payment</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.sendRemindersBtn}
              onPress={handleSendReminders}
              disabled={remindLoading}
              activeOpacity={0.7}
            >
              {remindLoading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.sendRemindersBtnText}>Send Reminders</Text>
              )}
            </TouchableOpacity>
          </View>

          {treasury && (
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>${(treasury.total_collected ?? 0).toFixed(2)}</Text>
                <Text style={styles.statLabel}>Total Collected</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statValue, { color: '#4ade80' }]}>{treasury.paid_in_full_count}</Text>
                <Text style={styles.statLabel}>Paid in Full</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statValue, { color: '#4ade80' }]}>{treasury.paid_count}</Text>
                <Text style={styles.statLabel}>Paid</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statValue, { color: '#f87171' }]}>{treasury.past_due_count}</Text>
                <Text style={styles.statLabel}>Past Due</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statValue, { color: '#fbbf24' }]}>{treasury.pending_count}</Text>
                <Text style={styles.statLabel}>Pending</Text>
              </View>
            </View>
          )}

          {/* Members */}
          <Text style={styles.membersHeading}>Members</Text>
          {members.map((m) => {
            const paid = m.total_paid ?? 0
            const req = treasuryPlansTotal
            let aggBg = (STATUS_COLORS[m.status] || STATUS_COLORS.pending).bg
            let aggText = (STATUS_COLORS[m.status] || STATUS_COLORS.pending).text
            let aggLabel = STATUS_LABELS[m.status] || m.status
            if (req > 0 && paid >= req) {
              aggLabel = 'Paid up'
              aggBg = 'rgba(34,197,94,0.2)'
              aggText = '#4ade80'
            } else if (m.dues_waived || (m.status === 'paid_in_full' && paid < req)) {
              aggLabel = 'Balance satisfied'
              aggBg = 'rgba(16,185,129,0.2)'
              aggText = '#34d399'
            }
            const displayName = memberRowDisplayName(m)
            const initial = (displayName || '?').charAt(0).toUpperCase()
            return (
              <View key={m.member_id} style={styles.memberBlock}>
                <View style={styles.memberRow}>
                  <View style={styles.memberAvatar}>
                    <Text style={styles.memberAvatarText}>{initial}</Text>
                  </View>
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{displayName}</Text>
                    <Text style={styles.memberSub}>{m.title || `$${paid.toFixed(2)} paid`}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: aggBg }]}>
                    <Text style={[styles.statusBadgeText, { color: aggText }]}>{aggLabel}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.markPaidBtn, m.paid_in_full && { opacity: 0.65 }]}
                    onPress={() => handleMarkPaidInFull(m.member_id, !!m.paid_in_full)}
                    disabled={markingMemberId === m.member_id || m.paid_in_full}
                    activeOpacity={0.7}
                  >
                    {markingMemberId === m.member_id ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <Text style={styles.markPaidBtnText}>
                        {m.paid_in_full ? (m.dues_waived ? 'Balance satisfied' : 'Paid up') : 'Mark satisfied'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
                {m.plan_balances && m.plan_balances.length > 0 ? (
                  <View style={styles.planBalancesWrap}>
                    <Text style={styles.planBalancesHeading}>By plan</Text>
                    {m.plan_balances.map((row) => {
                      const due = Math.max(0, row.total - row.paid)
                      return (
                        <View key={row.plan_id} style={styles.planBalanceRow}>
                          <Text style={styles.planBalanceName} numberOfLines={1}>
                            {row.plan_name}
                          </Text>
                          <Text style={styles.planBalanceNums}>
                            ${row.paid.toFixed(2)} / ${row.total.toFixed(2)}
                          </Text>
                          {row.paid_in_full ? (
                            <View style={styles.paidInFullPill}>
                              <Text style={styles.paidInFullPillText}>Paid in full</Text>
                            </View>
                          ) : (
                            <Text style={styles.planBalanceDue}>${due.toFixed(2)} due</Text>
                          )}
                        </View>
                      )
                    })}
                  </View>
                ) : null}
              </View>
            )
          })}
        </View>
      </ScrollView>

      {/* ── Terminology Picker Modal ── */}
      <Modal visible={showTermPicker} transparent animationType="fade" onRequestClose={() => setShowTermPicker(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowTermPicker(false)}>
          <View style={styles.pickerModal}>
            <Text style={styles.pickerModalTitle}>Select Terminology</Text>
            {TERMINOLOGY_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[styles.pickerOption, terminologyValue === opt && styles.pickerOptionActive]}
                onPress={() => { setTerminologyValue(opt); setShowTermPicker(false) }}
                activeOpacity={0.7}
              >
                <Text style={[styles.pickerOptionText, terminologyValue === opt && styles.pickerOptionTextActive]}>{opt}</Text>
                {terminologyValue === opt && <Feather name="check" size={18} color="#3b82f6" />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Create / Edit Plan Modal ── */}
      <Modal visible={planModalVisible} transparent animationType="fade" onRequestClose={() => setPlanModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setPlanModalVisible(false)}>
            <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editingPlan ? 'Edit Plan' : 'Create Plan'}</Text>
                <TouchableOpacity onPress={() => setPlanModalVisible(false)} hitSlop={8}>
                  <Feather name="x" size={22} color="#a1a1aa" />
                </TouchableOpacity>
              </View>
              <Text style={styles.inputLabel}>Plan Name *</Text>
              <TextInput style={styles.input} value={planName} onChangeText={setPlanName} placeholder="e.g. Monthly Dues" placeholderTextColor="#71717a" />

              <Text style={styles.inputLabel}>Installment Amount *</Text>
              <TextInput style={styles.input} value={planAmount} onChangeText={setPlanAmount} placeholder="50.00" placeholderTextColor="#71717a" keyboardType="decimal-pad" />

              <Text style={styles.inputLabel}>Total Amount (optional)</Text>
              <TextInput style={styles.input} value={planTotalAmount} onChangeText={setPlanTotalAmount} placeholder="600.00" placeholderTextColor="#71717a" keyboardType="decimal-pad" />

              <Text style={styles.inputLabel}>Due Date (optional)</Text>
              <TextInput style={styles.input} value={planDate} onChangeText={setPlanDate} placeholder="YYYY-MM-DD" placeholderTextColor="#71717a" />

              <Text style={styles.inputLabel}>Payment Option</Text>
              <View style={styles.optionRow}>
                <TouchableOpacity
                  style={[styles.optionBtn, planPaymentOption === 'full_only' && styles.optionBtnActive]}
                  onPress={() => setPlanPaymentOption('full_only')}
                >
                  <Text style={[styles.optionBtnText, planPaymentOption === 'full_only' && styles.optionBtnTextActive]}>Full Only</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.optionBtn, planPaymentOption === 'custom_only' && styles.optionBtnActive]}
                  onPress={() => setPlanPaymentOption('custom_only')}
                >
                  <Text style={[styles.optionBtnText, planPaymentOption === 'custom_only' && styles.optionBtnTextActive]}>Custom Amount</Text>
                </TouchableOpacity>
              </View>

              {planError ? <Text style={styles.errorText}>{planError}</Text> : null}

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setPlanModalVisible(false)} activeOpacity={0.7}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.submitBtn, planLoading && { opacity: 0.5 }]}
                  onPress={handleSavePlan}
                  disabled={planLoading}
                  activeOpacity={0.7}
                >
                  {planLoading ? <ActivityIndicator size="small" color="#000000" /> : (
                    <Text style={styles.submitBtnText}>{editingPlan ? 'Update Plan' : 'Create Plan'}</Text>
                  )}
                </TouchableOpacity>
              </View>
              {editingPlan && (
                <TouchableOpacity
                  style={styles.deletePlanBtn}
                  onPress={() => handleDeletePlan(editingPlan.id, editingPlan.name)}
                  activeOpacity={0.7}
                >
                  <Feather name="trash-2" size={14} color="#ef4444" />
                  <Text style={styles.deletePlanBtnText}>Delete Plan</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Record Payment Modal ── */}
      <Modal visible={recordModalVisible} transparent animationType="fade" onRequestClose={() => setRecordModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setRecordModalVisible(false)}>
            <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Record Payment</Text>
                <TouchableOpacity onPress={() => setRecordModalVisible(false)} hitSlop={8}>
                  <Feather name="x" size={22} color="#a1a1aa" />
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Member *</Text>
              <ScrollView style={styles.memberPickerScroll} nestedScrollEnabled>
                {members.map((m) => (
                  <TouchableOpacity
                    key={m.member_id}
                    style={[styles.memberPickerItem, recordMemberId === m.member_id && styles.memberPickerItemActive]}
                    onPress={() => setRecordMemberId(m.member_id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.memberPickerText, recordMemberId === m.member_id && { color: '#ffffff' }]}>
                      {memberRowDisplayName(m)}
                    </Text>
                    {recordMemberId === m.member_id && <Feather name="check" size={16} color="#3b82f6" />}
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.inputLabel}>Amount *</Text>
              <TextInput style={styles.input} value={recordAmount} onChangeText={setRecordAmount} placeholder="0.00" placeholderTextColor="#71717a" keyboardType="decimal-pad" />

              <Text style={styles.inputLabel}>Notes (optional)</Text>
              <TextInput style={[styles.input, { height: 60 }]} value={recordNotes} onChangeText={setRecordNotes} placeholder="Cash, check, etc." placeholderTextColor="#71717a" multiline />

              {recordError ? <Text style={styles.errorText}>{recordError}</Text> : null}

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setRecordModalVisible(false)} activeOpacity={0.7}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.greenSubmitBtn, recordSubmitting && { opacity: 0.5 }]}
                  onPress={handleRecordPayment}
                  disabled={recordSubmitting}
                  activeOpacity={0.7}
                >
                  {recordSubmitting ? <ActivityIndicator size="small" color="#ffffff" /> : (
                    <Text style={styles.greenSubmitBtnText}>Record Payment</Text>
                  )}
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000000' },
  content: { padding: 16, paddingBottom: 48 },

  /* Cards */
  card: {
    backgroundColor: '#18181b',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  cardHeading: { color: '#ffffff', fontSize: 17, fontWeight: '700', marginBottom: 4 },
  cardSubtext: { color: '#a1a1aa', fontSize: 14, marginBottom: 12 },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },

  /* Terminology */
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#27272a',
    borderWidth: 1,
    borderColor: '#3f3f46',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  pickerBtnText: { color: '#ffffff', fontSize: 15 },
  saveBtn: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignSelf: 'flex-start',
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { color: '#000000', fontSize: 14, fontWeight: '600' },

  /* Create Plan button */
  createPlanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
  },
  createPlanBtnText: { color: '#000000', fontSize: 14, fontWeight: '600' },

  /* Plan rows */
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#27272a',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  planName: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  planDetail: { color: '#a1a1aa', fontSize: 13, marginTop: 2 },
  emptyText: { color: '#71717a', fontSize: 14 },

  /* Action buttons */
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 16, marginTop: 8 },
  recordPaymentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16a34a',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
  },
  recordPaymentBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  sendRemindersBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#27272a',
    borderWidth: 1,
    borderColor: '#3f3f46',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sendRemindersBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '500' },

  /* Stats Grid */
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  statCard: {
    flexGrow: 1,
    flexBasis: '46%',
    backgroundColor: '#27272a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3f3f46',
    padding: 14,
  },
  statValue: { color: '#ffffff', fontSize: 22, fontWeight: '700' },
  statLabel: { color: '#71717a', fontSize: 12, marginTop: 2 },

  /* Members */
  membersHeading: { color: '#ffffff', fontSize: 15, fontWeight: '600', marginBottom: 10 },
  memberBlock: { marginBottom: 10 },
  planBalancesWrap: {
    backgroundColor: '#18181b',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#27272a',
    padding: 10,
    marginTop: 4,
    marginLeft: 46,
  },
  planBalancesHeading: { color: '#71717a', fontSize: 10, fontWeight: '700', letterSpacing: 0.6, marginBottom: 8, textTransform: 'uppercase' },
  planBalanceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  planBalanceName: { color: '#e4e4e7', fontSize: 13, fontWeight: '600', flex: 1, minWidth: 100 },
  planBalanceNums: { color: '#71717a', fontSize: 11 },
  planBalanceDue: { color: '#fbbf24', fontSize: 11, fontWeight: '600' },
  paidInFullPill: {
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.4)',
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  paidInFullPillText: { color: '#4ade80', fontSize: 9, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#27272a',
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#3f3f46',
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarText: { color: '#d4d4d8', fontSize: 15, fontWeight: '600' },
  memberInfo: { flex: 1, minWidth: 0 },
  memberName: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  memberSub: { color: '#a1a1aa', fontSize: 12, marginTop: 1 },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  statusBadgeText: { fontSize: 11, fontWeight: '600' },
  markPaidBtn: {
    backgroundColor: '#3f3f46',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 80,
    alignItems: 'center',
  },
  markPaidBtnText: { color: '#ffffff', fontSize: 11, fontWeight: '500' },

  /* Modal shared */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalContent: { width: '100%', maxWidth: 420, backgroundColor: '#18181b', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#27272a' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { color: '#ffffff', fontSize: 18, fontWeight: '700' },
  inputLabel: { color: '#a1a1aa', fontSize: 13, marginBottom: 4, marginTop: 10 },
  input: {
    backgroundColor: '#27272a',
    borderWidth: 1,
    borderColor: '#3f3f46',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 15,
  },
  optionRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  optionBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3f3f46',
    backgroundColor: '#27272a',
  },
  optionBtnActive: { borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.15)' },
  optionBtnText: { color: '#a1a1aa', fontSize: 13, fontWeight: '500' },
  optionBtnTextActive: { color: '#60a5fa' },
  errorText: { color: '#ef4444', fontSize: 13, marginTop: 8 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: { flex: 1, alignItems: 'center', backgroundColor: '#27272a', borderRadius: 8, paddingVertical: 12, borderWidth: 1, borderColor: '#3f3f46' },
  cancelBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '500' },
  submitBtn: { flex: 1, alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 8, paddingVertical: 12 },
  submitBtnText: { color: '#000000', fontSize: 14, fontWeight: '600' },
  greenSubmitBtn: { flex: 1, alignItems: 'center', backgroundColor: '#16a34a', borderRadius: 8, paddingVertical: 12 },
  greenSubmitBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },

  /* Delete Plan */
  deletePlanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    backgroundColor: 'rgba(239,68,68,0.08)',
  },
  deletePlanBtnText: { color: '#ef4444', fontSize: 14, fontWeight: '500' },

  /* Picker Modal */
  pickerModal: { backgroundColor: '#18181b', borderRadius: 16, padding: 20, width: '100%', maxWidth: 360, borderWidth: 1, borderColor: '#27272a' },
  pickerModalTitle: { color: '#ffffff', fontSize: 17, fontWeight: '700', marginBottom: 12 },
  pickerOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12, borderRadius: 8 },
  pickerOptionActive: { backgroundColor: 'rgba(59,130,246,0.1)' },
  pickerOptionText: { color: '#a1a1aa', fontSize: 15 },
  pickerOptionTextActive: { color: '#ffffff', fontWeight: '600' },

  /* Record Payment member picker */
  memberPickerScroll: { maxHeight: 150, backgroundColor: '#27272a', borderRadius: 8, borderWidth: 1, borderColor: '#3f3f46', marginBottom: 4 },
  memberPickerItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#3f3f46' },
  memberPickerItemActive: { backgroundColor: 'rgba(59,130,246,0.1)' },
  memberPickerText: { color: '#a1a1aa', fontSize: 14 },
})
