import React, { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Linking,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import type { DuesPlan, DuesStatus, Payment } from '@membercore/core'
import { formatCurrency, formatDate } from '@membercore/core'
import { duesService } from '@membercore/services'
import type { OrgDrawerScreenProps } from '../navigation/types'

export function DuesScreen({ route }: OrgDrawerScreenProps<'Dues'>) {
  const { orgId } = route.params
  const [status, setStatus] = useState<DuesStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const data = await duesService.getStatus(orgId)
      setStatus(data)
    } catch {
      // silently fail
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

  const handlePay = useCallback(
    async (plan: DuesPlan) => {
      try {
        const total = plan.total_amount || plan.amount
        const paidForPlan =
          status?.payment_history?.filter((p) => p.plan_id === plan.id).reduce((s, p) => s + p.amount, 0) ?? 0
        const waived =
          status?.dues_paid_in_full === true ||
          (status?.status || '').toLowerCase().trim() === 'paid_in_full'
        const remainingByPlan = Math.max(0, total - paidForPlan)
        const remaining = waived ? 0 : remainingByPlan
        const amount =
          plan.payment_option === 'custom_only' ? remaining * 0.5 : remaining
        const res = await duesService.checkout(orgId, plan.id, amount)
        const checkoutUrl = res.checkout_url || res.url
        if (checkoutUrl) {
          Linking.openURL(checkoutUrl)
        }
      } catch (err: any) {
        Alert.alert(
          'Payment Error',
          err?.response?.data?.detail || 'Could not start checkout',
        )
      }
    },
    [orgId, status],
  )

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    )
  }

  if (!status || !status.plans || !status.plans.length) {
    return (
      <View style={styles.center}>
        <Feather name="dollar-sign" size={48} color="rgba(255,255,255,0.5)" />
        <Text style={styles.emptyText}>No dues plans</Text>
      </View>
    )
  }

  const totalRequired = status.plans.reduce(
    (sum, p) => sum + (p.total_amount || p.amount),
    0,
  )
  const waivedNoBalance =
    status.dues_paid_in_full === true ||
    (status.status || '').toLowerCase().trim() === 'paid_in_full'
  const totalRemaining = waivedNoBalance
    ? 0
    : Math.max(0, totalRequired - status.total_paid)

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#ffffff"
          />
        }
      >
        {/* Summary Grid */}
        <View style={styles.summaryGrid}>
          {/* Total Paid */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryIconRow}>
              <Feather name="dollar-sign" size={14} color="#a1a1aa" />
              <Text style={styles.summaryLabel}>Total Paid</Text>
            </View>
            <Text style={styles.summaryValue}>
              {formatCurrency(status.total_paid)}
            </Text>
          </View>

          {/* Required */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryIconRow}>
              <Feather name="file-text" size={14} color="#a1a1aa" />
              <Text style={styles.summaryLabel}>Required</Text>
            </View>
            <Text style={styles.summaryValue}>
              {formatCurrency(totalRequired)}
            </Text>
          </View>

          {/* Remaining */}
          <View style={styles.summaryCard}>
            <View style={styles.summaryIconRow}>
              <Feather name="dollar-sign" size={14} color="#a1a1aa" />
              <Text style={styles.summaryLabel}>Remaining</Text>
            </View>
            <Text style={styles.summaryValue}>
              {formatCurrency(totalRemaining)}
            </Text>
          </View>
        </View>

        {waivedNoBalance &&
        totalRemaining === 0 &&
        status.total_paid < totalRequired &&
        totalRequired > 0 ? (
          <Text style={styles.waiverNote}>
            Your organization marked your balance as satisfied. You do not need to pay the remaining total.
          </Text>
        ) : null}

        {/* Dues Plans */}
        <View style={styles.sectionHeader}>
          <Feather name="calendar" size={16} color="#a1a1aa" />
          <Text style={styles.sectionTitle}>Dues Plans</Text>
        </View>

        {status.plans.map((plan) => {
          const total = plan.total_amount || plan.amount
          const paidForPlan =
            status.payment_history?.filter((p) => p.plan_id === plan.id).reduce((s, p) => s + p.amount, 0) ?? 0
          const remainingByPlan = Math.max(0, total - paidForPlan)
          const planPaidInFull = paidForPlan >= total && total > 0
          const remaining = waivedNoBalance ? 0 : remainingByPlan
          const noPayNeeded = planPaidInFull || waivedNoBalance
          return (
            <View key={plan.id} style={styles.planCard}>
              <View style={styles.planHeader}>
                <View style={styles.planIconBox}>
                  <Feather name="dollar-sign" size={20} color="#a1a1aa" />
                </View>
                <View style={styles.planInfo}>
                  <Text style={styles.planName}>{plan.name}</Text>
                  <Text style={styles.planAmount}>
                    Total: {formatCurrency(total)}
                  </Text>
                  {plan.due_date && (
                    <Text style={styles.planDue}>
                      Due: {formatDate(plan.due_date)}
                    </Text>
                  )}
                  {planPaidInFull ? (
                    <Text style={styles.planPaidInFull}>Paid in full</Text>
                  ) : waivedNoBalance ? (
                    <Text style={styles.planWaived}>No payment due</Text>
                  ) : remaining > 0 ? (
                    <Text style={styles.planRemaining}>
                      Remaining: {formatCurrency(remaining)}
                    </Text>
                  ) : null}
                </View>
              </View>
              {!noPayNeeded && remaining > 0 ? (
                <TouchableOpacity
                  style={styles.payButton}
                  onPress={() => handlePay(plan)}
                >
                  <Text style={styles.payButtonText}>
                    {plan.payment_option === 'custom_only'
                      ? 'Pay Custom Amount'
                      : `Pay ${formatCurrency(remaining)}`}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )
        })}

        {/* Payment History */}
        {status.payment_history.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Feather name="clock" size={16} color="#a1a1aa" />
              <Text style={styles.sectionTitle}>Payment History</Text>
            </View>

            {status.payment_history.map((p: Payment) => (
              <View key={p.id} style={styles.historyRow}>
                <View>
                  <Text style={styles.historyAmount}>
                    {formatCurrency(p.amount)}
                  </Text>
                  <Text style={styles.historyMethod}>
                    via {p.payment_method === 'stripe' ? 'Stripe' : (p.payment_method || 'Stripe')}
                  </Text>
                </View>
                <Text style={styles.historyDate}>
                  {formatDate(p.created_at)}
                </Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
    gap: 12,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  emptyText: {
    color: '#71717a',
    fontSize: 15,
  },

  /* Summary Grid */
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  summaryCard: {
    width: '48%' as any,
    flexGrow: 1,
    flexBasis: '46%',
    backgroundColor: '#18181b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(39,39,42,0.8)',
  },
  summaryIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  summaryLabel: {
    color: '#a1a1aa',
    fontSize: 13,
  },
  summaryValue: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '600',
  },
  waiverNote: {
    color: '#a1a1aa',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 20,
  },

  /* Section Headers */
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
  },

  /* Plan Cards */
  planCard: {
    backgroundColor: '#18181b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(39,39,42,0.8)',
    marginBottom: 12,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  planIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#27272a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  planInfo: {
    flex: 1,
  },
  planName: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  planAmount: {
    color: '#a1a1aa',
    fontSize: 13,
  },
  planDue: {
    color: '#a1a1aa',
    fontSize: 13,
    marginTop: 2,
  },
  planRemaining: {
    color: '#f59e0b',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  planPaidInFull: {
    color: '#4ade80',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  planWaived: {
    color: '#6ee7b7',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  payButton: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 14,
  },
  payButtonText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '600',
  },

  /* Payment History */
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#18181b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(39,39,42,0.8)',
    marginBottom: 10,
  },
  historyAmount: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '500',
  },
  historyMethod: {
    color: '#a1a1aa',
    fontSize: 12,
    marginTop: 2,
  },
  historyDate: {
    color: '#71717a',
    fontSize: 13,
  },
})
