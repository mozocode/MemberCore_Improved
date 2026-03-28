import React, { useEffect, useState, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import type { Event } from '@membercore/core'
import { formatDate, formatTime } from '@membercore/core'
import { eventService, getApi } from '@membercore/services'
import type { OrgDrawerScreenProps } from '../navigation/types'

type Tab = 'upcoming' | 'past'

export function EventsScreen({ route, navigation }: OrgDrawerScreenProps<'Calendar'>) {
  const { orgId } = route.params
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [tab, setTab] = useState<Tab>('upcoming')
  const [myRole, setMyRole] = useState<string | null>(null)

  useEffect(() => {
    getApi().get(`/organizations/${orgId}/members/me`)
      .then((r) => setMyRole(String(r.data?.role ?? 'member')))
      .catch(() => setMyRole(null))
  }, [orgId])

  const isAdmin = myRole === 'owner' || myRole === 'admin'

  useEffect(() => {
    navigation.setOptions({
      headerRight: isAdmin ? () => (
        <TouchableOpacity
          style={styles.headerActionBtn}
          onPress={() => Alert.alert('Create Event', 'Event creation is available in the web app. Open the web app to create events.')}
          activeOpacity={0.7}
        >
          <Feather name="plus" size={28} color="#ffffff" />
        </TouchableOpacity>
      ) : undefined,
    })
  }, [navigation, isAdmin])

  const fetchEvents = useCallback(async () => {
    try {
      const data = await eventService.list(orgId)
      setEvents(data)
    } catch {
      setEvents([])
    }
  }, [orgId])

  useEffect(() => {
    fetchEvents().finally(() => setLoading(false))
  }, [fetchEvents])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchEvents()
    setRefreshing(false)
  }, [fetchEvents])

  const now = useMemo(() => new Date(), [])

  const upcoming = useMemo(
    () => events.filter((e) => e.start_time && new Date(e.start_time) >= now),
    [events, now],
  )
  const past = useMemo(
    () => events.filter((e) => e.start_time && new Date(e.start_time) < now).reverse(),
    [events, now],
  )

  const displayEvents = tab === 'upcoming' ? upcoming : past

  const sections = useMemo(() => {
    const grouped: Record<string, Event[]> = {}
    for (const event of displayEvents) {
      const d = event.start_time ? new Date(event.start_time) : new Date()
      const monthYear = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      if (!grouped[monthYear]) grouped[monthYear] = []
      grouped[monthYear].push(event)
    }
    return Object.entries(grouped).map(([title, data]) => ({ title, data }))
  }, [displayEvents])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#71717a" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Tab pills */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabPill, tab === 'upcoming' ? styles.tabActive : styles.tabInactive]}
          activeOpacity={0.7}
          onPress={() => setTab('upcoming')}
        >
          <Text style={tab === 'upcoming' ? styles.tabActiveText : styles.tabInactiveText}>
            Upcoming ({upcoming.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabPill, tab === 'past' ? styles.tabActive : styles.tabInactive]}
          activeOpacity={0.7}
          onPress={() => setTab('past')}
        >
          <Text style={tab === 'past' ? styles.tabActiveText : styles.tabInactiveText}>
            Past ({past.length})
          </Text>
        </TouchableOpacity>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(e) => e.id}
        contentContainerStyle={sections.length === 0 ? styles.emptyContainer : styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#71717a" />
        }
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section: { title } }) => (
          <Text style={styles.sectionHeader}>{title}</Text>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="calendar" size={48} color="#71717a" style={{ opacity: 0.5 }} />
            <Text style={styles.emptyText}>No {tab} events</Text>
          </View>
        }
        renderItem={({ item }) => {
          const d = item.start_time ? new Date(item.start_time) : new Date()
          const monthShort = d
            .toLocaleDateString(undefined, { month: 'short' })
            .toUpperCase()
          const dayNum = d.getDate()

          return (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.7}
              onPress={() =>
                navigation.navigate('EventDetail', { orgId, eventId: item.id })
              }
            >
              <View style={styles.dateBox}>
                <Text style={styles.dateMonth}>{monthShort}</Text>
                <Text style={styles.dateDay}>{dayNum}</Text>
              </View>
              <View style={styles.info}>
                <Text style={styles.title} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={styles.meta}>
                  {formatDate(item.start_time)} · {formatTime(item.start_time)}
                </Text>
                {item.location ? (
                  <Text style={styles.location} numberOfLines={1}>
                    {item.location}
                  </Text>
                ) : null}
              </View>
              {item.is_paid && item.price != null && (
                <View style={styles.priceBadge}>
                  <Text style={styles.priceText}>${item.price.toFixed(2)}</Text>
                </View>
              )}
            </TouchableOpacity>
          )
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  headerActionBtn: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: { flex: 1, backgroundColor: '#000000' },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },

  /* Tabs */
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  tabPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  tabActive: { backgroundColor: '#ffffff' },
  tabInactive: { backgroundColor: '#27272a' },
  tabActiveText: { color: '#000000', fontSize: 14, fontWeight: '600' },
  tabInactiveText: { color: '#a1a1aa', fontSize: 14, fontWeight: '600' },

  /* List */
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  emptyContainer: { flexGrow: 1 },
  sectionHeader: {
    color: '#a1a1aa',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 24,
    marginBottom: 12,
  },

  /* Card */
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(39,39,42,0.8)',
  },
  dateBox: {
    width: 52,
    alignItems: 'center',
    marginRight: 12,
  },
  dateMonth: {
    color: '#3b82f6',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  dateDay: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 30,
  },
  info: { flex: 1 },
  title: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  meta: { color: '#a1a1aa', fontSize: 13, marginTop: 2 },
  location: { color: '#71717a', fontSize: 12, marginTop: 2 },
  priceBadge: {
    backgroundColor: '#27272a',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 8,
  },
  priceText: { color: '#4ade80', fontSize: 13, fontWeight: '600' },

  /* Empty */
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyText: { color: '#71717a', fontSize: 15, marginTop: 12 },
})
