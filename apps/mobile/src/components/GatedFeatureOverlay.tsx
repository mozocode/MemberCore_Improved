import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import {
  BILLING_INACTIVE_MESSAGE,
  BILLING_MANAGED_ON_WEB_MESSAGE,
} from '@membercore/core'
import { colors, spacing, fontSizes, radii } from '../theme'

interface Props {
  /** If true, show the overlay blocking the feature. */
  blocked: boolean
  /** Optional custom message. Defaults to App Store-compliant inactive message. */
  message?: string
  children: React.ReactNode
}

/**
 * Wraps a feature screen/section and shows a dimmed overlay with an
 * App Store-compliant message when the organization's subscription is inactive.
 *
 * CRITICAL: This component must NEVER contain:
 *   - Purchase CTAs ("Upgrade now", "Subscribe here", "Buy Pro")
 *   - External purchase links
 *   - Pricing information
 *
 * It only informs the user that the feature is managed on the website.
 */
export function GatedFeatureOverlay({ blocked, message, children }: Props) {
  if (!blocked) {
    return <>{children}</>
  }

  return (
    <View style={styles.container}>
      <View style={styles.dimmedContent} pointerEvents="none">
        {children}
      </View>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Feature Unavailable</Text>
          <Text style={styles.message}>
            {message || BILLING_INACTIVE_MESSAGE}
          </Text>
          <View style={styles.divider} />
          <Text style={styles.subtext}>{BILLING_MANAGED_ON_WEB_MESSAGE}</Text>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, position: 'relative' },
  dimmedContent: { flex: 1, opacity: 0.3 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  title: {
    color: colors.text,
    fontSize: fontSizes.lg,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  message: {
    color: colors.textSecondary,
    fontSize: fontSizes.md,
    textAlign: 'center',
    lineHeight: 22,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    width: '100%',
    marginVertical: spacing.lg,
  },
  subtext: {
    color: colors.textMuted,
    fontSize: fontSizes.sm,
    textAlign: 'center',
  },
})
