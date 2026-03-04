import React, { useState, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  TouchableOpacity,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, spacing, fontSizes, radii } from '../theme'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

const SLIDES = [
  {
    id: '1',
    icon: 'users' as const,
    title: 'One platform for your members',
    subtitle: 'Chat, events, documents, and more — all in one place. No more scattered group chats or lost updates.',
  },
  {
    id: '2',
    icon: 'shield' as const,
    title: 'Private and under your control',
    subtitle: 'Your data stays yours. No ads, no tracking, no algorithms. You choose what’s visible and to whom.',
  },
  {
    id: '3',
    icon: 'calendar' as const,
    title: 'Events that get attended',
    subtitle: 'Create events, track RSVPs, and send reminders. Keep everyone on the same page.',
  },
  {
    id: '4',
    icon: 'zap' as const,
    title: 'Get started in minutes',
    subtitle: 'Create or join an organization, invite your people, and start managing your community the right way.',
  },
]

interface OnboardingScreenProps {
  onComplete: () => void
}

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const insets = useSafeAreaInsets()
  const [index, setIndex] = useState(0)
  const listRef = useRef<FlatList>(null)

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH)
    if (i !== index && i >= 0 && i < SLIDES.length) setIndex(i)
  }

  const onSkip = () => onComplete()
  const onNext = () => {
    if (index < SLIDES.length - 1) {
      listRef.current?.scrollToOffset({ offset: (index + 1) * SCREEN_WIDTH, animated: true })
    } else {
      onComplete()
    }
  }

  const renderSlide = ({ item }: { item: typeof SLIDES[0] }) => (
    <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
      <View style={styles.iconWrap}>
        <Feather name={item.icon} size={64} color={colors.primary} />
      </View>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.subtitle}>{item.subtitle}</Text>
    </View>
  )

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <FlatList
        ref={listRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        onScroll={onScroll}
        scrollEventThrottle={16}
      />

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === index && styles.dotActive]}
            />
          ))}
        </View>
        <View style={styles.buttons}>
          <TouchableOpacity onPress={onSkip} style={styles.skipBtn} activeOpacity={0.7}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onNext} style={styles.nextBtn} activeOpacity={0.7}>
            <Text style={styles.nextText}>{index === SLIDES.length - 1 ? 'Get started' : 'Next'}</Text>
            <Feather name="arrow-right" size={18} color={colors.white} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  slide: {
    flex: 1,
    paddingHorizontal: spacing.xxl,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 120,
  },
  iconWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xxl,
  },
  title: {
    fontSize: fontSizes.xxl,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  subtitle: {
    fontSize: fontSizes.md,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: spacing.md,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: spacing.xl,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 24,
  },
  buttons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skipBtn: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  skipText: {
    fontSize: fontSizes.md,
    color: colors.textMuted,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.md,
  },
  nextText: {
    fontSize: fontSizes.lg,
    fontWeight: '600',
    color: colors.white,
  },
})
