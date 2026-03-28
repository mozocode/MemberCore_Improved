import React, { useEffect, useState, useCallback, useMemo } from 'react'
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { ROLE_LABELS, getInitial, type Member } from '@membercore/core'
import { directoryService } from '@membercore/services'
import { ListSkeleton } from '../components/ListSkeleton'
import type { OrgDrawerScreenProps } from '../navigation/types'

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  owner: { bg: 'rgba(245,158,11,0.2)', text: '#fbbf24' },
  admin: { bg: 'rgba(168,85,247,0.2)', text: '#a78bfa' },
  member: { bg: 'rgba(74,222,128,0.2)', text: '#4ade80' },
  restricted: { bg: 'rgba(161,161,170,0.2)', text: '#a1a1aa' },
}

export function MembersScreen({ route }: OrgDrawerScreenProps<'Members'>) {
  const { orgId } = route.params
  const [allMembers, setAllMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')

  const fetchMembers = useCallback(async () => {
    try {
      const data = await directoryService.list(orgId)
      setAllMembers(data)
    } catch {
      setAllMembers([])
    }
  }, [orgId])

  useEffect(() => {
    fetchMembers().finally(() => setLoading(false))
  }, [fetchMembers])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchMembers()
    setRefreshing(false)
  }, [fetchMembers])

  const members = useMemo(() => {
    const approved = allMembers.filter((m) => m.status === 'approved')
    if (!search.trim()) return approved
    const q = search.toLowerCase()
    return approved.filter(
      (m) =>
        m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q),
    )
  }, [allMembers, search])

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.searchWrapper}>
          <Feather name="search" size={16} color="#71717a" style={styles.searchIcon} />
          <View style={{ flex: 1, height: 44, backgroundColor: '#27272a', borderRadius: 8, justifyContent: 'center', paddingHorizontal: 12 }}>
            <View style={{ height: 12, width: '70%', backgroundColor: '#3f3f46', borderRadius: 4 }} />
          </View>
        </View>
        <View style={styles.list}>
          <ListSkeleton count={6} />
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Search */}
      <View style={styles.searchWrapper}>
        <Feather
          name="search"
          size={16}
          color="#71717a"
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or email..."
          placeholderTextColor="#71717a"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <FlatList
        data={members}
        keyExtractor={(m) => m.id}
        contentContainerStyle={
          members.length === 0 ? styles.emptyContainer : styles.list
        }
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={11}
        removeClippedSubviews={true}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#71717a"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather
              name="user"
              size={48}
              color="#71717a"
              style={{ opacity: 0.5 }}
            />
            <Text style={styles.emptyText}>No members found</Text>
          </View>
        }
        renderItem={({ item }) => {
          const roleColor = ROLE_COLORS[item.role] ?? ROLE_COLORS.restricted

          return (
            <View style={styles.card}>
              {/* Avatar */}
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.initial || getInitial(item.name)}</Text>
              </View>

              {/* Name */}
              <View style={styles.info}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.nickname || item.name}
                </Text>
              </View>

              {/* Role badge + title */}
              <View style={styles.trailingCol}>
                <View
                  style={[styles.roleBadge, { backgroundColor: roleColor.bg }]}
                >
                  <Text style={[styles.roleText, { color: roleColor.text }]}>
                    {ROLE_LABELS[item.role as keyof typeof ROLE_LABELS] ??
                      item.role}
                  </Text>
                </View>
                {item.title ? (
                  <Text style={styles.titleText} numberOfLines={1}>
                    {item.title}
                  </Text>
                ) : null}
              </View>
            </View>
          )
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },

  /* Search */
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#3f3f46',
    borderRadius: 8,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    height: 40,
  },
  searchIcon: { marginLeft: 12 },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
    paddingHorizontal: 8,
    height: 40,
  },

  /* List */
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  emptyContainer: { flexGrow: 1 },

  /* Card */
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(39,39,42,0.8)',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#27272a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#d4d4d8',
    fontSize: 16,
    fontWeight: '500',
  },
  info: { flex: 1, marginRight: 8 },
  name: { color: '#ffffff', fontSize: 15, fontWeight: '500' },

  /* Trailing column */
  trailingCol: { alignItems: 'flex-end' },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  roleText: { fontSize: 11, fontWeight: '600' },
  titleText: { color: '#71717a', fontSize: 11, marginTop: 4 },

  /* Empty */
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
  },
  emptyText: { color: '#71717a', fontSize: 15, marginTop: 12 },
})
