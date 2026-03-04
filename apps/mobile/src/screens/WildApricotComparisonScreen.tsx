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
  accent: '#F97316',
  destructive: '#EF4444',
  text: '#FAFAFA',
  muted: '#8E8EA0',
  highlightRow: 'rgba(249,115,22,0.05)',
} as const

type Nav = NativeStackNavigationProp<AuthStackParamList, 'WildApricotCompare'>

const FEATURE_ROWS: { feature: string; mc: string; wa: string; highlight?: boolean }[] = [
  { feature: 'Total cost at 400 members', mc: '$97/month', wa: '~$190/month', highlight: true },
  { feature: 'Pricing model', mc: 'Flat rate, unlimited', wa: 'Per-contact scaling', highlight: true },
  { feature: 'Private group chat & DMs', mc: '✓', wa: '✗', highlight: true },
  { feature: 'Mobile-first design', mc: '✓', wa: '✗', highlight: true },
  { feature: 'Event calendar & RSVPs', mc: '✓', wa: '✓' },
  { feature: 'Document storage by role', mc: '✓', wa: 'Limited' },
  { feature: 'Dues & payments', mc: '✓', wa: 'Built-in (higher fees)' },
  { feature: 'Member directory & map', mc: '✓', wa: 'Basic directory' },
  { feature: 'No ads or tracking', mc: '✓', wa: '✗' },
  { feature: 'Admin controls', mc: '✓', wa: '✓' },
  { feature: 'Public event discovery', mc: 'Optional', wa: 'Limited' },
  { feature: 'Setup time', mc: 'Minutes', wa: 'Days to weeks' },
  { feature: 'Free trial', mc: '30 days, no card', wa: '30 days' },
]

const WHY_SWITCH = [
  {
    icon: 'dollar-sign' as const,
    title: 'Per-contact pricing punishes growth',
    desc: "Every new member makes your bill bigger. With MemberCore, it's $97/month flat — so you can grow without asking 'Can we afford more contacts?'",
  },
  {
    icon: 'message-square' as const,
    title: 'No built-in private communication',
    desc: "With Wild Apricot, you still need email + Facebook for real engagement. MemberCore gives you channels and DMs so member conversations actually happen in one place.",
  },
  {
    icon: 'zap' as const,
    title: 'Dated interface, slow setup',
    desc: "Members struggle to navigate Wild Apricot's UI. Admins spend hours configuring basic features instead of running programs and building engagement.",
  },
  {
    icon: 'shield' as const,
    title: 'Ads and tracking on lower tiers',
    desc: "Wild Apricot shows ads on your site unless you pay premium. MemberCore never shows ads or tracks your members — your association's brand stays clean.",
  },
]

const WHAT_YOU_GET = [
  { icon: 'users' as const, title: 'Unlimited members' },
  { icon: 'message-circle' as const, title: 'Private chat & channels' },
  { icon: 'calendar' as const, title: 'Events & RSVPs' },
  { icon: 'file-text' as const, title: 'Document storage' },
  { icon: 'map-pin' as const, title: 'Directory & map' },
  { icon: 'shield' as const, title: 'Privacy by default' },
]

export function WildApricotComparisonScreen() {
  const { width } = useWindowDimensions()
  const nav = useNavigation<Nav>()
  const isNarrow = width < 600
  const cardGap = 16

  const onStartTrial = () => nav.navigate('SignUp')
  const onSeePlatform = () => nav.navigate('SignIn')

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* 1. Hero */}
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>MEMBERCORE VS WILD APRICOT</Text>
        <Text style={styles.heroHeadline}>
          Stop Paying Wild Apricot More As Your{' '}
          <Text style={styles.heroHeadlineAccent}>Association Grows</Text>
        </Text>
        <Text style={styles.heroSubhead}>
          Small professional & trade associations use MemberCore to replace Wild Apricot&apos;s per-contact pricing with a flat $97/month for unlimited members, built-in private chat, events, and documents.
        </Text>
        <View style={[styles.ctaRow, isNarrow && styles.ctaColumn]}>
          <TouchableOpacity style={styles.primaryBtn} onPress={onStartTrial} activeOpacity={0.8}>
            <Text style={styles.primaryBtnText}>Start 30-Day Pro Trial (No Card)</Text>
            <Feather name="arrow-right" size={18} color={COLORS.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={onSeePlatform} activeOpacity={0.8}>
            <Text style={styles.secondaryBtnText}>See the Platform</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.riskReversal}>
          Move your association over in 30 days. If your next major event doesn&apos;t get at least 20% more RSVPs than your last comparable event, you don&apos;t pay for the first 3 months.
        </Text>
      </View>

      {/* 2. Pricing comparison */}
      <View style={[styles.section, isNarrow && styles.sectionNarrow]}>
        <View style={[styles.pricingRow, isNarrow && styles.pricingColumn]}>
          <View style={[styles.pricingCard, styles.pricingCardMC]}>
            <View style={styles.pricingCardAccent} />
            <Text style={styles.pricingTitle}>MemberCore Pro</Text>
            <Text style={styles.pricingPrice}>$97/month</Text>
            {['Unlimited members', 'Private chat & DMs', 'Events, docs, directory', 'No per-contact fees ever'].map((item, i) => (
              <View key={i} style={styles.pricingItem}>
                <Feather name="check" size={18} color={COLORS.accent} />
                <Text style={styles.pricingItemText}>{item}</Text>
              </View>
            ))}
          </View>
          <View style={[styles.pricingCard, styles.pricingCardWA]}>
            <Text style={styles.pricingTitle}>Wild Apricot</Text>
            <Text style={styles.pricingPrice}>$60–$360+/month</Text>
            {[
              { text: 'Price increases as you grow', check: false },
              { text: 'No built-in private chat', check: false },
              { text: 'Ads on free/lower tiers', check: false },
              { text: 'Events & basic directory', check: true },
            ].map((item, i) => (
              <View key={i} style={styles.pricingItem}>
                {item.check ? (
                  <Feather name="check" size={18} color={COLORS.accent} />
                ) : (
                  <Feather name="x" size={18} color={COLORS.destructive} />
                )}
                <Text style={styles.pricingItemText}>{item.text}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* 3. Why Small Associations Switch */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Why Small Associations Switch from <Text style={styles.accentText}>Wild Apricot</Text>
        </Text>
        <Text style={styles.sectionDesc}>
          Per-contact fees, missing chat, and dated tools push associations to look for a better fit.
        </Text>
        <View style={styles.grid2x2}>
          {WHY_SWITCH.map((item, i) => (
            <View key={i} style={styles.whyCard}>
              <Feather name={item.icon} size={24} color={COLORS.accent} style={styles.whyIcon} />
              <Text style={styles.whyTitle}>{item.title}</Text>
              <Text style={styles.whyDesc}>{item.desc}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* 4. Feature comparison table */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Feature-by-Feature <Text style={styles.accentText}>Comparison</Text>
        </Text>
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.tableCol1]}>Feature</Text>
            <Text style={[styles.tableHeaderCell, styles.tableCol2]}>MemberCore</Text>
            <Text style={[styles.tableHeaderCell, styles.tableCol3]}>Wild Apricot</Text>
          </View>
          {FEATURE_ROWS.map((item, idx) => (
            <View key={item.feature} style={[styles.tableRow, item.highlight && styles.tableRowHighlight]}>
              <Text style={[styles.tableCell, styles.tableCol1]}>{item.feature}</Text>
              <View style={[styles.tableCell, styles.tableCol2]}>
                {item.mc === '✓' ? (
                  <Feather name="check" size={16} color={COLORS.accent} />
                ) : (
                  <Text style={styles.tableCellText}>{item.mc}</Text>
                )}
              </View>
              <View style={[styles.tableCell, styles.tableCol3]}>
                {item.wa === '✗' ? (
                  <Feather name="x" size={16} color={COLORS.destructive} />
                ) : (
                  <Text style={styles.tableCellText}>{item.wa}</Text>
                )}
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* 5. What You Get When You Switch */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          What You Get When You <Text style={styles.accentText}>Switch</Text>
        </Text>
        <View style={styles.grid3x2}>
          {WHAT_YOU_GET.map((item, i) => (
            <View key={i} style={styles.whatCard}>
              <Feather name={item.icon} size={22} color={COLORS.accent} style={styles.whatIcon} />
              <Text style={styles.whatTitle}>{item.title}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* 6. Proof block */}
      <View style={styles.section}>
        <View style={[styles.card, styles.proofCard]}>
          <View style={styles.proofAccent} />
          <Feather name="trending-up" size={32} color={COLORS.accent} style={styles.proofIcon} />
          <Text style={styles.proofQuote}>
            After switching from Wild Apricot to MemberCore, our association cut our monthly software bill by 40% and increased RSVPs for our quarterly meeting by 27%.
          </Text>
          <Text style={styles.proofAttribution}>
            — Executive Director, Regional Professional Association
          </Text>
        </View>
      </View>

      {/* 7. Stay vs Switch */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          What Happens If You <Text style={styles.accentText}>Stay vs Switch</Text>
        </Text>
        <View style={[styles.staySwitchRow, isNarrow && styles.staySwitchColumn]}>
          <View style={styles.stayCard}>
            <Feather name="alert-triangle" size={28} color={COLORS.destructive} style={styles.stayIcon} />
            <Text style={styles.stayTitle}>Stay on Wild Apricot</Text>
            {[
              'Your bill keeps rising as you add members',
              'You still rely on email and Facebook for real communication',
              'Members see ads and a dated experience',
            ].map((line, i) => (
              <View key={i} style={styles.bulletRow}>
                <View style={styles.bulletRed} />
                <Text style={styles.bulletText}>{line}</Text>
              </View>
            ))}
          </View>
          <View style={[styles.card, styles.switchCard]}>
            <View style={styles.proofAccent} />
            <Feather name="star" size={28} color={COLORS.accent} style={styles.switchIcon} />
            <Text style={styles.stayTitle}>Switch to MemberCore</Text>
            {[
              'One flat $97/month no matter how many members',
              'Private channels and DMs built in',
              'No ads, no tracking — your brand stays clean',
            ].map((line, i) => (
              <View key={i} style={styles.bulletRow}>
                <Feather name="check" size={16} color={COLORS.accent} />
                <Text style={styles.bulletText}>{line}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* 8. Final CTA */}
      <View style={[styles.hero, styles.finalCta]}>
        <Text style={styles.heroHeadline}>
          Ready to Replace Wild Apricot with <Text style={styles.heroHeadlineAccent}>Something Better?</Text>
        </Text>
        <Text style={styles.heroSubhead}>
          Join small associations already running on MemberCore. Flat $97/month, unlimited members, 30-day trial — no card required.
        </Text>
        <View style={[styles.ctaRow, isNarrow && styles.ctaColumn]}>
          <TouchableOpacity style={styles.primaryBtn} onPress={onStartTrial} activeOpacity={0.8}>
            <Text style={styles.primaryBtnText}>Start 30-Day Pro Trial (No Card)</Text>
            <Feather name="arrow-right" size={18} color={COLORS.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={onSeePlatform} activeOpacity={0.8}>
            <Text style={styles.secondaryBtnText}>See the Platform</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingBottom: 48 },
  hero: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 32,
    alignItems: 'center',
  },
  heroLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: COLORS.accent,
    marginBottom: 12,
  },
  heroHeadline: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 8,
    lineHeight: 34,
  },
  heroHeadlineAccent: { color: COLORS.accent },
  heroSubhead: {
    fontSize: 16,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
    maxWidth: 480,
  },
  ctaRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
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
  riskReversal: {
    fontSize: 14,
    fontStyle: 'italic',
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  section: { paddingHorizontal: 24, paddingVertical: 32 },
  sectionNarrow: { paddingVertical: 24 },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  accentText: { color: COLORS.accent },
  sectionDesc: {
    fontSize: 15,
    color: COLORS.muted,
    lineHeight: 22,
    marginBottom: 20,
  },
  pricingRow: { flexDirection: 'row', gap: 16 },
  pricingColumn: { flexDirection: 'column' },
  pricingCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 20,
    minWidth: 0,
    position: 'relative',
    overflow: 'hidden',
  },
  pricingCardMC: { borderLeftWidth: 4, borderLeftColor: COLORS.accent },
  pricingCardWA: { opacity: 0.85 },
  pricingCardAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: COLORS.accent },
  pricingTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  pricingPrice: { fontSize: 24, fontWeight: '700', color: COLORS.text, marginBottom: 16 },
  pricingItem: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  pricingItemText: { fontSize: 14, color: COLORS.text },
  grid2x2: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  whyCard: {
    width: '48%',
    minWidth: 140,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 16,
  },
  whyIcon: { marginBottom: 10 },
  whyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text, marginBottom: 8 },
  whyDesc: { fontSize: 14, color: COLORS.muted, lineHeight: 20 },
  table: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: COLORS.border,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  tableHeaderCell: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  tableRowHighlight: { backgroundColor: COLORS.highlightRow },
  tableCell: { fontSize: 13, color: COLORS.text, justifyContent: 'center' },
  tableCellText: { fontSize: 13, color: COLORS.text },
  tableCol1: { flex: 1.8, minWidth: 0 },
  tableCol2: { flex: 1, minWidth: 0 },
  tableCol3: { flex: 1, minWidth: 0 },
  grid3x2: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  whatCard: {
    width: '31%',
    minWidth: 100,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  whatIcon: { marginBottom: 8 },
  whatTitle: { fontSize: 13, fontWeight: '600', color: COLORS.text, textAlign: 'center' },
  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 24,
    position: 'relative',
    overflow: 'hidden',
  },
  proofCard: { alignItems: 'center' },
  proofAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: COLORS.accent },
  proofIcon: { marginBottom: 16 },
  proofQuote: {
    fontSize: 18,
    fontStyle: 'italic',
    color: COLORS.text,
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 12,
  },
  proofAttribution: { fontSize: 14, color: COLORS.muted },
  staySwitchRow: { flexDirection: 'row', gap: 16 },
  staySwitchColumn: { flexDirection: 'column' },
  stayCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 20,
  },
  stayIcon: { marginBottom: 12 },
  stayTitle: { fontSize: 17, fontWeight: '700', color: COLORS.text, marginBottom: 12 },
  bulletRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  bulletRed: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.destructive },
  bulletText: { fontSize: 14, color: COLORS.text, flex: 1 },
  switchCard: { flex: 1 },
  switchIcon: { marginBottom: 12 },
  finalCta: { paddingTop: 24, paddingBottom: 48 },
})
