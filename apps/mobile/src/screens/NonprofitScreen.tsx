import React from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { AuthStackParamList } from '../navigation/types'

const COLORS = {
  background: '#0A0A0F',
  card: '#12121A',
  border: 'rgba(255,255,255,0.08)',
  accent: '#14B8A6',
  text: '#FAFAFA',
  muted: '#A1A1AA',
  destructive: '#EF4444',
} as const

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Nonprofits'>

const PROBLEM_CARDS = [
  { icon: 'message-square' as const, title: 'Scattered communication', desc: 'Critical updates disappear in inboxes, group chats, and social feeds.' },
  { icon: 'calendar' as const, title: 'Missed events and low turnout', desc: 'No single calendar or RSVP system everyone actually uses.' },
  { icon: 'users' as const, title: 'Unclear access and roles', desc: 'Board, staff, volunteers, and members all mixed in the same channels.' },
  { icon: 'clock' as const, title: 'Time wasted on tools', desc: 'You spend hours stitching together email, spreadsheets, and chat apps just to stay afloat.' },
]

const STEPS = [
  { n: 1, title: 'Create your organization space', desc: 'Set up roles (board, staff, volunteers, members) and basic settings in minutes.' },
  { n: 2, title: 'Invite your people', desc: 'Share one link. Everyone joins for free and lands in the right channels and groups.' },
  { n: 3, title: 'Run your communication and events from one place', desc: 'Post announcements, schedule events, track RSVPs, and store important documents so nothing gets lost.' },
]

const FEATURE_CARDS = [
  { icon: 'bell' as const, title: 'Keep everyone in the loop', desc: 'Member-only announcements, channels for board/staff/committees, optional DMs.' },
  { icon: 'calendar' as const, title: 'Run better events', desc: 'Central calendar, RSVP tracking, event details in one place.' },
  { icon: 'file-text' as const, title: 'Store what matters', desc: 'Bylaws, policies, minutes, volunteer guides. Controlled access by role.' },
  { icon: 'shield' as const, title: "Protect your community's trust", desc: 'No ads, no tracking, no selling data. You decide what is public.' },
  { icon: 'map-pin' as const, title: 'Optional discovery when appropriate', desc: 'Map-based public directory and events if you want to be found.' },
]

const CRITERIA = [
  'Coordinate members, volunteers, or chapters',
  'Host recurring events or programs',
  'Need to keep a board, staff, and community aligned',
  'Care about privacy and professionalism more than social reach',
]

const EXAMPLE_CARDS = [
  { emoji: '🏢', label: 'Local and regional nonprofits' },
  { emoji: '📢', label: 'Advocacy and community organizations' },
  { emoji: '❤️', label: 'Cultural, heritage, and faith-based groups with formal membership' },
  { emoji: '💼', label: 'Professional associations with nonprofit status' },
]

export function NonprofitScreen() {
  const { width } = useWindowDimensions()
  const nav = useNavigation<Nav>()
  const isNarrow = width < 600

  const onGetStarted = () => nav.navigate('SignUp')
  const onSignIn = () => nav.navigate('SignIn')

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* 1. Hero */}
      <View style={styles.hero}>
        <Text style={styles.heroHeadline}>
          One Secure Home for Your Nonprofit&apos;s <Text style={styles.accentText}>Community</Text>
        </Text>
        <Text style={styles.heroSubhead}>
          MemberCore gives nonprofits a private, organized space to communicate with members, volunteers, and supporters; run events; and share important documents without relying on ad-driven social platforms.
        </Text>
        <View style={[styles.ctaRow, isNarrow && styles.ctaColumn]}>
          <TouchableOpacity style={styles.primaryBtn} onPress={onGetStarted} activeOpacity={0.8}>
            <Text style={styles.primaryBtnText}>Start 30-Day Pro Trial (No Card)</Text>
            <Feather name="arrow-right" size={18} color={COLORS.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={onSignIn} activeOpacity={0.8}>
            <Text style={styles.secondaryBtnText}>See How It Works</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.heroImg} />
      </View>

      {/* 2. Problem */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Too Much Mission, <Text style={styles.accentText}>Not Enough Infrastructure</Text>
        </Text>
        <Text style={styles.sectionDesc}>
          Your job is to advance a mission, not chase down lost emails. But most nonprofits are stuck with:
        </Text>
        <View style={styles.grid2x2}>
          {PROBLEM_CARDS.map((item) => (
            <View key={item.title} style={styles.problemCard}>
              <Feather name={item.icon} size={22} color={COLORS.accent} style={styles.cardIcon} />
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardDesc}>{item.desc}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.italicLine}>
          You feel responsible for the people who care about your mission, but your tools weren&apos;t built for structured, long-term community.
        </Text>
      </View>

      {/* 3. Guide */}
      <View style={[styles.section, styles.twoCol, isNarrow && styles.twoColStack]}>
        <View style={styles.twoColText}>
          <Text style={styles.sectionTitle}>
            Built for Organizations That <Text style={styles.accentText}>Serve People</Text>
          </Text>
          <Text style={styles.sectionDesc}>
            Your nonprofit is more than a mailing list or a Facebook Group. It&apos;s a committed community of people who give their time, money, and attention. They deserve a secure, reliable place to stay informed and engaged.
          </Text>
          <Text style={styles.boldLabel}>MemberCore gives you:</Text>
          {['A private home base for your organization', 'Clear structure for board, staff, volunteers, and members', 'One place to manage communication, events, and key documents'].map((item) => (
            <View key={item} style={styles.checkRow}>
              <Feather name="check" size={18} color={COLORS.accent} />
              <Text style={styles.checkText}>{item}</Text>
            </View>
          ))}
          <View style={styles.calloutCard}>
            <Feather name="shield" size={20} color={COLORS.accent} />
            <Text style={styles.calloutText}>No ads. No selling data. No algorithms deciding who sees your mission.</Text>
          </View>
        </View>
        <View style={styles.placeholderImg} />
      </View>

      {/* 4. Plan */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          How Your Nonprofit Uses <Text style={styles.accentText}>MemberCore</Text>
        </Text>
        {STEPS.map((step) => (
          <View key={step.n} style={styles.stepRow}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>{step.n}</Text>
            </View>
            <View style={styles.stepBody}>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepDesc}>{step.desc}</Text>
            </View>
          </View>
        ))}
        <TouchableOpacity style={[styles.primaryBtn, styles.ctaCenter]} onPress={onGetStarted} activeOpacity={0.8}>
          <Text style={styles.primaryBtnText}>Start 30-Day Pro Trial (No Card)</Text>
          <Feather name="arrow-right" size={18} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      {/* 5. Features */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          The Private Operating System for <Text style={styles.accentText}>Your Nonprofit</Text>
        </Text>
        <View style={styles.featureGrid}>
          {FEATURE_CARDS.map((f) => (
            <View key={f.title} style={styles.featureCard}>
              <Feather name={f.icon} size={24} color={COLORS.accent} style={styles.cardIcon} />
              <Text style={styles.featureCardTitle}>{f.title}</Text>
              <Text style={styles.featureCardDesc}>{f.desc}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* 6. Who This Is For */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Who This Is <Text style={styles.accentText}>For</Text>
        </Text>
        <Text style={styles.sectionDesc}>MemberCore is a fit if you:</Text>
        {CRITERIA.map((c) => (
          <View key={c} style={styles.checkRow}>
            <Feather name="check" size={18} color={COLORS.accent} />
            <Text style={styles.checkText}>{c}</Text>
          </View>
        ))}
        <Text style={styles.boldLabel}>Examples:</Text>
        <View style={styles.grid2x2}>
          {EXAMPLE_CARDS.map((e) => (
            <View key={e.label} style={styles.exampleCard}>
              <Text style={styles.exampleEmoji}>{e.emoji}</Text>
              <Text style={styles.exampleLabel}>{e.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* 7. Pricing */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Simple Pricing. <Text style={styles.accentText}>Unlimited Members.</Text>
        </Text>
        <View style={[styles.pricingRow, isNarrow && styles.pricingColumn]}>
          <View style={styles.pricingCard}>
            <Text style={styles.pricingTitle}>Starter</Text>
            <Text style={styles.pricingPrice}>$0<Text style={styles.pricingPeriod}>/month</Text></Text>
            {['Free forever', 'Calendar & events', 'Events directory access'].map((t) => (
              <View key={t} style={styles.pricingItem}>
                <Feather name="check" size={18} color={COLORS.accent} />
                <Text style={styles.pricingItemText}>{t}</Text>
              </View>
            ))}
            <View style={styles.pricingItem}>
              <Feather name="x" size={18} color={COLORS.destructive} />
              <Text style={styles.pricingItemText}>Read-only access to group chat & docs</Text>
            </View>
            <TouchableOpacity style={styles.outlineBtn} onPress={onGetStarted} activeOpacity={0.8}>
              <Text style={styles.outlineBtnText}>Get Started</Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.pricingCard, styles.pricingCardPro]}>
            <View style={styles.recommendedBadge}><Text style={styles.recommendedBadgeText}>Recommended</Text></View>
            <Text style={styles.pricingTitle}>MemberCore Pro</Text>
            <Text style={styles.pricingPrice}>$97<Text style={styles.pricingPeriod}>/month per org</Text></Text>
            {['Unlimited members, volunteers, and supporters', 'Full private chat & calendar', 'Directory & map (optional)', 'RSVP tracking', 'Full admin controls and permissions'].map((t) => (
              <View key={t} style={styles.pricingItem}>
                <Feather name="check" size={18} color={COLORS.accent} />
                <Text style={styles.pricingItemText}>{t}</Text>
              </View>
            ))}
            <TouchableOpacity style={styles.primaryBtn} onPress={onGetStarted} activeOpacity={0.8}>
              <Text style={styles.primaryBtnText}>Start 30-Day Pro Trial (No Card)</Text>
              <Feather name="arrow-right" size={18} color={COLORS.text} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* 8. Final CTA */}
      <View style={[styles.section, styles.finalCta]}>
        <Text style={styles.finalCtaHeadline}>
          Imagine Your Nonprofit Without <Text style={styles.accentText}>Communication Friction</Text>
        </Text>
        {['Board always knows what\'s happening', 'Staff and volunteers get clear, timely updates', 'Members and supporters never have to say "I didn\'t see that"'].map((item) => (
          <View key={item} style={styles.checkRow}>
            <Feather name="check" size={18} color={COLORS.accent} />
            <Text style={styles.checkText}>{item}</Text>
          </View>
        ))}
        <Text style={styles.finalCtaSubhead}>Give your mission the infrastructure it deserves.</Text>
        <View style={[styles.ctaRow, isNarrow && styles.ctaColumn]}>
          <TouchableOpacity style={styles.primaryBtn} onPress={onGetStarted} activeOpacity={0.8}>
            <Text style={styles.primaryBtnText}>Start Free</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={onSignIn} activeOpacity={0.8}>
            <Text style={styles.secondaryBtnText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 9. Footer */}
      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          <View style={styles.logoBoxSmall}><Text style={styles.logoMSmall}>M</Text></View>
          <Text style={styles.footerCopy}>MemberCore © 2026</Text>
        </View>
        <View style={styles.footerRight}>
          <Text style={styles.footerLink}>Terms</Text>
          <Text style={styles.footerLink}>Privacy</Text>
          <Text style={styles.footerLink}>Who It&apos;s For</Text>
          <Text style={styles.footerLink}>Contact</Text>
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingBottom: 48 },
  hero: { paddingHorizontal: 24, paddingTop: 40, paddingBottom: 32, alignItems: 'center' },
  heroHeadline: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 34,
  },
  accentText: { color: COLORS.accent },
  heroSubhead: { fontSize: 16, color: COLORS.muted, textAlign: 'center', lineHeight: 24, marginBottom: 24, maxWidth: 480 },
  ctaRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  ctaColumn: { flexDirection: 'column', width: '100%' },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.accent, paddingVertical: 14, paddingHorizontal: 20, borderRadius: 10 },
  primaryBtnText: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
  secondaryBtn: { paddingVertical: 14, paddingHorizontal: 20, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border },
  secondaryBtnText: { color: COLORS.text, fontSize: 16 },
  heroImg: { width: '100%', maxWidth: 400, height: 200, borderRadius: 16, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  section: { paddingHorizontal: 24, paddingVertical: 40 },
  sectionTitle: { fontSize: 22, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  sectionDesc: { fontSize: 15, color: COLORS.muted, lineHeight: 22, marginBottom: 16 },
  grid2x2: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  problemCard: { width: '47%', minWidth: 140, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 16 },
  cardIcon: { marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  cardDesc: { fontSize: 14, color: COLORS.muted, lineHeight: 20 },
  italicLine: { fontSize: 14, fontStyle: 'italic', color: COLORS.muted, marginTop: 16 },
  twoCol: { flexDirection: 'row', gap: 24, alignItems: 'flex-start' },
  twoColStack: { flexDirection: 'column' },
  twoColText: { flex: 1, minWidth: 0 },
  placeholderImg: { width: '100%', aspectRatio: 4/3, maxWidth: 280, borderRadius: 12, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  boldLabel: { fontSize: 15, fontWeight: '600', color: COLORS.text, marginTop: 12, marginBottom: 8 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  checkText: { fontSize: 14, color: COLORS.text, flex: 1 },
  calloutCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 16, padding: 16, backgroundColor: COLORS.card, borderLeftWidth: 4, borderLeftColor: COLORS.accent, borderRadius: 8 },
  calloutText: { fontSize: 14, color: COLORS.text, flex: 1 },
  stepRow: { flexDirection: 'row', gap: 16, marginBottom: 16, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 16 },
  stepNumber: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center', shrink: 0 },
  stepNumberText: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  stepBody: { flex: 1, minWidth: 0 },
  stepTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  stepDesc: { fontSize: 14, color: COLORS.muted, lineHeight: 20 },
  ctaCenter: { alignSelf: 'center', marginTop: 8 },
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  featureCard: { width: '47%', minWidth: 160, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 16 },
  featureCardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  featureCardDesc: { fontSize: 14, color: COLORS.muted, lineHeight: 20 },
  exampleCard: { width: '47%', minWidth: 140, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  exampleEmoji: { fontSize: 24 },
  exampleLabel: { fontSize: 14, color: COLORS.text, flex: 1 },
  pricingRow: { flexDirection: 'row', gap: 16 },
  pricingColumn: { flexDirection: 'column' },
  pricingCard: { flex: 1, minWidth: 0, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 20, position: 'relative' },
  pricingCardPro: { borderColor: COLORS.accent, borderWidth: 2 },
  recommendedBadge: { position: 'absolute', top: 12, right: 12, backgroundColor: COLORS.accent, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6 },
  recommendedBadgeText: { fontSize: 12, fontWeight: '700', color: COLORS.text },
  pricingTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  pricingPrice: { fontSize: 24, fontWeight: '700', color: COLORS.text },
  pricingPeriod: { fontSize: 14, fontWeight: '400', color: COLORS.muted },
  pricingItem: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  pricingItemText: { fontSize: 14, color: COLORS.text },
  outlineBtn: { marginTop: 20, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  outlineBtnText: { fontSize: 16, color: COLORS.text },
  finalCta: { alignItems: 'center', paddingVertical: 48 },
  finalCtaHeadline: { fontSize: 24, fontWeight: '700', color: COLORS.text, textAlign: 'center', marginBottom: 16 },
  finalCtaSubhead: { fontSize: 16, color: COLORS.muted, marginBottom: 24, textAlign: 'center' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 24, paddingHorizontal: 24, borderTopWidth: 1, borderTopColor: COLORS.border, flexWrap: 'wrap', gap: 16 },
  footerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoBoxSmall: { width: 28, height: 28, borderRadius: 6, backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center' },
  logoMSmall: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  footerCopy: { fontSize: 13, color: COLORS.muted },
  footerRight: { flexDirection: 'row', gap: 20 },
  footerLink: { fontSize: 13, color: COLORS.muted },
})
