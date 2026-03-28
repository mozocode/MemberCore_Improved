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
import { useAuth } from '../contexts/AuthContext'
import { colors, spacing, fontSizes, radii } from '../theme'

export function SignUpScreen() {
  const { signup } = useAuth()
  const [name, setName] = useState('')
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

  const handleSignUp = async () => {
    if (!name.trim() || !email.trim() || !password) return
    setLoading(true)
    try {
      await signup(name.trim(), email.trim(), password)
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      const message = Array.isArray(detail)
        ? detail.map((d: any) => d?.msg ?? String(d)).filter(Boolean).join('. ') || 'Invalid input'
        : (typeof detail === 'string' ? detail : 'Something went wrong')
      Alert.alert('Sign Up Failed', message)
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
        <TextInput
          style={styles.input}
          placeholder="Full Name"
          placeholderTextColor={colors.textMuted}
          value={name}
          onChangeText={setName}
        />
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
          onPress={handleSignUp}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.buttonText}>Create Account</Text>
          )}
        </TouchableOpacity>

        {googleEnabled ? <GoogleSignUpButton googleConfig={googleConfig} /> : null}
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xl },
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
})

function GoogleSignUpButton({
  googleConfig,
}: {
  googleConfig: {
    webClientId?: string
    iosClientId?: string
    androidClientId?: string
    expoClientId?: string
  }
}) {
  const { signupWithGoogle } = useAuth()
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
        Alert.alert('Google Sign Up Failed', 'No Google ID token received.')
        setGoogleLoading(false)
        return
      }
      try {
        await signupWithGoogle(idToken)
      } catch (err: any) {
        const detail = err?.response?.data?.detail
        Alert.alert('Google Sign Up Failed', typeof detail === 'string' ? detail : 'Please try again.')
      } finally {
        setGoogleLoading(false)
      }
    }
    handleGoogleResponse()
  }, [response, signupWithGoogle])

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
          Alert.alert('Google Sign Up Failed', 'Unable to start Google sign-up.')
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
