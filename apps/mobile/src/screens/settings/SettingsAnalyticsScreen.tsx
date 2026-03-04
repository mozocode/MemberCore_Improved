import React, { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { getApi } from '@membercore/services'
import type { RootStackScreenProps } from '../../navigation/types'

type Period = '7d' | '30d' | '90d' | 'all'

const PERIODS: { key: Period; label: string }[] = [
  { key: '7d', label: '7d' },
  { key: '30d', label: '30d' },
  { key: '90d', label: '90d' },
  { key: 'all', label: 'All' },
]

interface OverviewData {
  total_members: number
  new_members_in_period: number
  total_events: number
  upcoming_events: number
  total_revenue: number
  messages_in_period: number
  members_by_role: {
    owner: number
    admin: number
    member: number
    restricted: number
  }
  top_events_by_attendance: { title: string; attendance: number }[]
  dues_revenue_period: number
  dues_revenue_all_time: number
  ticket_revenue_period: number
  ticket_revenue_all_time: number
  active_channels: number
  messages_per_week: number
  total_polls: number
  poll_votes: number
}

function formatCurrency(amount: number): string {
  if (amount == null) return '$0.00'
  return '$' + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function formatNumber(n: number): string {
  if (n == null) return '0'
  return n.toLocaleString()
}

export function SettingsAnalyticsScreen({ route }: RootStackScreenProps<'SettingsAnalytics'>) {
  const { orgId } = route.params
  const [period, setPeriod] = useState<Period>('30d')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [data, setData] = useState<OverviewData | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const r = await getApi().get(`/analytics/${orgId}/overview?period=${period}`)
      setData(r.data)
    } catch {
      setData(null)
    }
  }, [orgId, period])

  useEffect(() => {
    setLoading(true)
    fetchData().finally(() => setLoading(false))
  }, [fetchData])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }, [fetchData])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#71717a" />
      </View>
    )
  }

  const overview = data || ({} as Partial<OverviewData>)
  const byRole = overview.members_by_role || { owner: 0, admin: 0, member: 0, restricted: 0 }
  const totalRoleCount = byRole.owner + byRole.admin + byRole.member + byRole.restricted || 1

  return (
    <View style={styles.container}>
      {/* Period selector */}
      <View style={styles.periodRow}>
        {PERIODS.map((p) => (
          <TouchableOpacity
            key={p.key}
            style={[styles.periodPill, period === p.key ? styles.periodActive : styles.periodInactive]}
            activeOpacity={0.7}
            onPress={() => setPeriod(p.key)}
          >
            <Text style={period === p.key ? styles.periodActiveText : styles.periodInactiveText}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#71717a" />
        }
      >
        {/* Key Metrics */}
        <Text style={styles.sectionTitle}>Key Metrics</Text>
        <View style={styles.metricsGrid}>
          <MetricCard
            icon="users"
            label="Total Members"
            value={formatNumber(overview.total_members ?? 0)}
            sub={`+${formatNumber(overview.new_members_in_period ?? 0)} this period`}
          />
          <MetricCard
            icon="calendar"
            label="Total Events"
            value={formatNumber(overview.total_events ?? 0)}
            sub={`${formatNumber(overview.upcoming_events ?? 0)} upcoming`}
          />
          <MetricCard
            icon="dollar-sign"
            label="Total Revenue"
            value={formatCurrency(overview.total_revenue ?? 0)}
          />
          <MetricCard
            icon="message-circle"
            label="Messages"
            value={formatNumber(overview.messages_in_period ?? 0)}
            sub="this period"
          />
        </View>

        {/* Members by Role */}
        <Text style={styles.sectionTitle}>Members by Role</Text>
        <View style={styles.card}>
          <RoleBar label="Owner" count={byRole.owner} total={totalRoleCount} color="#fbbf24" />
          <RoleBar label="Admin" count={byRole.admin} total={totalRoleCount} color="#a78bfa" />
          <RoleBar label="Member" count={byRole.member} total={totalRoleCount} color="#4ade80" />
          <RoleBar label="Restricted" count={byRole.restricted} total={totalRoleCount} color="#a1a1aa" />
        </View>

        {/* Top Events by Attendance */}
        {(overview.top_events_by_attendance ?? []).length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Top Events by Attendance</Text>
            <View style={styles.card}>
              {overview.top_events_by_attendance!.map((event, i) => (
                <View
                  key={i}
                  style={[
                    styles.eventRow,
                    i < overview.top_events_by_attendance!.length - 1 && styles.eventRowBorder,
                  ]}
                >
                  <View style={styles.eventRank}>
                    <Text style={styles.eventRankText}>{i + 1}</Text>
                  </View>
                  <Text style={styles.eventTitle} numberOfLines={1}>
                    {event.title}
                  </Text>
                  <View style={styles.attendanceBadge}>
                    <Feather name="users" size={12} color="#a1a1aa" />
                    <Text style={styles.attendanceText}>{event.attendance}</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Revenue Breakdown */}
        <Text style={styles.sectionTitle}>Revenue Breakdown</Text>
        <View style={styles.card}>
          <View style={styles.revenueRow}>
            <View style={styles.revenueLabel}>
              <Feather name="dollar-sign" size={14} color="#a1a1aa" />
              <Text style={styles.revenueLabelText}>Dues Revenue</Text>
            </View>
            <View style={styles.revenueValues}>
              <Text style={styles.revenueAmount}>
                {formatCurrency(overview.dues_revenue_period ?? 0)}
              </Text>
              <Text style={styles.revenueSubText}>
                {formatCurrency(overview.dues_revenue_all_time ?? 0)} all time
              </Text>
            </View>
          </View>
          <View style={styles.revenueDivider} />
          <View style={styles.revenueRow}>
            <View style={styles.revenueLabel}>
              <Feather name="tag" size={14} color="#a1a1aa" />
              <Text style={styles.revenueLabelText}>Ticket Revenue</Text>
            </View>
            <View style={styles.revenueValues}>
              <Text style={styles.revenueAmount}>
                {formatCurrency(overview.ticket_revenue_period ?? 0)}
              </Text>
              <Text style={styles.revenueSubText}>
                {formatCurrency(overview.ticket_revenue_all_time ?? 0)} all time
              </Text>
            </View>
          </View>
        </View>

        {/* Engagement Overview */}
        <Text style={styles.sectionTitle}>Engagement Overview</Text>
        <View style={styles.engagementGrid}>
          <View style={styles.engagementCard}>
            <Feather name="hash" size={16} color="#a1a1aa" />
            <Text style={styles.engagementValue}>
              {formatNumber(overview.active_channels ?? 0)}
            </Text>
            <Text style={styles.engagementLabel}>Active Channels</Text>
          </View>
          <View style={styles.engagementCard}>
            <Feather name="message-circle" size={16} color="#a1a1aa" />
            <Text style={styles.engagementValue}>
              {formatNumber(overview.messages_per_week ?? 0)}
            </Text>
            <Text style={styles.engagementLabel}>Msgs / Week</Text>
          </View>
          <View style={styles.engagementCard}>
            <Feather name="bar-chart-2" size={16} color="#a1a1aa" />
            <Text style={styles.engagementValue}>
              {formatNumber(overview.total_polls ?? 0)}
            </Text>
            <Text style={styles.engagementLabel}>Total Polls</Text>
          </View>
          <View style={styles.engagementCard}>
            <Feather name="check-square" size={16} color="#a1a1aa" />
            <Text style={styles.engagementValue}>
              {formatNumber(overview.poll_votes ?? 0)}
            </Text>
            <Text style={styles.engagementLabel}>Poll Votes</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

/* ─── Reusable components ─── */

function MetricCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: keyof typeof Feather.glyphMap
  label: string
  value: string
  sub?: string
}) {
  return (
    <View style={styles.metricCard}>
      <View style={styles.metricIconRow}>
        <Feather name={icon} size={14} color="#a1a1aa" />
        <Text style={styles.metricLabel}>{label}</Text>
      </View>
      <Text style={styles.metricValue}>{value}</Text>
      {sub ? <Text style={styles.metricSub}>{sub}</Text> : null}
    </View>
  )
}

function RoleBar({
  label,
  count,
  total,
  color,
}: {
  label: string
  count: number
  total: number
  color: string
}) {
  const pct = total > 0 ? (count / total) * 100 : 0

  return (
    <View style={styles.roleBarContainer}>
      <View style={styles.roleBarHeader}>
        <Text style={styles.roleBarLabel}>{label}</Text>
        <Text style={styles.roleBarCount}>{count}</Text>
      </View>
      <View style={styles.roleBarTrack}>
        <View style={[styles.roleBarFill, { width: `${Math.max(pct, 2)}%`, backgroundColor: color }]} />
      </View>
    </View>
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
  },
  scrollContent: { padding: 16, paddingBottom: 48 },

  /* Period pills */
  periodRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  periodPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  periodActive: { backgroundColor: '#ffffff' },
  periodInactive: { backgroundColor: '#27272a' },
  periodActiveText: { color: '#000000', fontSize: 14, fontWeight: '600' },
  periodInactiveText: { color: '#a1a1aa', fontSize: 14, fontWeight: '600' },

  /* Section titles */
  sectionTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 24,
  },

  /* Card */
  card: {
    backgroundColor: '#18181b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(39,39,42,0.8)',
  },

  /* Key Metrics grid */
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCard: {
    flexGrow: 1,
    flexBasis: '46%',
    backgroundColor: '#18181b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(39,39,42,0.8)',
  },
  metricIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  metricLabel: {
    color: '#a1a1aa',
    fontSize: 13,
  },
  metricValue: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '600',
  },
  metricSub: {
    color: '#71717a',
    fontSize: 12,
    marginTop: 4,
  },

  /* Role bars */
  roleBarContainer: {
    marginBottom: 14,
  },
  roleBarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  roleBarLabel: {
    color: '#a1a1aa',
    fontSize: 13,
  },
  roleBarCount: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  roleBarTrack: {
    height: 8,
    backgroundColor: '#27272a',
    borderRadius: 4,
    overflow: 'hidden',
  },
  roleBarFill: {
    height: 8,
    borderRadius: 4,
  },

  /* Top events */
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  eventRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(39,39,42,0.5)',
  },
  eventRank: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#27272a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  eventRankText: {
    color: '#a1a1aa',
    fontSize: 12,
    fontWeight: '600',
  },
  eventTitle: {
    color: '#ffffff',
    fontSize: 14,
    flex: 1,
  },
  attendanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 8,
    backgroundColor: '#27272a',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  attendanceText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '500',
  },

  /* Revenue */
  revenueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  revenueLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  revenueLabelText: {
    color: '#a1a1aa',
    fontSize: 13,
  },
  revenueValues: {
    alignItems: 'flex-end',
  },
  revenueAmount: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  revenueSubText: {
    color: '#71717a',
    fontSize: 12,
    marginTop: 2,
  },
  revenueDivider: {
    height: 1,
    backgroundColor: 'rgba(39,39,42,0.5)',
  },

  /* Engagement */
  engagementGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  engagementCard: {
    flexGrow: 1,
    flexBasis: '46%',
    backgroundColor: '#18181b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(39,39,42,0.8)',
    alignItems: 'center',
    gap: 6,
  },
  engagementValue: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '600',
  },
  engagementLabel: {
    color: '#a1a1aa',
    fontSize: 12,
  },
})
