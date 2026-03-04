import React, { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { getApi } from '@membercore/services'
import type { RootStackScreenProps } from '../../navigation/types'

interface OrgEvent {
  id: string
  title: string
  start_time: string
  is_paid: boolean
}

interface Attendee {
  member_id: string
  name: string
  short_code: string
  checked_in: boolean
  amount: number
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function SettingsEventOptionsScreen({
  route,
}: RootStackScreenProps<'SettingsEventOptions'>) {
  const { orgId } = route.params

  const [events, setEvents] = useState<OrgEvent[]>([])
  const [loadingEvents, setLoadingEvents] = useState(true)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)

  const [attendees, setAttendees] = useState<Attendee[]>([])
  const [loadingAttendees, setLoadingAttendees] = useState(false)

  const [ticketCode, setTicketCode] = useState('')
  const [checkingIn, setCheckingIn] = useState(false)
  const [checkInMessage, setCheckInMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)

  const fetchEvents = useCallback(async () => {
    try {
      const res = await getApi().get(`/events/${orgId}`)
      const paid = (res.data as OrgEvent[]).filter((e) => e.is_paid === true)
      setEvents(paid)
    } catch {
      // silently fail
    }
  }, [orgId])

  useEffect(() => {
    fetchEvents().finally(() => setLoadingEvents(false))
  }, [fetchEvents])

  const fetchAttendees = useCallback(
    async (eventId: string) => {
      setLoadingAttendees(true)
      try {
        const res = await getApi().get(
          `/payments/${orgId}/events/${eventId}/attendees`,
        )
        setAttendees(res.data)
      } catch {
        setAttendees([])
      } finally {
        setLoadingAttendees(false)
      }
    },
    [orgId],
  )

  const handleSelectEvent = useCallback(
    (eventId: string) => {
      setSelectedEventId(eventId)
      setCheckInMessage(null)
      setTicketCode('')
      fetchAttendees(eventId)
    },
    [fetchAttendees],
  )

  const handleCheckIn = useCallback(async () => {
    const code = ticketCode.trim()
    if (!code) {
      Alert.alert('Error', 'Please enter a ticket code.')
      return
    }

    setCheckingIn(true)
    setCheckInMessage(null)
    try {
      const res = await getApi().post(
        `/payments/${orgId}/tickets/check-in`,
        { ticket_code: code },
      )
      setCheckInMessage({
        type: 'success',
        text: res.data.message || 'Successfully checked in!',
      })
      setTicketCode('')
      if (selectedEventId) {
        fetchAttendees(selectedEventId)
      }
    } catch (err: any) {
      setCheckInMessage({
        type: 'error',
        text: err?.response?.data?.detail || 'Check-in failed. Please try again.',
      })
    } finally {
      setCheckingIn(false)
    }
  }, [orgId, ticketCode, selectedEventId, fetchAttendees])

  if (loadingEvents) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    )
  }

  if (!events.length) {
    return (
      <View style={styles.center}>
        <Feather name="settings" size={48} color="rgba(255,255,255,0.5)" />
        <Text style={styles.emptyText}>No paid events</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Event Selector */}
        <View style={styles.sectionHeader}>
          <Feather name="calendar" size={16} color="#a1a1aa" />
          <Text style={styles.sectionTitle}>Select Event</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.eventScroller}
          contentContainerStyle={styles.eventScrollerContent}
        >
          {events.map((event) => {
            const isSelected = event.id === selectedEventId
            return (
              <TouchableOpacity
                key={event.id}
                style={[
                  styles.eventChip,
                  isSelected && styles.eventChipSelected,
                ]}
                activeOpacity={0.7}
                onPress={() => handleSelectEvent(event.id)}
              >
                <Text
                  style={[
                    styles.eventChipText,
                    isSelected && styles.eventChipTextSelected,
                  ]}
                  numberOfLines={1}
                >
                  {event.title}
                </Text>
                <Text
                  style={[
                    styles.eventChipDate,
                    isSelected && styles.eventChipDateSelected,
                  ]}
                >
                  {formatDateTime(event.start_time)}
                </Text>
              </TouchableOpacity>
            )
          })}
        </ScrollView>

        {selectedEventId && (
          <>
            {/* Manual Check-In */}
            <View style={styles.sectionHeader}>
              <Feather name="check-circle" size={16} color="#a1a1aa" />
              <Text style={styles.sectionTitle}>Manual Check-In</Text>
            </View>

            <View style={styles.checkInCard}>
              <TextInput
                style={styles.checkInInput}
                placeholder="Enter ticket code"
                placeholderTextColor="#71717a"
                value={ticketCode}
                onChangeText={setTicketCode}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={[styles.checkInButton, checkingIn && styles.buttonDisabled]}
                onPress={handleCheckIn}
                disabled={checkingIn}
              >
                {checkingIn ? (
                  <ActivityIndicator size="small" color="#000000" />
                ) : (
                  <Text style={styles.checkInButtonText}>Check In</Text>
                )}
              </TouchableOpacity>
            </View>

            {checkInMessage && (
              <View
                style={[
                  styles.messageBanner,
                  checkInMessage.type === 'success'
                    ? styles.bannerSuccess
                    : styles.bannerError,
                ]}
              >
                <Feather
                  name={
                    checkInMessage.type === 'success'
                      ? 'check-circle'
                      : 'alert-circle'
                  }
                  size={16}
                  color="#ffffff"
                />
                <Text style={styles.bannerText}>{checkInMessage.text}</Text>
              </View>
            )}

            {/* Attendee List */}
            <View style={styles.sectionHeader}>
              <Feather name="users" size={16} color="#a1a1aa" />
              <Text style={styles.sectionTitle}>Attendees</Text>
              <Text style={styles.countBadge}>{attendees.length}</Text>
            </View>

            {loadingAttendees ? (
              <ActivityIndicator
                size="small"
                color="#ffffff"
                style={styles.inlineLoader}
              />
            ) : attendees.length === 0 ? (
              <Text style={styles.noAttendeesText}>No attendees yet</Text>
            ) : (
              attendees.map((attendee) => (
                <View key={attendee.member_id} style={styles.attendeeCard}>
                  <View style={styles.attendeeInfo}>
                    <Text style={styles.attendeeName}>{attendee.name}</Text>
                    <View style={styles.attendeeMeta}>
                      <View style={styles.codeBadge}>
                        <Text style={styles.codeBadgeText}>
                          {attendee.short_code}
                        </Text>
                      </View>
                      <Text style={styles.attendeeAmount}>
                        ${((attendee.amount ?? 0) / 100).toFixed(2)}
                      </Text>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.checkInBadge,
                      {
                        backgroundColor: attendee.checked_in
                          ? '#22c55e'
                          : '#3f3f46',
                      },
                    ]}
                  >
                    <Feather
                      name={attendee.checked_in ? 'check' : 'minus'}
                      size={12}
                      color="#ffffff"
                    />
                    <Text style={styles.checkInBadgeText}>
                      {attendee.checked_in ? 'Checked In' : 'Not Checked In'}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
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
    gap: 12,
  },
  content: { padding: 16, paddingBottom: 48 },
  emptyText: { color: '#71717a', fontSize: 15 },

  /* Section Headers */
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    marginTop: 16,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
  },
  countBadge: {
    color: '#a1a1aa',
    fontSize: 13,
    backgroundColor: '#27272a',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },

  /* Event Selector */
  eventScroller: {
    marginBottom: 8,
    marginHorizontal: -16,
  },
  eventScrollerContent: {
    paddingHorizontal: 16,
    gap: 10,
  },
  eventChip: {
    backgroundColor: '#18181b',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(39,39,42,0.8)',
    minWidth: 160,
  },
  eventChipSelected: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
  },
  eventChipText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  eventChipTextSelected: {
    color: '#000000',
  },
  eventChipDate: {
    color: '#a1a1aa',
    fontSize: 12,
  },
  eventChipDateSelected: {
    color: '#71717a',
  },

  /* Check-In */
  checkInCard: {
    backgroundColor: '#18181b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(39,39,42,0.8)',
    marginBottom: 12,
    gap: 12,
  },
  checkInInput: {
    backgroundColor: '#27272a',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#ffffff',
    fontSize: 15,
    fontFamily: 'monospace' as const,
  },
  checkInButton: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  checkInButtonText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },

  /* Message Banner */
  messageBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  bannerSuccess: {
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
  },
  bannerError: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  bannerText: {
    color: '#ffffff',
    fontSize: 14,
    flex: 1,
  },

  /* Attendees */
  inlineLoader: {
    marginVertical: 16,
  },
  noAttendeesText: {
    color: '#71717a',
    fontSize: 14,
    textAlign: 'center',
    marginVertical: 16,
  },
  attendeeCard: {
    backgroundColor: '#18181b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(39,39,42,0.8)',
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  attendeeInfo: {
    flex: 1,
    marginRight: 12,
  },
  attendeeName: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 6,
  },
  attendeeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  codeBadge: {
    backgroundColor: '#27272a',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  codeBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'monospace' as const,
  },
  attendeeAmount: {
    color: '#a1a1aa',
    fontSize: 13,
  },
  checkInBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  checkInBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
})
