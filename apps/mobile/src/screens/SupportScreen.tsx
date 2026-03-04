import React, { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  useWindowDimensions,
  Modal,
  Pressable,
} from 'react-native'
import { Feather } from '@expo/vector-icons'

const COLORS = {
  background: '#0F1117',
  cardBg: '#181B24',
  cardBgEnd: '#13151C',
  border: '#262A35',
  text: '#F2F2F2',
  muted: '#7A7F8E',
  primary: '#FF6A00',
  primaryLight: '#FF9A33',
} as const

const SUBJECT_OPTIONS = [
  'General Question',
  'Account & Billing',
  'Report a Bug',
  'Feature Request',
  'Onboarding Help',
  'Other',
]

const CHANNELS = [
  { icon: 'mail' as const, title: 'Email Us', detail: 'support@membercore.io', subtitle: 'Best for account and billing questions' },
  { icon: 'message-square' as const, title: 'Live Chat', detail: 'Available in-app', subtitle: 'Mon–Fri, 9am–5pm ET' },
  { icon: 'book' as const, title: 'Help Center', detail: 'docs.membercore.io', subtitle: 'Guides, FAQs, and tutorials' },
]

export function SupportScreen() {
  const { width } = useWindowDimensions()
  const isNarrow = width < 600
  const [submitted, setSubmitted] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [subjectPickerOpen, setSubjectPickerOpen] = useState(false)

  const canSubmit = name.trim() && email.trim() && subject.trim() && message.trim()

  const handleSubmit = () => {
    if (!canSubmit) return
    setSubmitted(true)
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero */}
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>
          How Can We <Text style={styles.heroHighlight}>Help?</Text>
        </Text>
        <Text style={styles.heroSubtitle}>
          We&apos;re a small team that takes support seriously. Reach out and we&apos;ll get back to you within one business day.
        </Text>
      </View>

      {/* Support channel cards */}
      <View style={[styles.channelRow, isNarrow && styles.channelColumn]}>
        {CHANNELS.map((ch) => (
          <View key={ch.title} style={styles.channelCard}>
            <View style={styles.channelIconWrap}>
              <Feather name={ch.icon} size={20} color={COLORS.primary} />
            </View>
            <Text style={styles.channelTitle}>{ch.title}</Text>
            <Text style={styles.channelDetail}>{ch.detail}</Text>
            <Text style={styles.channelSubtitle}>{ch.subtitle}</Text>
          </View>
        ))}
      </View>

      {/* Contact form card */}
      <View style={styles.formCard}>
        {!submitted ? (
          <>
            <Text style={styles.formTitle}>Send Us a Message</Text>
            <Text style={styles.formSubtitle}>We typically respond within one business day.</Text>
            <View style={styles.formSpacer} />
            <View style={[styles.formRow, isNarrow && styles.formColumn]}>
              <View style={styles.formHalf}>
                <Text style={styles.label}>Name</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Your name"
                  placeholderTextColor={COLORS.muted}
                  style={styles.input}
                />
              </View>
              <View style={styles.formHalf}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor={COLORS.muted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={styles.input}
                />
              </View>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Subject</Text>
              <TouchableOpacity
                style={styles.select}
                onPress={() => setSubjectPickerOpen(true)}
                activeOpacity={0.8}
              >
                <Text style={[styles.selectText, !subject && styles.selectPlaceholder]}>
                  {subject || 'Select a topic'}
                </Text>
                <Feather name="chevron-down" size={18} color={COLORS.muted} />
              </TouchableOpacity>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Message</Text>
              <TextInput
                value={message}
                onChangeText={setMessage}
                placeholder="How can we help?"
                placeholderTextColor={COLORS.muted}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
                style={[styles.input, styles.textArea]}
              />
            </View>
            <TouchableOpacity
              style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit}
              activeOpacity={0.8}
            >
              <Text style={styles.submitBtnText}>Send Message</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.successWrap}>
            <View style={styles.successIconWrap}>
              <Feather name="send" size={20} color={COLORS.primary} />
            </View>
            <Text style={styles.successTitle}>Message Sent</Text>
            <Text style={styles.successSubtitle}>
              We&apos;ll get back to you shortly. Check your inbox for a confirmation.
            </Text>
          </View>
        )}
      </View>

      {/* Response time */}
      <View style={styles.responseRow}>
        <Feather name="clock" size={14} color={COLORS.muted} />
        <Text style={styles.responseText}>Average response time: under 12 hours</Text>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          <View style={styles.logoBox}><Text style={styles.logoM}>M</Text></View>
          <Text style={styles.footerCopy}>MemberCore © 2026</Text>
        </View>
        <View style={styles.footerRight}>
          <Text style={styles.footerLink}>Terms</Text>
          <Text style={styles.footerLink}>Privacy</Text>
          <Text style={styles.footerLink}>Who It&apos;s For</Text>
          <Text style={styles.footerLink}>Contact</Text>
        </View>
      </View>

      {/* Subject picker modal */}
      <Modal visible={subjectPickerOpen} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setSubjectPickerOpen(false)}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select a topic</Text>
            {SUBJECT_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={styles.modalOption}
                onPress={() => {
                  setSubject(opt)
                  setSubjectPickerOpen(false)
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.modalOptionText}>{opt}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalCancel} onPress={() => setSubjectPickerOpen(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingBottom: 48 },
  hero: { paddingHorizontal: 24, paddingTop: 80, paddingBottom: 40, alignItems: 'center' },
  heroTitle: { fontSize: 28, fontWeight: '700', color: COLORS.text, textAlign: 'center', marginBottom: 16 },
  heroHighlight: { color: COLORS.primary },
  heroSubtitle: { fontSize: 16, color: COLORS.muted, textAlign: 'center', lineHeight: 24, maxWidth: 400 },
  channelRow: { flexDirection: 'row', gap: 16, paddingHorizontal: 24, marginBottom: 48 },
  channelColumn: { flexDirection: 'column' },
  channelCard: {
    flex: 1,
    minWidth: 140,
    backgroundColor: COLORS.cardBg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  channelIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: `${COLORS.primary}26`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  channelTitle: { fontSize: 18, fontWeight: '600', color: COLORS.text, marginBottom: 4 },
  channelDetail: { fontSize: 14, fontWeight: '500', color: COLORS.primary, marginBottom: 4 },
  channelSubtitle: { fontSize: 12, color: COLORS.muted },
  formCard: {
    marginHorizontal: 24,
    marginBottom: 32,
    padding: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.cardBg,
  },
  formTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  formSubtitle: { fontSize: 14, color: COLORS.muted, marginBottom: 24 },
  formSpacer: { marginBottom: 0 },
  formRow: { flexDirection: 'row', gap: 16 },
  formColumn: { flexDirection: 'column' },
  formHalf: { flex: 1, minWidth: 0 },
  field: { marginTop: 16 },
  label: { fontSize: 14, fontWeight: '500', color: COLORS.text, marginBottom: 8 },
  input: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.text,
  },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  selectText: { fontSize: 14, color: COLORS.text },
  selectPlaceholder: { color: COLORS.muted },
  textArea: { minHeight: 100, paddingTop: 10 },
  submitBtn: {
    marginTop: 24,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  successWrap: { alignItems: 'center', paddingVertical: 32 },
  successIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${COLORS.primary}26`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successTitle: { fontSize: 18, fontWeight: '600', color: COLORS.text, marginBottom: 8 },
  successSubtitle: { fontSize: 14, color: COLORS.muted, textAlign: 'center', maxWidth: 320 },
  responseRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 48 },
  responseText: { fontSize: 12, color: COLORS.muted },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 24,
    paddingHorizontal: 24,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    flexWrap: 'wrap',
    gap: 16,
  },
  footerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoBox: { width: 28, height: 28, borderRadius: 6, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  logoM: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  footerCopy: { fontSize: 13, color: COLORS.muted },
  footerRight: { flexDirection: 'row', flexWrap: 'wrap', gap: 20 },
  footerLink: { fontSize: 13, color: COLORS.muted },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalContent: { backgroundColor: COLORS.cardBg, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, padding: 16, maxHeight: '80%' },
  modalTitle: { fontSize: 16, fontWeight: '600', color: COLORS.text, marginBottom: 12 },
  modalOption: { paddingVertical: 12, paddingHorizontal: 16 },
  modalOptionText: { fontSize: 15, color: COLORS.text },
  modalCancel: { marginTop: 8, paddingVertical: 12, alignItems: 'center' },
  modalCancelText: { fontSize: 15, color: COLORS.muted },
})
