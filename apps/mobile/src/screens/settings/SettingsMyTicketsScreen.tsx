import React, { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Image,
  Modal,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { getApi } from '@membercore/services'
import type { RootStackScreenProps } from '../../navigation/types'

interface Ticket {
  ticket_id: string
  short_code: string
  event_id: string
  event_title: string
  event_start_time: string
  event_location: string
  event_cover_image: string | null
  status: string
  checked_in: boolean
  amount: number
  quantity: number
}

const STATUS_COLORS: Record<string, string> = {
  valid: '#22c55e',
  checked_in: '#3b82f6',
  event_passed: '#71717a',
  refunded: '#ef4444',
}

const STATUS_LABELS: Record<string, string> = {
  valid: 'Valid',
  checked_in: 'Checked In',
  event_passed: 'Event Passed',
  refunded: 'Refunded',
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

export function SettingsMyTicketsScreen({
  route,
}: RootStackScreenProps<'SettingsMyTickets'>) {
  const { orgId } = route.params
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)

  const fetchTickets = useCallback(async () => {
    try {
      const res = await getApi().get(`/payments/${orgId}/my-tickets`)
      setTickets(res.data)
    } catch {
      // silently fail
    }
  }, [orgId])

  useEffect(() => {
    fetchTickets().finally(() => setLoading(false))
  }, [fetchTickets])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchTickets()
    setRefreshing(false)
  }, [fetchTickets])

  const now = new Date()
  const upcoming = tickets.filter((t) => new Date(t.event_start_time) >= now)
  const past = tickets.filter((t) => new Date(t.event_start_time) < now)

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    )
  }

  if (!tickets.length) {
    return (
      <View style={styles.center}>
        <Feather name="tag" size={48} color="rgba(255,255,255,0.5)" />
        <Text style={styles.emptyText}>No tickets yet</Text>
      </View>
    )
  }

  const renderTicketCard = (ticket: Ticket) => {
    const displayStatus = ticket.checked_in ? 'checked_in' : ticket.status
    const statusColor = STATUS_COLORS[displayStatus] || '#71717a'
    const statusLabel = STATUS_LABELS[displayStatus] || ticket.status

    return (
      <TouchableOpacity
        key={ticket.ticket_id}
        style={styles.ticketCard}
        activeOpacity={0.7}
        onPress={() => setSelectedTicket(ticket)}
      >
        {ticket.event_cover_image && (
          <Image
            source={{ uri: ticket.event_cover_image }}
            style={styles.coverImage}
          />
        )}
        <View style={styles.ticketBody}>
          <Text style={styles.eventTitle} numberOfLines={2}>
            {ticket.event_title}
          </Text>
          <View style={styles.infoRow}>
            <Feather name="calendar" size={13} color="#a1a1aa" />
            <Text style={styles.infoText}>
              {formatDateTime(ticket.event_start_time)}
            </Text>
          </View>
          {ticket.event_location ? (
            <View style={styles.infoRow}>
              <Feather name="map-pin" size={13} color="#a1a1aa" />
              <Text style={styles.infoText} numberOfLines={1}>
                {ticket.event_location}
              </Text>
            </View>
          ) : null}
          <View style={styles.badgeRow}>
            <View style={styles.codeBadge}>
              <Text style={styles.codeBadgeText}>{ticket.short_code}</Text>
            </View>
            <View
              style={[styles.statusBadge, { backgroundColor: statusColor }]}
            >
              <Text style={styles.statusBadgeText}>{statusLabel}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    )
  }

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
        {upcoming.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Feather name="clock" size={16} color="#a1a1aa" />
              <Text style={styles.sectionTitle}>Upcoming</Text>
            </View>
            {upcoming.map(renderTicketCard)}
          </>
        )}

        {past.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Feather name="archive" size={16} color="#a1a1aa" />
              <Text style={styles.sectionTitle}>Past</Text>
            </View>
            {past.map(renderTicketCard)}
          </>
        )}
      </ScrollView>

      {/* QR Code / Short Code Modal */}
      <Modal
        visible={!!selectedTicket}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedTicket(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedTicket(null)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {selectedTicket?.event_title}
            </Text>
            <View style={styles.qrContainer}>
              <Text style={styles.shortCodeLarge}>
                {selectedTicket?.short_code}
              </Text>
            </View>
            <Text style={styles.modalHint}>
              Show this code at the event entrance
            </Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setSelectedTicket(null)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
    marginTop: 8,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
  },

  /* Ticket Card */
  ticketCard: {
    backgroundColor: '#18181b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(39,39,42,0.8)',
    marginBottom: 12,
    overflow: 'hidden',
  },
  coverImage: {
    width: '100%',
    height: 120,
    backgroundColor: '#27272a',
  },
  ticketBody: {
    padding: 16,
  },
  eventTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  infoText: {
    color: '#a1a1aa',
    fontSize: 13,
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  codeBadge: {
    backgroundColor: '#27272a',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  codeBadgeText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'monospace' as const,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },

  /* Modal */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#18181b',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(39,39,42,0.8)',
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
  },
  qrContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    minWidth: 200,
    minHeight: 120,
  },
  shortCodeLarge: {
    color: '#000000',
    fontSize: 36,
    fontWeight: '700',
    fontFamily: 'monospace' as const,
    letterSpacing: 4,
  },
  modalHint: {
    color: '#a1a1aa',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
  },
  closeButton: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '600',
  },
})
