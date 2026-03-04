import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import type { Poll } from '@membercore/core'
import { pollService, getApi } from '@membercore/services'
import * as Haptics from 'expo-haptics'
import type { OrgDrawerScreenProps } from '../navigation/types'

export function PollsScreen({ route, navigation }: OrgDrawerScreenProps<'Polls'>) {
  const orgId = route.params.orgId

  const [polls, setPolls] = useState<Poll[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [tab, setTab] = useState<'active' | 'closed'>('active')
  const [votingPollId, setVotingPollId] = useState<string | null>(null)
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
          style={{ padding: 8, marginRight: 8 }}
          onPress={() => Alert.alert('Create Poll', 'Poll creation is available in the web app. Open the web app to create polls.')}
          activeOpacity={0.7}
        >
          <Feather name="plus" size={26} color="#ffffff" />
        </TouchableOpacity>
      ) : undefined,
    })
  }, [navigation, isAdmin])

  const fetchPolls = useCallback(async () => {
    if (!orgId) return
    try {
      const data = await pollService.list(orgId)
      setPolls(data)
    } catch {
      setPolls([])
    }
  }, [orgId])

  useEffect(() => {
    setLoading(true)
    fetchPolls().finally(() => setLoading(false))
  }, [fetchPolls])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchPolls()
    setRefreshing(false)
  }, [fetchPolls])

  const handleVote = async (pollId: string, optionIds: string[]) => {
    setVotingPollId(pollId)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    try {
      await pollService.vote(orgId, pollId, optionIds)
      await fetchPolls()
    } catch (e) {
      console.error(e)
    } finally {
      setVotingPollId(null)
    }
  }

  const formatDate = (d?: string) => {
    if (!d) return ''
    try {
      return new Date(d).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    } catch {
      return d
    }
  }

  const active = polls.filter((p) => p.is_open)
  const closed = polls.filter((p) => !p.is_open)
  const displayPolls = tab === 'active' ? active : closed

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#71717a" />
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#71717a"
        />
      }
    >
      {/* Tab Pills */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabPill, tab === 'active' ? styles.tabActive : styles.tabInactive]}
          onPress={() => setTab('active')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, tab === 'active' ? styles.tabTextActive : styles.tabTextInactive]}>
            Active ({active.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabPill, tab === 'closed' ? styles.tabActive : styles.tabInactive]}
          onPress={() => setTab('closed')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, tab === 'closed' ? styles.tabTextActive : styles.tabTextInactive]}>
            Closed ({closed.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Poll List */}
      {displayPolls.length === 0 ? (
        <View style={styles.emptyState}>
          <Feather name="bar-chart-2" size={48} color="#71717a" style={{ opacity: 0.5 }} />
          <Text style={styles.emptyText}>No {tab} polls</Text>
        </View>
      ) : (
        displayPolls.map((poll) => {
          const maxVotes = Math.max(...(poll.options?.map((o) => o.vote_count) || [0]), 1)
          return (
            <View key={poll.id} style={styles.card}>
              {/* Poll Question */}
              <Text style={styles.pollQuestion}>{poll.question}</Text>
              {poll.description ? (
                <Text style={styles.pollDescription}>{poll.description}</Text>
              ) : null}

              {/* Metadata Badges */}
              <View style={styles.badgeRow}>
                {poll.allow_multiple_votes && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>Multiple choice</Text>
                  </View>
                )}
                {poll.is_anonymous && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>Anonymous</Text>
                  </View>
                )}
                {poll.ends_at ? (
                  <View style={styles.badge}>
                    <Feather name="clock" size={12} color="#71717a" />
                    <Text style={styles.badgeText}>Ends {formatDate(poll.ends_at)}</Text>
                  </View>
                ) : null}
                <View style={styles.badge}>
                  <Feather name="check-square" size={12} color="#71717a" />
                  <Text style={styles.badgeText}>{poll.total_votes} votes</Text>
                </View>
              </View>

              {/* Options */}
              {poll.options?.map((opt) => {
                const pct = maxVotes > 0 ? (opt.vote_count / maxVotes) * 100 : 0
                const selected = poll.my_votes?.includes(opt.id)
                return (
                  <View key={opt.id} style={styles.optionWrapper}>
                    <TouchableOpacity
                      style={[
                        styles.optionButton,
                        selected ? styles.optionSelected : styles.optionDefault,
                      ]}
                      disabled={!poll.is_open || !!votingPollId}
                      activeOpacity={0.7}
                      onPress={() => {
                        if (!poll.is_open) return
                        if (poll.allow_multiple_votes) {
                          const next = selected
                            ? (poll.my_votes || []).filter((id) => id !== opt.id)
                            : [...(poll.my_votes || []), opt.id]
                          handleVote(poll.id, next)
                        } else {
                          handleVote(poll.id, selected ? [] : [opt.id])
                        }
                      }}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          selected ? styles.optionTextSelected : styles.optionTextDefault,
                        ]}
                      >
                        {opt.text}
                      </Text>
                      <Text style={styles.optionCount}>
                        {opt.vote_count} ({maxVotes > 0 ? Math.round((opt.vote_count / maxVotes) * 100) : 0}%)
                      </Text>
                    </TouchableOpacity>
                    {/* Progress Bar */}
                    <View style={styles.progressTrack}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: `${pct}%` },
                        ]}
                      />
                    </View>
                  </View>
                )
              })}

              {/* Voting indicator */}
              {votingPollId === poll.id && (
                <View style={styles.votingRow}>
                  <ActivityIndicator size="small" color="#71717a" />
                  <Text style={styles.votingText}>Saving vote...</Text>
                </View>
              )}
            </View>
          )
        })
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  centered: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  tabPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#ffffff',
  },
  tabInactive: {
    backgroundColor: '#27272a',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#000000',
  },
  tabTextInactive: {
    color: '#a1a1aa',
  },
  card: {
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: 'rgba(39,39,42,0.8)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  pollQuestion: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  pollDescription: {
    fontSize: 14,
    color: '#71717a',
    marginBottom: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badgeText: {
    fontSize: 12,
    color: '#71717a',
  },
  optionWrapper: {
    marginBottom: 8,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  optionDefault: {
    backgroundColor: '#27272a',
    borderColor: '#3f3f46',
  },
  optionSelected: {
    backgroundColor: 'rgba(249,115,22,0.2)',
    borderColor: 'rgba(249,115,22,0.5)',
  },
  optionText: {
    fontSize: 14,
    flex: 1,
  },
  optionTextDefault: {
    color: '#ffffff',
  },
  optionTextSelected: {
    color: '#f97316',
  },
  optionCount: {
    fontSize: 13,
    color: '#a1a1aa',
    marginLeft: 8,
  },
  progressTrack: {
    height: 4,
    backgroundColor: '#27272a',
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#f97316',
    borderRadius: 2,
  },
  votingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  votingText: {
    fontSize: 13,
    color: '#71717a',
  },
  emptyState: {
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: 'rgba(39,39,42,0.8)',
    borderRadius: 12,
    padding: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: '#a1a1aa',
    marginTop: 12,
  },
})
