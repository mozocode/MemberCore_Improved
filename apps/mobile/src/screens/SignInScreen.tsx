import React, { useState } from 'react'
import { useEffect } from 'react'
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
import * as WebBrowser from 'expo-web-browser'
import * as Google from 'expo-auth-session/providers/google'
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
  const googleConfig = {
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    expoClientId: process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID,
  }
  const googleEnabled = !!(googleConfig.webClientId || googleConfig.iosClientId || googleConfig.androidClientId || googleConfig.expoClientId)

  const handleSignIn = async () => {
    if (!email.trim() || !password) return
    setLoading(true)
    try {
      await signin(email.trim().toLowerCase(), password)
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
      behavior={Platform.OS === 'ios' ? 'height' : undefined}
      keyboardVerticalOffset={0}
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
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="password"
          textContentType="password"
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity onPress={() => nav.navigate('ForgotPassword')} style={styles.forgotRow}>
          <Text style={styles.forgotText}>Forgot password?</Text>
        </TouchableOpacity>

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

        {googleEnabled ? <GoogleSignInButton googleConfig={googleConfig} /> : null}

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
  googleButton: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.md,
  },
  googleButtonText: { color: colors.text, fontSize: fontSizes.md, fontWeight: '600' },
  forgotRow: { alignItems: 'flex-end', marginBottom: spacing.sm },
  forgotText: { color: colors.primary, fontSize: fontSizes.sm, fontWeight: '600' },
  linkRow: { marginTop: spacing.xl, alignItems: 'center' },
  linkText: { color: colors.textSecondary, fontSize: fontSizes.md },
  linkBold: { color: colors.primary, fontWeight: '600' },
})

function GoogleSignInButton({
  googleConfig,
}: {
  googleConfig: {
    webClientId?: string
    iosClientId?: string
    androidClientId?: string
    expoClientId?: string
  }
}) {
  const { signinWithGoogle } = useAuth()
  const [googleLoading, setGoogleLoading] = useState(false)
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest(googleConfig)

  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession()
  }, [])

  useEffect(() => {
    const handleGoogleResponse = async () => {
      if (response?.type !== 'success') return
      const idToken = response.params?.id_token || response.authentication?.idToken
      if (!idToken) {
        Alert.alert('Google Sign In Failed', 'No Google ID token received.')
        setGoogleLoading(false)
        return
      }
      try {
        await signinWithGoogle(idToken)
      } catch (err: any) {
        const detail = err?.response?.data?.detail
        Alert.alert('Google Sign In Failed', typeof detail === 'string' ? detail : 'Please try again.')
      } finally {
        setGoogleLoading(false)
      }
    }
    handleGoogleResponse()
  }, [response, signinWithGoogle])

  return (
    <TouchableOpacity
      style={[styles.googleButton, (googleLoading || !request) && styles.buttonDisabled]}
      onPress={async () => {
        setGoogleLoading(true)
        try {
          const result = await promptAsync()
          if (result.type !== 'success') setGoogleLoading(false)
        } catch {
          setGoogleLoading(false)
          Alert.alert('Google Sign In Failed', 'Unable to start Google sign-in.')
        }
      }}
      disabled={googleLoading || !request}
    >
      {googleLoading ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <Text style={styles.googleButtonText}>Continue with Google</Text>
      )}
    </TouchableOpacity>
  )
}
