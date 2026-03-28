import React from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  Pressable,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import type { AuthStackParamList } from '../navigation/types'

const COLORS = {
  background: '#0A0A0F',
  card: '#12121A',
  border: 'rgba(255,255,255,0.08)',
  accent: '#F59E0B',
  text: '#FAFAFA',
  muted: '#A1A1AA',
  destructive: '#EF4444',
} as const

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Home'>

const TRUST_ITEMS = [
  { icon: 'users' as const, label: 'Unlimited members' },
  { icon: 'message-circle' as const, label: 'Private chat & docs' },
  { icon: 'shield' as const, label: 'Privacy-first' },
  { icon: 'file-text' as const, label: 'Optional public discovery' },
]

const PROBLEM_CARDS = [
  { icon: 'message-square' as const, title: 'Scattered messages', desc: 'Important updates get buried in group chats and email threads.' },
  { icon: 'calendar' as const, title: 'Missed events', desc: 'No single calendar or RSVP system everyone actually checks.' },
  { icon: 'user-x' as const, title: 'Wrong audience', desc: 'Messages go to the wrong people or reach nobody at all.' },
  { icon: 'clock' as const, title: 'Time wasted', desc: 'You spend hours wrestling tools instead of leading your people.' },
]

const VALUE_PROPS = [
  { icon: 'eye-off' as const, label: 'No ads' },
  { icon: 'shield' as const, label: 'No selling your data' },
  { icon: 'zap' as const, label: 'No algorithm deciding who sees what' },
]

const STEPS = [
  { n: 1, title: 'Create your organization', desc: 'Set up your space in under two minutes and define your roles and permissions.' },
  { n: 2, title: 'Invite your members', desc: 'Share your link. Members join for free and land in the right channels and groups.' },
  { n: 3, title: 'Run everything from one place', desc: "Post announcements, schedule events, track RSVPs, share documents, and decide what's public." },
]

const FEATURE_CARDS = [
  { icon: 'message-circle' as const, title: 'Private group chat', desc: 'Member-only chat and DMs. Organized channels for committees, officers, and interest groups.' },
  { icon: 'calendar' as const, title: 'Calendar & events', desc: 'Central calendar and event pages. RSVPs and reminders in the same place members already use.' },
  { icon: 'file-text' as const, title: 'Required documents', desc: 'Bylaws, onboarding docs, meeting notes, and forms. Controlled access by role.' },
  { icon: 'map-pin' as const, title: 'Map-based discovery', desc: 'Map-based public directory and event listings. Turn visibility on or off per organization.' },
  { icon: 'shield' as const, title: 'Privacy-first', desc: 'No ads, tracking pixels, or selling member data. You choose what\'s public and what stays internal.' },
  { icon: 'layers' as const, title: 'Built to scale', desc: 'One app for your entire organization. Unlimited members, full admin controls and permissions.' },
]

const AUDIENCE_CARDS = [
  { icon: 'briefcase' as const, label: 'Clubs and member-based communities' },
  { icon: 'users' as const, label: 'Professional and trade associations' },
  { icon: 'shield' as const, label: 'Veteran and service organizations' },
  { icon: 'heart' as const, label: 'Cultural, heritage, and faith-based groups' },
  { icon: 'book' as const, label: 'Greek life, alumni, and academic organizations' },
  { icon: 'award' as const, label: 'Nonprofits and advocacy groups' },
]

const STAKES_CARDS = [
  { icon: 'eye' as const, title: "Everyone knows what's happening", desc: 'No more "I didn\'t see that." One place for all updates, events, and documents.' },
  { icon: 'calendar' as const, title: 'Discovery is intentional', desc: 'Events fill up because the info lives in one obvious place members already check.' },
  { icon: 'clock' as const, title: "Leaders get time back", desc: "You get your time back and your group gets stronger. Lead, don't administrate." },
]

function PlaceholderImage({ style }: { style?: object }) {
  return (
    <View style={[styles.placeholderImg, style]} />
  )
}

export function HomeScreen() {
  const { width } = useWindowDimensions()
  const nav = useNavigation<Nav>()
  const isNarrow = width < 600

  const onGetStarted = () => nav.navigate('SignUp')
  const onSignIn = () => nav.navigate('SignIn')
  const onSeePlatform = () => nav.navigate('SignIn')

  return (
    <View style={styles.root}>
      {/* 1. Navbar (sticky) */}
      <View style={styles.navbar}>
        <View style={styles.navLeft}>
          <View style={styles.logoBox}>
            <Text style={styles.logoM}>M</Text>
          </View>
          <Text style={styles.logoText}>MemberCore</Text>
        </View>
        {!isNarrow && (
          <View style={styles.navCenter}>
            <Pressable onPress={() => {}}><Text style={styles.navLink}>Product</Text></Pressable>
            <Pressable onPress={() => {}}><Text style={styles.navLink}>Pricing</Text></Pressable>
            <Pressable onPress={() => {}}><Text style={styles.navLink}>Who It&apos;s For</Text></Pressable>
            <Pressable onPress={onSignIn}><Text style={styles.navLink}>Sign In</Text></Pressable>
          </View>
        )}
        <TouchableOpacity style={styles.getStartedBtn} onPress={onGetStarted} activeOpacity={0.8}>
          <Text style={styles.getStartedBtnText}>Get Started</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 2. Hero */}
        <View style={[styles.section, styles.hero]}>
          <Text style={styles.heroHeadline}>
            One Private Home for <Text style={styles.accentText}>All Your Members</Text>
          </Text>
          <Text style={styles.heroSubhead}>
            MemberCore replaces scattered chats, calendars, and spreadsheets with one private operating system for your members. Communicate, run events, share documents, and control what the world sees from a single, secure platform.
          </Text>
          <View style={[styles.ctaRow, isNarrow && styles.ctaColumn]}>
            <TouchableOpacity style={styles.primaryBtn} onPress={onGetStarted} activeOpacity={0.8}>
              <Text style={styles.primaryBtnText}>Start 30-Day Pro Trial (No Card)</Text>
              <Feather name="arrow-right" size={18} color={COLORS.text} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={onSeePlatform} activeOpacity={0.8}>
              <Text style={styles.secondaryBtnText}>See the Platform</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.trustRow}>
            {TRUST_ITEMS.map((item) => (
              <View key={item.label} style={styles.trustItem}>
                <Feather name={item.icon} size={18} color={COLORS.accent} />
                <Text style={styles.trustLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
          <View style={styles.heroImgWrap}>
            <PlaceholderImage style={styles.heroImg} />
          </View>
        </View>

        {/* 3. Problem */}
        <View style={[styles.section, styles.twoCol, isNarrow && styles.twoColStack]}>
          <View style={styles.twoColText}>
            <Text style={styles.sectionTitle}>
              Tools That Weren&apos;t Built for <Text style={styles.accentText}>Membership</Text>
            </Text>
            <Text style={styles.sectionDesc}>
              If you lead a group, club, or association, you&apos;re expected to keep everyone informed, engaged, and organized. But the tools you have right now make that harder, not easier.
            </Text>
            <View style={styles.grid2x2}>
              {PROBLEM_CARDS.map((item, i) => (
                <View key={item.title} style={styles.problemCard}>
                  <Feather name={item.icon} size={22} color={COLORS.accent} style={styles.cardIcon} />
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardDesc}>{item.desc}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.italicLine}>
              You feel the weight of responsibility without the infrastructure to back you up.
            </Text>
          </View>
          <View style={styles.twoColImg}>
            <PlaceholderImage style={styles.sideImg} />
          </View>
        </View>

        {/* 4. Guide */}
        <View style={[styles.section, styles.twoCol, isNarrow && styles.twoColStack]}>
          <View style={styles.twoColImg}>
            <PlaceholderImage style={styles.sideImg} />
          </View>
          <View style={styles.twoColText}>
            <Text style={styles.sectionTitle}>
              Your Group Deserves Better <Text style={styles.accentText}>Infrastructure</Text>
            </Text>
            <Text style={styles.sectionDesc}>
              A real organization is more than a chat thread. It&apos;s shared purpose, identity, and commitment. You need a platform that treats it that seriously.
            </Text>
            <Text style={styles.sectionDesc}>
              MemberCore exists to give groups like yours a private, secure, reliable foundation for managing members.
            </Text>
            <View style={styles.valuePropsRow}>
              {VALUE_PROPS.map((v) => (
                <View key={v.label} style={styles.valuePropBadge}>
                  <Feather name={v.icon} size={14} color={COLORS.accent} />
                  <Text style={styles.valuePropLabel}>{v.label}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.closingLine}>Just one place that works the way you do.</Text>
          </View>
        </View>

        {/* 5. Plan */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Get Up and Running in <Text style={styles.accentText}>Three Steps</Text>
          </Text>
          <View style={[styles.stepsRow, isNarrow && styles.stepsColumn]}>
            {STEPS.map((step) => (
              <View key={step.n} style={styles.stepCard}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>{step.n}</Text>
                </View>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepDesc}>{step.desc}</Text>
              </View>
            ))}
          </View>
          <View style={styles.planImgWrap}>
            <PlaceholderImage style={styles.planImg} />
          </View>
          <TouchableOpacity style={[styles.primaryBtn, styles.ctaCenter]} onPress={onGetStarted} activeOpacity={0.8}>
            <Text style={styles.primaryBtnText}>Start 30-Day Pro Trial (No Card)</Text>
            <Feather name="arrow-right" size={18} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        {/* 6. Features */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Everything You Need — <Text style={styles.accentText}>Nothing You Don&apos;t</Text>
          </Text>
          <Text style={styles.sectionDesc}>
            The private operating system for membership. Built for privacy, structure, and engagement.
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
          <PlaceholderImage style={styles.featureImg} />
        </View>

        {/* 7. Who */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Built for Organizations That <Text style={styles.accentText}>Manage People</Text>
          </Text>
          <Text style={styles.sectionDesc}>
            If you manage people, run events, or care about privacy, MemberCore was built for you.
          </Text>
          <View style={styles.audienceGrid}>
            {AUDIENCE_CARDS.map((a) => (
              <View key={a.label} style={styles.audienceCard}>
                <Feather name={a.icon} size={20} color={COLORS.accent} />
                <Text style={styles.audienceLabel}>{a.label}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.closingLine}>
            You don&apos;t have to fit into a &apos;social network&apos; box to get real infrastructure.
          </Text>
        </View>

        {/* 8. Pricing */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Simple Pricing. <Text style={styles.accentText}>Unlimited Members.</Text>
          </Text>
          <Text style={styles.sectionDesc}>
            Start on Pro for 30 days, no card. Then keep Starter free forever or upgrade to Pro.
          </Text>
          <View style={[styles.pricingRow, isNarrow && styles.pricingColumn]}>
            <View style={styles.pricingCard}>
              <Text style={styles.pricingTitle}>Starter</Text>
              <Text style={styles.pricingPrice}>$0<Text style={styles.pricingPeriod}>/month</Text></Text>
              {['Calendar & events', 'Events directory access', 'Read-only group chat & docs'].map((t) => (
                <View key={t} style={styles.pricingItem}>
                  <Feather name="check" size={18} color={COLORS.accent} />
                  <Text style={styles.pricingItemText}>{t}</Text>
                </View>
              ))}
              {['Limited admin controls', 'No RSVP tracking'].map((t) => (
                <View key={t} style={styles.pricingItem}>
                  <Feather name="x" size={18} color={COLORS.destructive} />
                  <Text style={styles.pricingItemText}>{t}</Text>
                </View>
              ))}
              <TouchableOpacity style={styles.outlineBtn} onPress={onGetStarted} activeOpacity={0.8}>
                <Text style={styles.outlineBtnText}>Get Started</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.pricingCard, styles.pricingCardPro]}>
              <View style={styles.popularBadge}>
                <Text style={styles.popularBadgeText}>Popular</Text>
              </View>
              <Text style={styles.pricingTitle}>MemberCore Pro</Text>
              <Text style={styles.pricingPrice}>$97<Text style={styles.pricingPeriod}>/month per org</Text></Text>
              {['Unlimited members', 'Full private chat & calendar', 'Directory & map (optional)', 'RSVP tracking', 'Full admin controls & permissions'].map((t) => (
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

        {/* 9. Stakes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Imagine Membership <Text style={styles.accentText}>Without Friction</Text>
          </Text>
          <Text style={styles.sectionDesc}>
            Everyone knows what&apos;s happening. People are better connected. Leaders spend less time managing tools.
          </Text>
          <View style={[styles.stakesRow, isNarrow && styles.stakesColumn]}>
            {STAKES_CARDS.map((s) => (
              <View key={s.title} style={styles.stakesCard}>
                <Feather name={s.icon} size={24} color={COLORS.accent} style={styles.cardIcon} />
                <Text style={styles.stakesCardTitle}>{s.title}</Text>
                <Text style={styles.stakesCardDesc}>{s.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 10. Final CTA */}
        <View style={[styles.section, styles.finalCta]}>
          <Text style={styles.finalCtaHeadline}>
            Bring Your Members Together on <Text style={styles.accentText}>MemberCore</Text>
          </Text>
          <Text style={styles.finalCtaSubhead}>
            Bring your members together in one place built just for them.
          </Text>
          <View style={[styles.ctaRow, isNarrow && styles.ctaColumn]}>
            <TouchableOpacity style={styles.primaryBtn} onPress={onGetStarted} activeOpacity={0.8}>
              <Text style={styles.primaryBtnText}>Start Free</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={onSignIn} activeOpacity={0.8}>
              <Text style={styles.secondaryBtnText}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 11. Footer */}
        <View style={styles.footer}>
          <View style={styles.footerLeft}>
            <View style={styles.logoBoxSmall}>
              <Text style={styles.logoMSmall}>M</Text>
            </View>
            <Text style={styles.footerCopy}>MemberCore © 2026</Text>
          </View>
          <View style={styles.footerRight}>
            <Pressable onPress={() => {}}><Text style={styles.footerLink}>Terms</Text></Pressable>
            <Pressable onPress={() => {}}><Text style={styles.footerLink}>Privacy</Text></Pressable>
            <Pressable onPress={() => {}}><Text style={styles.footerLink}>Who It&apos;s For</Text></Pressable>
            <Pressable onPress={() => {}}><Text style={styles.footerLink}>Contact</Text></Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 48 },
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 14,
    backgroundColor: 'rgba(10,10,15,0.85)',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  navLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoM: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  logoText: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  navCenter: { flexDirection: 'row', gap: 24 },
  navLink: { fontSize: 14, color: COLORS.muted },
  getStartedBtn: {
    backgroundColor: COLORS.accent,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  getStartedBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  section: { paddingHorizontal: 24, paddingVertical: 40 },
  hero: { paddingTop: 32, alignItems: 'center' },
  heroHeadline: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 8,
    lineHeight: 36,
  },
  accentText: { color: COLORS.accent },
  heroSubhead: {
    fontSize: 16,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
    maxWidth: 480,
  },
  ctaRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  ctaColumn: { flexDirection: 'column', width: '100%' },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.accent,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  primaryBtnText: { color: COLORS.text, fontSize: 16, fontWeight: '600' },
  secondaryBtn: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  secondaryBtnText: { color: COLORS.text, fontSize: 16 },
  trustRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 20, marginBottom: 32 },
  trustItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  trustLabel: { fontSize: 14, color: COLORS.muted },
  heroImgWrap: { width: '100%', alignItems: 'center', marginTop: 8 },
  heroImg: { width: '100%', maxWidth: 400, height: 220, borderRadius: 16 },
  placeholderImg: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
  },
  twoCol: { flexDirection: 'row', gap: 32, alignItems: 'flex-start' },
  twoColStack: { flexDirection: 'column' },
  twoColText: { flex: 1, minWidth: 0 },
  twoColImg: { flex: 0.4, minWidth: 200 },
  sideImg: { width: '100%', aspectRatio: 1, maxHeight: 320 },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
  },
  sectionDesc: {
    fontSize: 15,
    color: COLORS.muted,
    lineHeight: 22,
    marginBottom: 20,
  },
  grid2x2: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  problemCard: {
    width: '47%',
    minWidth: 140,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 16,
  },
  cardIcon: { marginBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  cardDesc: { fontSize: 14, color: COLORS.muted, lineHeight: 20 },
  italicLine: { fontSize: 14, fontStyle: 'italic', color: COLORS.muted, marginTop: 16 },
  valuePropsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16 },
  valuePropBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: `${COLORS.accent}20`,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  valuePropLabel: { fontSize: 13, color: COLORS.text },
  closingLine: { fontSize: 15, color: COLORS.text, marginTop: 16, fontWeight: '500' },
  stepsRow: { flexDirection: 'row', gap: 16, marginBottom: 24 },
  stepsColumn: { flexDirection: 'column' },
  stepCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  stepNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  stepNumberText: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  stepTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 8, textAlign: 'center' },
  stepDesc: { fontSize: 14, color: COLORS.muted, lineHeight: 20, textAlign: 'center' },
  planImgWrap: { alignItems: 'center', marginBottom: 24 },
  planImg: { width: 200, height: 360, borderRadius: 12 },
  ctaCenter: { alignSelf: 'center' },
  featureGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 24 },
  featureCard: {
    width: '30%',
    minWidth: 160,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 16,
  },
  featureCardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  featureCardDesc: { fontSize: 14, color: COLORS.muted, lineHeight: 20 },
  featureImg: { width: '100%', height: 200, borderRadius: 12 },
  audienceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  audienceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '48%',
    minWidth: 160,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 14,
  },
  audienceLabel: { fontSize: 14, color: COLORS.text, flex: 1 },
  pricingRow: { flexDirection: 'row', gap: 16 },
  pricingColumn: { flexDirection: 'column' },
  pricingCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 20,
    position: 'relative',
  },
  pricingCardPro: { borderColor: COLORS.accent, borderWidth: 2 },
  popularBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: COLORS.accent,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  popularBadgeText: { fontSize: 12, fontWeight: '700', color: COLORS.text },
  pricingTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  pricingPrice: { fontSize: 24, fontWeight: '700', color: COLORS.text },
  pricingPeriod: { fontSize: 14, fontWeight: '400', color: COLORS.muted },
  pricingItem: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  pricingItemText: { fontSize: 14, color: COLORS.text },
  outlineBtn: {
    marginTop: 20,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  outlineBtnText: { fontSize: 16, color: COLORS.text },
  stakesRow: { flexDirection: 'row', gap: 16 },
  stakesColumn: { flexDirection: 'column' },
  stakesCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 20,
  },
  stakesCardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  stakesCardDesc: { fontSize: 14, color: COLORS.muted, lineHeight: 20 },
  finalCta: { alignItems: 'center', paddingVertical: 48 },
  finalCtaHeadline: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 12,
  },
  finalCtaSubhead: { fontSize: 16, color: COLORS.muted, marginBottom: 24, textAlign: 'center' },
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
  logoBoxSmall: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoMSmall: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  footerCopy: { fontSize: 13, color: COLORS.muted },
  footerRight: { flexDirection: 'row', gap: 20 },
  footerLink: { fontSize: 13, color: COLORS.muted },
})
