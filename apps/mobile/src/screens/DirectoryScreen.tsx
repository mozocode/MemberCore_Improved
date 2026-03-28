import React, { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Image,
  Modal,
  ScrollView,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { getApi } from '@membercore/services'
import { formatDate } from '@membercore/core'
import type { OrgDrawerScreenProps } from '../navigation/types'

interface EventOrg {
  id: string
  name: string
  logo?: string
  type?: string
  icon_color?: string
}

interface DirectoryEvent {
  id: string
  title: string
  description?: string
  event_date?: string
  location?: string
  organization?: EventOrg
  going_count?: number
  maybe_count?: number
  cover_image?: string
}

interface Filters {
  org_type: string
  cultural_identity: string
  sport_type: string
}

const ORG_TYPES = ['All', 'Fraternity', 'Sorority', 'Club', 'Organization', 'Sports Team', 'Academic', 'Professional', 'Social', 'Other']
const CULTURAL_IDENTITIES = ['All', 'African American', 'Asian', 'Hispanic/Latino', 'Native American', 'Pacific Islander', 'Multi-Cultural', 'Other']
const SPORT_TYPES = ['All', 'Basketball', 'Football', 'Soccer', 'Baseball', 'Volleyball', 'Tennis', 'Track & Field', 'Swimming', 'Other']

function normalizeOrgTypeLabel(type?: string) {
  const raw = (type || '').trim()
  if (!raw) return ''
  if (raw === 'Trade Union / Guild') return 'Union / Guild'
  return raw
}

export function DirectoryScreen({ route, navigation }: OrgDrawerScreenProps<'Directory'>) {
  const { orgId } = route.params
  const [events, setEvents] = useState<DirectoryEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<Filters>({ org_type: 'All', cultural_identity: 'All', sport_type: 'All' })
  const [tempFilters, setTempFilters] = useState<Filters>({ org_type: 'All', cultural_identity: 'All', sport_type: 'All' })

  const activeFilterCount = [filters.org_type, filters.cultural_identity, filters.sport_type].filter((v) => v !== 'All').length

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          style={styles.filterHeaderBtn}
          onPress={() => { setTempFilters(filters); setShowFilters(true) }}
          activeOpacity={0.7}
        >
          <Feather name="sliders" size={24} color={activeFilterCount > 0 ? '#3b82f6' : '#ffffff'} />
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      ),
    })
  }, [navigation, filters, activeFilterCount])

  const fetchEvents = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('search', search.trim())
      if (filters.org_type !== 'All') params.set('org_type', filters.org_type)
      if (filters.cultural_identity !== 'All') params.set('cultural_identity', filters.cultural_identity)
      if (filters.sport_type !== 'All') params.set('sport_type', filters.sport_type)
      const qs = params.toString()
      const { data } = await getApi().get(`/events/public/directory${qs ? `?${qs}` : ''}`)
      setEvents(Array.isArray(data) ? data : [])
    } catch {
      setEvents([])
    }
  }, [search, filters])

  useEffect(() => {
    setLoading(true)
    const t = setTimeout(() => {
      fetchEvents().finally(() => setLoading(false))
    }, search ? 300 : 0)
    return () => clearTimeout(t)
  }, [fetchEvents])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchEvents()
    setRefreshing(false)
  }, [fetchEvents])

  const applyFilters = () => {
    setFilters(tempFilters)
    setShowFilters(false)
  }

  const clearFilters = () => {
    const cleared = { org_type: 'All', cultural_identity: 'All', sport_type: 'All' }
    setTempFilters(cleared)
    setFilters(cleared)
    setShowFilters(false)
  }

  return (
    <View style={styles.container}>
      {/* Filter modal */}
      <Modal visible={showFilters} transparent animationType="slide">
        <View style={styles.filterBackdrop}>
          <View style={styles.filterModal}>
            <View style={styles.filterHeader}>
              <Text style={styles.filterTitle}>Filters</Text>
              <TouchableOpacity onPress={() => setShowFilters(false)}>
                <Feather name="x" size={22} color="#a1a1aa" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.filterScroll}>
              {/* Organization Type */}
              <Text style={styles.filterLabel}>Organization Type</Text>
              <View style={styles.filterChips}>
                {ORG_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.filterChip, tempFilters.org_type === t && styles.filterChipActive]}
                    onPress={() => setTempFilters((f) => ({ ...f, org_type: t }))}
                  >
                    <Text style={[styles.filterChipText, tempFilters.org_type === t && styles.filterChipTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Cultural Identity */}
              <Text style={[styles.filterLabel, { marginTop: 20 }]}>Cultural Identity</Text>
              <View style={styles.filterChips}>
                {CULTURAL_IDENTITIES.map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.filterChip, tempFilters.cultural_identity === t && styles.filterChipActive]}
                    onPress={() => setTempFilters((f) => ({ ...f, cultural_identity: t }))}
                  >
                    <Text style={[styles.filterChipText, tempFilters.cultural_identity === t && styles.filterChipTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Sport Type */}
              <Text style={[styles.filterLabel, { marginTop: 20 }]}>Sport Type</Text>
              <View style={styles.filterChips}>
                {SPORT_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.filterChip, tempFilters.sport_type === t && styles.filterChipActive]}
                    onPress={() => setTempFilters((f) => ({ ...f, sport_type: t }))}
                  >
                    <Text style={[styles.filterChipText, tempFilters.sport_type === t && styles.filterChipTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={styles.filterActions}>
              <TouchableOpacity style={styles.clearBtn} onPress={clearFilters}>
                <Text style={styles.clearBtnText}>Clear All</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.applyBtn} onPress={applyFilters}>
                <Text style={styles.applyBtnText}>Apply Filters</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Search */}
      <View style={styles.searchWrapper}>
        <Feather name="search" size={16} color="#71717a" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search events..."
          placeholderTextColor="#71717a"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {/* Active filter pills */}
      {activeFilterCount > 0 && (
        <View style={styles.pillRow}>
          {filters.org_type !== 'All' && (
            <View style={styles.pill}>
              <Text style={styles.pillText}>{filters.org_type}</Text>
              <TouchableOpacity onPress={() => setFilters((f) => ({ ...f, org_type: 'All' }))}>
                <Feather name="x" size={14} color="#3b82f6" />
              </TouchableOpacity>
            </View>
          )}
          {filters.cultural_identity !== 'All' && (
            <View style={styles.pill}>
              <Text style={styles.pillText}>{filters.cultural_identity}</Text>
              <TouchableOpacity onPress={() => setFilters((f) => ({ ...f, cultural_identity: 'All' }))}>
                <Feather name="x" size={14} color="#3b82f6" />
              </TouchableOpacity>
            </View>
          )}
          {filters.sport_type !== 'All' && (
            <View style={styles.pill}>
              <Text style={styles.pillText}>{filters.sport_type}</Text>
              <TouchableOpacity onPress={() => setFilters((f) => ({ ...f, sport_type: 'All' }))}>
                <Feather name="x" size={14} color="#3b82f6" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#71717a" />
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(e) => e.id}
          contentContainerStyle={events.length === 0 ? styles.emptyContainer : styles.list}
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={11}
          removeClippedSubviews={true}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#71717a" />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Feather name="calendar" size={48} color="#52525b" style={{ opacity: 0.5 }} />
              <Text style={styles.emptyText}>No events found</Text>
              <Text style={styles.emptySubText}>Try adjusting your search or filters</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('EventDetail', { orgId, eventId: item.id })}
            >
              {item.cover_image ? (
                <Image source={{ uri: item.cover_image }} style={styles.coverImage} />
              ) : null}
              <View style={styles.cardContent}>
                <Text style={styles.eventTitle} numberOfLines={1}>{item.title}</Text>

                {item.organization && (
                  <View style={styles.orgRow}>
                    {item.organization.logo ? (
                      <Image source={{ uri: item.organization.logo }} style={styles.orgLogo} />
                    ) : (
                      <View style={styles.orgLogoPlaceholder}>
                        <Text style={styles.orgLogoText}>{item.organization.name?.charAt(0) ?? '?'}</Text>
                      </View>
                    )}
                    <Text style={styles.orgName} numberOfLines={1}>
                      {item.organization?.name || ''}
                      {item.organization?.type ? <Text style={styles.orgType}> · {normalizeOrgTypeLabel(item.organization.type)}</Text> : null}
                    </Text>
                  </View>
                )}

                {item.event_date && (
                  <View style={styles.metaRow}>
                    <Feather name="calendar" size={14} color="#a1a1aa" />
                    <Text style={styles.metaText}>{formatDate(item.event_date)}</Text>
                  </View>
                )}

                {item.location && (
                  <View style={styles.metaRow}>
                    <Feather name="map-pin" size={14} color="#a1a1aa" />
                    <Text style={styles.metaText} numberOfLines={1}>{item.location}</Text>
                  </View>
                )}

                <View style={styles.statsRow}>
                  {(item.going_count ?? 0) > 0 && <Text style={styles.statText}>{item.going_count} going</Text>}
                  {(item.maybe_count ?? 0) > 0 && <Text style={styles.statText}>{item.maybe_count} maybe</Text>}
                </View>
              </View>

              <Feather name="chevron-right" size={20} color="#71717a" />
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  filterHeaderBtn: {
    width: 46,
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadge: {
    position: 'absolute', top: 2, right: 2,
    backgroundColor: '#3b82f6', borderRadius: 8, minWidth: 16, height: 16,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4,
  },
  filterBadgeText: { color: '#ffffff', fontSize: 10, fontWeight: '700' },

  searchWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#18181b', borderWidth: 1, borderColor: '#3f3f46', borderRadius: 8,
    marginHorizontal: 16, marginTop: 12, marginBottom: 8, height: 40,
  },
  searchIcon: { marginLeft: 12 },
  searchInput: { flex: 1, color: '#ffffff', fontSize: 14, paddingHorizontal: 8, height: 40 },

  // Filter pills
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(59,130,246,0.1)', borderRadius: 99,
    paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(59,130,246,0.3)',
  },
  pillText: { color: '#3b82f6', fontSize: 13, fontWeight: '500' },

  // Filter modal
  filterBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  filterModal: {
    backgroundColor: '#18181b', borderTopLeftRadius: 16, borderTopRightRadius: 16,
    maxHeight: '80%', borderWidth: 1, borderColor: '#3f3f46',
  },
  filterHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#27272a',
  },
  filterTitle: { color: '#ffffff', fontSize: 18, fontWeight: '600' },
  filterScroll: { paddingHorizontal: 16, paddingVertical: 16 },
  filterLabel: { color: '#d4d4d8', fontSize: 14, fontWeight: '600', marginBottom: 8 },
  filterChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
    backgroundColor: '#27272a', borderWidth: 1, borderColor: '#3f3f46',
  },
  filterChipActive: { backgroundColor: 'rgba(59,130,246,0.2)', borderColor: '#3b82f6' },
  filterChipText: { color: '#a1a1aa', fontSize: 13 },
  filterChipTextActive: { color: '#3b82f6', fontWeight: '600' },
  filterActions: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 16,
    borderTopWidth: 1, borderTopColor: '#27272a',
  },
  clearBtn: {
    flex: 1, backgroundColor: '#27272a', borderRadius: 8, borderWidth: 1, borderColor: '#3f3f46',
    paddingVertical: 12, alignItems: 'center',
  },
  clearBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '500' },
  applyBtn: { flex: 1, backgroundColor: '#ffffff', borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  applyBtnText: { color: '#000000', fontSize: 14, fontWeight: '600' },

  list: { paddingHorizontal: 16, paddingBottom: 32 },
  emptyContainer: { flexGrow: 1 },

  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#18181b', borderRadius: 12, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: 'rgba(39,39,42,0.8)',
  },
  coverImage: { width: 64, height: 64, borderRadius: 8, marginRight: 12 },
  cardContent: { flex: 1, minWidth: 0 },
  eventTitle: { fontSize: 15, fontWeight: '600', color: '#ffffff' },
  orgRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  orgLogo: { width: 20, height: 20, borderRadius: 10 },
  orgLogoPlaceholder: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: '#3f3f46',
    justifyContent: 'center', alignItems: 'center',
  },
  orgLogoText: { fontSize: 10, fontWeight: '500', color: '#a1a1aa' },
  orgName: { fontSize: 13, color: '#a1a1aa', flex: 1 },
  orgType: { color: '#71717a' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  metaText: { fontSize: 13, color: '#a1a1aa', flex: 1 },
  statsRow: { flexDirection: 'row', gap: 16, marginTop: 6 },
  statText: { fontSize: 12, color: '#71717a' },

  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  emptyText: { fontSize: 15, color: '#a1a1aa', marginTop: 12 },
  emptySubText: { fontSize: 13, color: '#71717a', marginTop: 4 },
})
