import React from 'react'
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { NavigationContainer, DarkTheme, LinkingOptions } from '@react-navigation/native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import * as Linking from 'expo-linking'
import { AuthProvider } from './src/contexts/AuthContext'
import { RootNavigator } from './src/navigation/RootNavigator'
import { navigationRef } from './src/navigation/navigationRef'
import { NetworkBanner } from './src/components/NetworkBanner'
import { colors } from './src/theme'

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <View style={ebStyles.root}>
          <Text style={ebStyles.title}>Something went wrong</Text>
          <ScrollView style={ebStyles.scroll}>
            <Text style={ebStyles.msg}>{this.state.error.message}</Text>
            <Text style={ebStyles.stack}>{this.state.error.stack}</Text>
          </ScrollView>
        </View>
      )
    }
    return this.props.children
  }
}

const ebStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#09090b', justifyContent: 'center', padding: 24, paddingTop: 80 },
  title: { color: '#ef4444', fontSize: 22, fontWeight: '700', marginBottom: 12 },
  scroll: { flex: 1 },
  msg: { color: '#ffffff', fontSize: 15, marginBottom: 8 },
  stack: { color: '#a1a1aa', fontSize: 12 },
})

const prefix = Linking.createURL('/')

const linking: LinkingOptions<any> = {
  prefixes: [prefix, 'membercore://'],
  async getInitialURL() {
    const url = await Promise.race([
      Linking.getInitialURL(),
      new Promise<string | null>((r) => setTimeout(() => r(null), 2000)),
    ])
    return url
  },
  subscribe(listener: (url: string) => void) {
    const sub = Linking.addEventListener('url', (e: { url: string }) => listener(e.url))
    return () => sub.remove()
  },
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

export default function App() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <NavigationContainer
            ref={navigationRef}
            theme={navTheme}
            linking={linking}
            fallback={
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            }
          >
            <AuthProvider>
              <StatusBar style="light" />
              <NetworkBanner />
              <RootNavigator />
            </AuthProvider>
          </NavigationContainer>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  )
}
