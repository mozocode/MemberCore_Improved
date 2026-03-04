import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { BILLING_MANAGED_ON_WEB_MESSAGE } from '@membercore/core'
import { useAuth } from '../contexts/AuthContext'
import { useBillingGate } from '../hooks/useBillingGate'
import type { OrgTabScreenProps } from '../navigation/types'
import { colors, spacing, fontSizes, radii } from '../theme'

export function MoreScreen({ route }: OrgTabScreenProps<'More'>) {
  const { orgId } = route.params
  const { user, signout } = useAuth()
  const { billing, isActive } = useBillingGate(orgId)

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signout },
    ])
  }

  const planLabel = billing?.plan === 'pro' ? 'Pro' : 'Free'
  const statusColor = isActive ? colors.success : colors.danger

  return (
    <View style={styles.container}>
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(user?.name || '?')[0].toUpperCase()}</Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.name}>{user?.name}</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>
      </View>

      {/* Subscription status — read-only, no purchase CTAs */}
      <View style={styles.billingCard}>
        <View style={styles.billingRow}>
          <Text style={styles.billingLabel}>Plan</Text>
          <Text style={styles.billingValue}>{planLabel}</Text>
        </View>
        <View style={styles.billingRow}>
          <Text style={styles.billingLabel}>Status</Text>
          <Text style={[styles.billingValue, { color: statusColor }]}>
            {isActive ? 'Active' : 'Inactive'}
          </Text>
        </View>
        <View style={styles.billingDivider} />
        <Text style={styles.billingNote}>{BILLING_MANAGED_ON_WEB_MESSAGE}</Text>
      </View>

      <View style={styles.section}>
        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuText}>Polls</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuText}>Documents</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem}>
          <Text style={styles.menuText}>Settings</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.lg },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.lg,
  },
  avatarText: { color: colors.white, fontSize: fontSizes.xl, fontWeight: '700' },
  profileInfo: { flex: 1 },
  name: { color: colors.text, fontSize: fontSizes.lg, fontWeight: '600' },
  email: { color: colors.textSecondary, fontSize: fontSizes.sm, marginTop: 2 },
  billingCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.lg,
  },
  billingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  billingLabel: { color: colors.textSecondary, fontSize: fontSizes.sm },
  billingValue: { color: colors.text, fontSize: fontSizes.md, fontWeight: '600' },
  billingDivider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  billingNote: { color: colors.textMuted, fontSize: fontSizes.xs, textAlign: 'center' },
  section: { marginTop: spacing.xl },
  menuItem: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  menuText: { color: colors.text, fontSize: fontSizes.md },
  signOutBtn: {
    backgroundColor: colors.danger,
    borderRadius: radii.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.xxl,
  },
  signOutText: { color: colors.white, fontSize: fontSizes.md, fontWeight: '600' },
})
