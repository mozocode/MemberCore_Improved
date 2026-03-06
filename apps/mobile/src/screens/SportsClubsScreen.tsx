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
  border: '#1E1E2E',
  accent: '#14B8A6',
  text: '#F9FAFB',
  muted: '#9CA3AF',
  destructive: '#EF4444',
} as const

type Nav = NativeStackNavigationProp<AuthStackParamList, 'SportsClubs'>

const PROBLEM_CARDS = [
  { icon: 'message-square' as const, title: 'Lost messages', desc: 'Important messages getting lost in text threads and chat apps.' },
  { icon: 'calendar' as const, title: 'Missed changes', desc: 'Practice and game changes not reaching everyone in time.' },
  { icon: 'users' as const, title: 'Repeated questions', desc: 'Parents asking the same questions over and over.' },
  { icon: 'clock' as const, title: 'Wasted hours', desc: 'Coaches and organizers wasting hours sending reminders and updates.' },
]

const STEPS = [
  { n: 1, title: 'Create your club space', desc: 'Set up your club in minutes and create channels for teams, age groups, and coaches.' },
  { n: 2, title: 'Invite players and parents', desc: 'Share one link. Everyone joins free and lands in the right place.' },
  { n: 3, title: 'Run your season from one app', desc: 'Post announcements, schedule games and practices, track RSVPs, and share documents so nothing gets missed.' },
]

const FEATURE_CARDS = [
  { icon: 'bell' as const, title: 'Keep everyone in the loop', bullets: ['Announcements that don\'t get buried in text chains', 'Channels for whole club, specific teams, and coaches', 'Optional direct messages when 1:1 coordination is needed'] },
  { icon: 'calendar' as const, title: 'Run better schedules', bullets: ['Central calendar for games, practices, and club events', "Simple RSVP tracking so you know who's coming", 'Updates in one place when times or fields change'] },
  { icon: 'file-text' as const, title: 'Share what matters', bullets: ['Club rules, waivers, schedules, and tournament info', 'Controlled access so only the right people see the right documents'] },
  { icon: 'shield' as const, title: 'Protect your community', bullets: ['No ads or tracking pixels aimed at your families', "You decide what (if anything) is public-facing"] },
  { icon: 'map-pin' as const, title: 'Optional public presence', bullets: ['Map-based public listing and public events if you want to be found', 'Keep internal communication completely private'] },
]

const CRITERIA = [
  'Run a small sports club or league',
  'Coordinate multiple teams, coaches, or age groups',
  'Need to keep players and parents updated',
  'Care about privacy and simplicity more than social media',
]

const EXAMPLE_CARDS = [
  { icon: 'award' as const, label: 'Youth sports clubs and academies' },
  { icon: 'users' as const, label: 'Adult recreational leagues and teams' },
  { icon: 'book' as const, label: 'Community and school-based sports organizations' },
]

export function SportsClubsScreen() {
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
          One Home for Your Sports Club&apos;s <Text style={styles.accentText}>Players, Parents, and Coaches</Text>
        </Text>
        <Text style={styles.heroSubhead}>
          MemberCore gives small sports clubs a private, organized place to share updates, manage events, and keep everyone on the same page – without chasing texts, emails, and group chats.
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
          Games Are Simple, <Text style={styles.accentText}>Communication Isn&apos;t</Text>
        </Text>
        <Text style={styles.sectionDesc}>
          Running a team or club is supposed to be fun. Instead, it often feels like:
        </Text>
        <View style={styles.grid2x2}>
          {PROBLEM_CARDS.map((item) => (
            <View key={item.title} style={styles.problemCard}>
              <Feather name={item.icon} size={24} color={COLORS.accent} style={styles.cardIcon} />
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardDesc}>{item.desc}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.italicLine}>
          You signed up to develop players and build community, not manage six different apps and spreadsheets.
        </Text>
      </View>

      {/* 3. Guide */}
      <View style={[styles.section, styles.twoCol, isNarrow && styles.twoColStack]}>
        <View style={styles.twoColText}>
          <Text style={styles.sectionTitle}>
            Built for Clubs That <Text style={styles.accentText}>Actually Play Together</Text>
          </Text>
          <Text style={styles.sectionDesc}>
            Your sports club is more than a text thread.
          </Text>
          <Text style={styles.sectionDesc}>
            It&apos;s coaches, players, and parents who all need clear, reliable information in one place.
          </Text>
          <Text style={styles.boldLabel}>MemberCore gives you:</Text>
          {['One private home for your club', 'Clear structure for teams, age groups, and roles', 'A simple way to run communication and events from one place'].map((item) => (
            <View key={item} style={styles.checkRow}>
              <Feather name="check" size={18} color={COLORS.accent} />
              <Text style={styles.checkText}>{item}</Text>
            </View>
          ))}
          <View style={styles.calloutCard}>
            <Feather name="shield" size={20} color={COLORS.accent} />
            <Text style={styles.calloutText}>No ads. No algorithms. No guessing who saw what.</Text>
          </View>
        </View>
        <View style={styles.placeholderImg} />
      </View>

      {/* 4. Plan */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, styles.textCenter]}>
          How Your Club Uses <Text style={styles.accentText}>MemberCore</Text>
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
        <Text style={[styles.sectionTitle, styles.textCenter]}>
          The Private Operating System for <Text style={styles.accentText}>Your Club</Text>
        </Text>
        <View style={styles.featureGrid}>
          {FEATURE_CARDS.map((f) => (
            <View key={f.title} style={styles.featureCard}>
              <Feather name={f.icon} size={24} color={COLORS.accent} style={styles.cardIcon} />
              <Text style={styles.featureCardTitle}>{f.title}</Text>
              {f.bullets.map((b) => (
                <View key={b} style={styles.bulletRow}>
                  <Feather name="check" size={14} color={COLORS.accent} style={styles.bulletCheck} />
                  <Text style={styles.bulletText}>{b}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      </View>

      {/* 6. Who It's For */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Who MemberCore Is <Text style={styles.accentText}>For</Text>
        </Text>
        <Text style={styles.sectionDesc}>MemberCore is a fit if you:</Text>
        {CRITERIA.map((c) => (
          <View key={c} style={styles.checkRow}>
            <Feather name="check" size={18} color={COLORS.accent} />
            <Text style={styles.checkText}>{c}</Text>
          </View>
        ))}
        <Text style={styles.boldLabel}>Examples:</Text>
        <View style={styles.exampleRow}>
          {EXAMPLE_CARDS.map((e) => (
            <View key={e.label} style={styles.exampleCard}>
              <Feather name={e.icon} size={22} color={COLORS.accent} />
              <Text style={styles.exampleLabel}>{e.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* 7. Pricing */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, styles.textCenter]}>
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
            {['Unlimited players, parents, and coaches', 'Full private chat & calendar', 'Directory & map (optional)', 'RSVP tracking', 'Full admin controls and permissions'].map((t) => (
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
          Imagine Your Club Without <Text style={styles.accentText}>Communication Chaos</Text>
        </Text>
        {['Parents know exactly where to look for updates', 'Coaches stop repeating the same information', 'Players and families show up on time, in the right place'].map((item) => (
          <View key={item} style={styles.checkRow}>
            <Feather name="check" size={18} color={COLORS.accent} />
            <Text style={styles.checkText}>{item}</Text>
          </View>
        ))}
        <Text style={styles.finalCtaSubhead}>Give your club a home that&apos;s built for how you actually play and organize.</Text>
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
          <Text style={styles.footerCopy}>MemberCore © 2025</Text>
        </View>
        <View style={styles.footerRight}>
          <Text style={styles.footerLink}>Home</Text>
          <Text style={styles.footerLink}>Features</Text>
          <Text style={styles.footerLink}>Pricing</Text>
          <Text style={styles.footerLink}>Support</Text>
          <Text style={styles.footerLink}>Terms</Text>
          <Text style={styles.footerLink}>Privacy</Text>
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingBottom: 48 },
  hero: { paddingHorizontal: 24, paddingTop: 100, paddingBottom: 32, alignItems: 'center' },
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
  primaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.accent, paddingVertical: 14, paddingHorizontal: 20, borderRadius: 12 },
  primaryBtnText: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
  secondaryBtn: { paddingVertical: 14, paddingHorizontal: 20, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  secondaryBtnText: { color: COLORS.text, fontSize: 16 },
  heroImg: { width: '100%', maxWidth: 400, height: 200, borderRadius: 12, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  section: { paddingHorizontal: 24, paddingVertical: 40 },
  sectionTitle: { fontSize: 22, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  textCenter: { textAlign: 'center' },
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
  calloutCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 16, padding: 16, backgroundColor: COLORS.card, borderLeftWidth: 4, borderLeftColor: COLORS.accent, borderRadius: 12 },
  calloutText: { fontSize: 14, color: COLORS.text, flex: 1 },
  stepRow: { flexDirection: 'row', gap: 16, marginBottom: 16, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 16 },
  stepNumber: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  stepNumberText: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  stepBody: { flex: 1, minWidth: 0 },
  stepTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  stepDesc: { fontSize: 14, color: COLORS.muted, lineHeight: 20 },
  ctaCenter: { alignSelf: 'center', marginTop: 8 },
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  featureCard: { width: '47%', minWidth: 160, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 16 },
  featureCardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  bulletCheck: { marginTop: 2 },
  bulletText: { fontSize: 13, color: COLORS.muted, lineHeight: 18, flex: 1 },
  exampleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  exampleCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 14, minWidth: 140, flex: 1 },
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
  outlineBtn: { marginTop: 20, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  outlineBtnText: { fontSize: 16, color: COLORS.text },
  finalCta: { alignItems: 'center', paddingVertical: 48 },
  finalCtaHeadline: { fontSize: 24, fontWeight: '700', color: COLORS.text, textAlign: 'center', marginBottom: 16 },
  finalCtaSubhead: { fontSize: 16, color: COLORS.muted, marginBottom: 24, textAlign: 'center' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 24, paddingHorizontal: 24, borderTopWidth: 1, borderTopColor: COLORS.border, flexWrap: 'wrap', gap: 16 },
  footerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoBoxSmall: { width: 28, height: 28, borderRadius: 6, backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center' },
  logoMSmall: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  footerCopy: { fontSize: 13, color: COLORS.muted },
  footerRight: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  footerLink: { fontSize: 13, color: COLORS.muted },
})
