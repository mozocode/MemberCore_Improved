import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { getApi } from '@membercore/services'
import * as Haptics from 'expo-haptics'
import { useAuth } from '../contexts/AuthContext'
import type { RootStackScreenProps } from '../navigation/types'

interface Attendee {
  user_id: string
  name: string
  initial: string
  avatar?: string
}

interface EventData {
  id: string
  title: string
  description?: string
  location?: string
  start_time: string
  end_time?: string
  all_day?: boolean
  cover_image?: string
  is_paid?: boolean
  price?: number
  tickets_sold?: number
  max_attendees?: number
  event_type?: string
  my_rsvp?: string
  rsvp_counts?: { yes: number; maybe: number; no: number }
  attendees?: { yes: Attendee[]; maybe: Attendee[]; no: Attendee[] }
  created_by?: string
}

export function EventDetailScreen({ route, navigation }: RootStackScreenProps<'EventDetail'>) {
  const { orgId, eventId } = route.params
  const { user } = useAuth()
  const api = getApi()
  const [event, setEvent] = useState<EventData | null>(null)
  const [loading, setLoading] = useState(true)
  const [rsvpLoading, setRsvpLoading] = useState(false)
  const [myRole, setMyRole] = useState<string | null>(null)
  const [hasTicket, setHasTicket] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const fetchEvent = useCallback(async () => {
    try {
      const { data } = await api.get(`/events/${orgId}/${eventId}`)
      setEvent(data)
    } catch {
      setEvent(null)
    } finally {
      setLoading(false)
    }
  }, [orgId, eventId])

  useEffect(() => {
    fetchEvent()
    api.get(`/organizations/${orgId}/members/me`)
      .then((r) => setMyRole(String(r.data?.role ?? 'member')))
      .catch(() => setMyRole(null))
    api.get(`/payments/${orgId}/my-tickets`)
      .then((r) => {
        const tickets = Array.isArray(r.data) ? r.data : []
        setHasTicket(tickets.some((t: any) => t.event_id === eventId))
      })
      .catch(() => setHasTicket(false))
  }, [fetchEvent, orgId, eventId])

  const role = (myRole ?? '').toLowerCase()
  const isAdmin = role === 'admin' || role === 'owner'
  const isCreator = Boolean(event && user?.id && event.created_by === user.id)
  const canEdit = isAdmin || isCreator

  const handleRsvp = async (status: 'yes' | 'maybe' | 'no') => {
    if (!event) return
    const newStatus = event.my_rsvp === status ? null : status
    setRsvpLoading(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    try {
      if (newStatus === null) {
        await api.delete(`/events/${orgId}/${eventId}/rsvp`)
      } else {
        await api.post(`/events/${orgId}/${eventId}/rsvp`, { status: newStatus })
      }
      const { data } = await api.get(`/events/${orgId}/${eventId}`)
      setEvent(data)
    } catch (e) {
      console.error(e)
    } finally {
      setRsvpLoading(false)
    }
  }

  const handleDelete = () => {
    if (!event) return
    Alert.alert('Delete Event', `Delete "${event.title}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true)
          try {
            await api.delete(`/events/${orgId}/${eventId}`)
            navigation.goBack()
          } catch (e) {
            console.error(e)
          } finally {
            setDeleting(false)
          }
        },
      },
    ])
  }

  const formatDate = (d?: string) => {
    if (!d) return ''
    try {
      return new Date(d).toLocaleDateString(undefined, {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
      })
    } catch { return d }
  }

  const formatTime = (d?: string) => {
    if (!d) return ''
    try {
      return new Date(d).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    } catch { return '' }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#71717a" />
      </View>
    )
  }

  if (!event) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFound}>Event not found</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Back to Calendar</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const goingCount = event.rsvp_counts?.yes ?? 0
  const maybeCount = event.rsvp_counts?.maybe ?? 0
  const notGoingCount = event.rsvp_counts?.no ?? 0
  const isSoldOut = event.max_attendees != null && (event.tickets_sold ?? 0) >= event.max_attendees
  const isPastEvent = event.start_time ? new Date(event.start_time) < new Date() : false

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Cover image */}
      {event.cover_image ? (
        <Image source={{ uri: event.cover_image }} style={styles.coverImage} resizeMode="cover" />
      ) : null}

      {/* Event info card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.eventTitle}>{event.title}</Text>
          {canEdit && (
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={handleDelete}
              disabled={deleting}
            >
              <Feather name="trash-2" size={18} color="#f87171" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.metaRow}>
          <Feather name="calendar" size={16} color="#71717a" />
          <Text style={styles.metaText}>{formatDate(event.start_time)}</Text>
        </View>
        <View style={styles.metaRow}>
          <Feather name="clock" size={16} color="#71717a" />
          <Text style={styles.metaText}>
            {event.all_day ? 'All day' : `${formatTime(event.start_time)}${event.end_time ? ` - ${formatTime(event.end_time)}` : ''}`}
          </Text>
        </View>
        {event.location ? (
          <View style={styles.metaRow}>
            <Feather name="map-pin" size={16} color="#71717a" />
            <Text style={styles.metaText}>{event.location}</Text>
          </View>
        ) : null}

        {event.is_paid && event.price != null ? (
          <View style={styles.priceRow}>
            <Text style={styles.priceAmount}>${(event.price ?? 0).toFixed(2)}</Text>
            <Text style={styles.priceLabel}>per person</Text>
          </View>
        ) : null}

        {event.event_type ? (
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{event.event_type}</Text>
          </View>
        ) : null}

        {event.description ? (
          <View style={styles.descSection}>
            <Text style={styles.descText}>{event.description}</Text>
          </View>
        ) : null}
      </View>

      {/* RSVP section */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Your Response</Text>
        <View style={styles.rsvpRow}>
          <TouchableOpacity
            style={[styles.rsvpBtn, event.my_rsvp === 'yes' && styles.rsvpGoing]}
            onPress={() => handleRsvp('yes')}
            disabled={rsvpLoading}
          >
            <Feather name="check" size={16} color={event.my_rsvp === 'yes' ? '#ffffff' : '#ffffff'} />
            <Text style={[styles.rsvpBtnText, event.my_rsvp === 'yes' && styles.rsvpBtnTextActive]}>Going</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.rsvpBtn, event.my_rsvp === 'maybe' && styles.rsvpMaybe]}
            onPress={() => handleRsvp('maybe')}
            disabled={rsvpLoading}
          >
            <Feather name="help-circle" size={16} color={event.my_rsvp === 'maybe' ? '#000000' : '#ffffff'} />
            <Text style={[styles.rsvpBtnText, event.my_rsvp === 'maybe' && styles.rsvpBtnTextMaybe]}>Maybe</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.rsvpBtn, event.my_rsvp === 'no' && styles.rsvpNo]}
            onPress={() => handleRsvp('no')}
            disabled={rsvpLoading}
          >
            <Feather name="x" size={16} color="#ffffff" />
            <Text style={[styles.rsvpBtnText, event.my_rsvp === 'no' && styles.rsvpBtnTextActive]}>Cannot Go</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Ticket section */}
      {event.is_paid && (
        <View style={styles.card}>
          <View style={styles.ticketHeader}>
            <Feather name="tag" size={18} color="#4ade80" />
            <Text style={styles.sectionTitle}>Event Ticket</Text>
          </View>
          <Text style={styles.ticketSubtext}>
            {hasTicket ? 'You have a ticket for this event' : `$${Number(event.price ?? 0).toFixed(2)} per person`}
          </Text>
          {hasTicket ? (
            <TouchableOpacity
              style={styles.ticketBtn}
              onPress={() => navigation.navigate('SettingsMyTickets', { orgId })}
            >
              <Feather name="tag" size={16} color="#000000" />
              <Text style={styles.ticketBtnText}>View Your Ticket</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.ticketNote}>
              {isSoldOut ? 'Sold Out' : isPastEvent ? 'Event Ended' : 'Purchase available via web'}
            </Text>
          )}
        </View>
      )}

      {/* Attendees section */}
      <View style={styles.card}>
        <View style={styles.ticketHeader}>
          <Feather name="users" size={18} color="#71717a" />
          <Text style={styles.sectionTitle}>Attendees</Text>
        </View>
        <View style={styles.attendeeGrid}>
          <View style={styles.attendeeBox}>
            <Text style={[styles.attendeeCount, { color: '#4ade80' }]}>{goingCount}</Text>
            <Text style={styles.attendeeLabel}>Going</Text>
          </View>
          <View style={styles.attendeeBox}>
            <Text style={[styles.attendeeCount, { color: '#eab308' }]}>{maybeCount}</Text>
            <Text style={styles.attendeeLabel}>Maybe</Text>
          </View>
          <View style={styles.attendeeBox}>
            <Text style={[styles.attendeeCount, { color: '#ef4444' }]}>{notGoingCount}</Text>
            <Text style={styles.attendeeLabel}>Cannot Go</Text>
          </View>
        </View>

        {/* Attendee lists */}
        {goingCount > 0 && event.attendees?.yes && (
          <View style={styles.attendeeSection}>
            <Text style={styles.attendeeSectionTitle}>Going ({event.attendees.yes.length})</Text>
            <View style={styles.attendeeChips}>
              {event.attendees.yes.map((a) => (
                <View key={a.user_id} style={styles.attendeeChip}>
                  {a.avatar ? (
                    <Image source={{ uri: a.avatar }} style={styles.attendeeChipAvatar} />
                  ) : (
                    <View style={[styles.attendeeChipAvatarPlaceholder, { backgroundColor: 'rgba(74,222,128,0.2)' }]}>
                      <Text style={{ color: '#4ade80', fontSize: 11, fontWeight: '600' }}>{a.initial}</Text>
                    </View>
                  )}
                  <Text style={styles.attendeeChipName}>{a.name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
        {maybeCount > 0 && event.attendees?.maybe && (
          <View style={styles.attendeeSection}>
            <Text style={styles.attendeeSectionTitle}>Maybe ({event.attendees.maybe.length})</Text>
            <View style={styles.attendeeChips}>
              {event.attendees.maybe.map((a) => (
                <View key={a.user_id} style={styles.attendeeChip}>
                  {a.avatar ? (
                    <Image source={{ uri: a.avatar }} style={styles.attendeeChipAvatar} />
                  ) : (
                    <View style={[styles.attendeeChipAvatarPlaceholder, { backgroundColor: 'rgba(234,179,8,0.2)' }]}>
                      <Text style={{ color: '#eab308', fontSize: 11, fontWeight: '600' }}>{a.initial}</Text>
                    </View>
                  )}
                  <Text style={styles.attendeeChipName}>{a.name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
        {goingCount === 0 && maybeCount === 0 && notGoingCount === 0 && (
          <Text style={styles.noAttendees}>No responses yet. Be the first to RSVP!</Text>
        )}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  content: { paddingBottom: 48 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000000' },
  notFound: { color: '#a1a1aa', fontSize: 16, marginBottom: 16 },
  backBtn: { backgroundColor: '#27272a', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10 },
  backBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '500' },

  coverImage: { width: '100%', height: 200, backgroundColor: '#18181b' },

  card: {
    backgroundColor: 'rgba(24,24,27,0.5)',
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  eventTitle: { color: '#ffffff', fontSize: 22, fontWeight: '700', flex: 1 },
  deleteBtn: { padding: 8 },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  metaText: { color: '#d4d4d8', fontSize: 14 },

  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, marginBottom: 8 },
  priceAmount: { color: '#4ade80', fontSize: 18, fontWeight: '600' },
  priceLabel: { color: '#71717a', fontSize: 14 },

  typeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(168,85,247,0.2)',
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 8,
  },
  typeBadgeText: { color: '#c084fc', fontSize: 13, fontWeight: '500' },

  descSection: { borderTopWidth: 1, borderTopColor: '#27272a', paddingTop: 12, marginTop: 8 },
  descText: { color: '#d4d4d8', fontSize: 14, lineHeight: 20 },

  sectionTitle: { color: '#ffffff', fontSize: 17, fontWeight: '600', marginBottom: 12 },

  // RSVP
  rsvpRow: { flexDirection: 'row', gap: 8 },
  rsvpBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#27272a',
  },
  rsvpGoing: { backgroundColor: '#22c55e' },
  rsvpMaybe: { backgroundColor: '#eab308' },
  rsvpNo: { backgroundColor: '#ef4444' },
  rsvpBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  rsvpBtnTextActive: { color: '#ffffff' },
  rsvpBtnTextMaybe: { color: '#000000' },

  // Tickets
  ticketHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  ticketSubtext: { color: '#a1a1aa', fontSize: 14, marginBottom: 12 },
  ticketBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingVertical: 12,
  },
  ticketBtnText: { color: '#000000', fontSize: 15, fontWeight: '600' },
  ticketNote: { color: '#71717a', fontSize: 14 },

  // Attendees
  attendeeGrid: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  attendeeBox: {
    flex: 1,
    backgroundColor: 'rgba(39,39,42,0.5)',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  attendeeCount: { fontSize: 24, fontWeight: '700' },
  attendeeLabel: { color: '#a1a1aa', fontSize: 13, marginTop: 2 },

  attendeeSection: { marginTop: 12 },
  attendeeSectionTitle: { color: '#a1a1aa', fontSize: 13, fontWeight: '500', marginBottom: 8 },
  attendeeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  attendeeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#27272a',
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  attendeeChipAvatar: { width: 24, height: 24, borderRadius: 12 },
  attendeeChipAvatarPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attendeeChipName: { color: '#d4d4d8', fontSize: 13 },
  noAttendees: { color: '#71717a', textAlign: 'center', paddingVertical: 16, fontSize: 14 },
})
