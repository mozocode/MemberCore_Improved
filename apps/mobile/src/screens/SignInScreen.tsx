import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useAuth } from '../contexts/AuthContext'
import type { AuthStackParamList } from '../navigation/types'
import { colors, spacing, fontSizes, radii } from '../theme'

type Nav = NativeStackNavigationProp<AuthStackParamList, 'SignIn'>

export function SignInScreen() {
  const nav = useNavigation<Nav>()
  const { signin } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSignIn = async () => {
    if (!email.trim() || !password) return
    setLoading(true)
    try {
      await signin(email.trim(), password)
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      const status = err?.response?.status
      const msg = err?.message || 'Unknown error'
      Alert.alert(
        'Sign In Failed',
        detail
          ? `${detail} (${status})`
          : `${msg}\n\nURL: ${err?.config?.baseURL || 'N/A'}${err?.config?.url || ''}`,
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <Text style={styles.title}>MemberCore</Text>
        <Text style={styles.subtitle}>Sign in to your account</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSignIn}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.buttonText}>Sign In</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => nav.navigate('SignUp')} style={styles.linkRow}>
          <Text style={styles.linkText}>
            Don't have an account? <Text style={styles.linkBold}>Sign Up</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xl },
  title: { fontSize: fontSizes.title, fontWeight: '700', color: colors.text, textAlign: 'center', marginBottom: spacing.xs },
  subtitle: { fontSize: fontSizes.md, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xxl },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    fontSize: fontSizes.md,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.white, fontSize: fontSizes.lg, fontWeight: '600' },
  linkRow: { marginTop: spacing.xl, alignItems: 'center' },
  linkText: { color: colors.textSecondary, fontSize: fontSizes.md },
  linkBold: { color: colors.primary, fontWeight: '600' },
})
