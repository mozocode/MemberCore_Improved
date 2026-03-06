import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'

class LayerBoundary extends React.Component<
  { name: string; children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <View style={diag.root}>
          <Text style={diag.title}>Crash in: {this.props.name}</Text>
          <ScrollView style={diag.scroll}>
            <Text style={diag.msg}>{this.state.error.message}</Text>
            <Text style={diag.stack}>{this.state.error.stack}</Text>
          </ScrollView>
        </View>
      )
    }
    return this.props.children
  }
}

const diag = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#ffffff', justifyContent: 'center', padding: 24, paddingTop: 80 },
  title: { color: '#ef4444', fontSize: 20, fontWeight: '700', marginBottom: 12 },
  scroll: { flex: 1 },
  msg: { color: '#000000', fontSize: 15, marginBottom: 8 },
  stack: { color: '#666666', fontSize: 11 },
  status: { color: '#000000', fontSize: 16, marginBottom: 6 },
  ok: { color: '#22c55e', fontSize: 16, fontWeight: '600', marginBottom: 6 },
  loading: { color: '#3b82f6', fontSize: 16, marginBottom: 6 },
})

function FullApp() {
  const { StatusBar } = require('expo-status-bar')
  const { GestureHandlerRootView } = require('react-native-gesture-handler')
  const { NavigationContainer, DarkTheme } = require('@react-navigation/native')
  const { SafeAreaProvider } = require('react-native-safe-area-context')
  const Linking = require('expo-linking')
  const { AuthProvider } = require('./src/contexts/AuthContext')
  const { RootNavigator } = require('./src/navigation/RootNavigator')
  const { navigationRef } = require('./src/navigation/navigationRef')
  const { NetworkBanner } = require('./src/components/NetworkBanner')
  const { colors } = require('./src/theme')

  const prefix = Linking.createURL('/')

  const linking = {
    prefixes: [prefix, 'membercore://'],
    async getInitialURL() {
      const url = await Promise.race([
        Linking.getInitialURL(),
        new Promise<string | null>((r) => setTimeout(() => r(null), 2000)),
      ])
      return url
    },
    subscribe: Linking.addEventListener,
    config: {
      screens: {
        Auth: {
          path: '',
          screens: {
            Home: '',
            SignIn: 'signin',
            SignUp: 'signup',
            WildApricotCompare: 'compare/wild-apricot',
            Nonprofits: 'nonprofits',
            SportsClubs: 'sports-clubs',
            Support: 'support',
          },
        },
        OrgSelector: 'orgs',
        OrgTabs: {
          path: 'org/:orgId',
          screens: {
            Home: 'home',
            Chat: 'chat',
            Messages: 'messages',
            Calendar: 'calendar',
            Members: 'members',
            Dues: 'dues',
            Documents: 'documents',
            Polls: 'polls',
            Settings: 'settings',
            Directory: 'directory',
          },
        },
        EventDetail: 'org/:orgId/event/:eventId',
      },
    },
  }

  const navTheme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      background: colors.background,
      card: colors.background,
      border: colors.border,
      text: colors.text,
      primary: colors.primary,
    },
  }

  return (
    <LayerBoundary name="GestureHandler">
      <GestureHandlerRootView style={{ flex: 1 }}>
        <LayerBoundary name="SafeAreaProvider">
          <SafeAreaProvider>
            <LayerBoundary name="NavigationContainer">
              <NavigationContainer
                ref={navigationRef}
                theme={navTheme}
                linking={linking}
                fallback={
                  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={{ color: '#ffffff', marginTop: 12 }}>Loading navigation...</Text>
                  </View>
                }
              >
                <LayerBoundary name="AuthProvider">
                  <AuthProvider>
                    <StatusBar style="light" />
                    <LayerBoundary name="NetworkBanner">
                      <NetworkBanner />
                    </LayerBoundary>
                    <LayerBoundary name="RootNavigator">
                      <RootNavigator />
                    </LayerBoundary>
                  </AuthProvider>
                </LayerBoundary>
              </NavigationContainer>
            </LayerBoundary>
          </SafeAreaProvider>
        </LayerBoundary>
      </GestureHandlerRootView>
    </LayerBoundary>
  )
}

export default function App() {
  const [phase, setPhase] = useState<'check' | 'ready' | 'error'>('check')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    try {
      require('react-native-gesture-handler')
      require('react-native-safe-area-context')
      require('@react-navigation/native')
      require('expo-linking')
      require('expo-status-bar')
      setPhase('ready')
    } catch (e: any) {
      setErrorMsg(e?.message ?? String(e))
      setPhase('error')
    }
  }, [])

  if (phase === 'check') {
    return (
      <View style={diag.root}>
        <Text style={diag.loading}>Checking modules...</Text>
      </View>
    )
  }

  if (phase === 'error') {
    return (
      <View style={diag.root}>
        <Text style={diag.title}>Module load failed</Text>
        <Text style={diag.msg}>{errorMsg}</Text>
      </View>
    )
  }

  return (
    <LayerBoundary name="FullApp">
      <FullApp />
    </LayerBoundary>
  )
}
