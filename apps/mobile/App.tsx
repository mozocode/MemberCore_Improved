import React, { useState, useEffect, useRef, useCallback } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'

const logs: string[] = []
function log(msg: string) {
  const ts = new Date().toISOString().slice(11, 23)
  logs.push(`[${ts}] ${msg}`)
}

log('Module evaluation started')

function DebugScreen({ entries, showApp }: { entries: string[]; showApp: boolean }) {
  if (showApp) return null
  return (
    <View style={d.root}>
      <Text style={d.title}>MemberCore Diagnostics</Text>
      <Text style={d.subtitle}>Build 22 — on-screen debug log</Text>
      <ScrollView style={d.scroll} contentContainerStyle={{ paddingBottom: 40 }}>
        {entries.map((e, i) => (
          <Text key={i} style={d.entry}>{e}</Text>
        ))}
      </ScrollView>
    </View>
  )
}

const d = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1a1a2e', paddingTop: 70, paddingHorizontal: 16 },
  title: { color: '#00ff88', fontSize: 20, fontWeight: '800', marginBottom: 4 },
  subtitle: { color: '#888', fontSize: 13, marginBottom: 16 },
  scroll: { flex: 1 },
  entry: { color: '#e0e0e0', fontSize: 12, fontFamily: 'Courier', lineHeight: 18 },
})

export default function App() {
  const [entries, setEntries] = useState<string[]>([...logs])
  const [showApp, setShowApp] = useState(false)
  const [appError, setAppError] = useState<string | null>(null)
  const FullAppRef = useRef<React.ComponentType | null>(null)
  const timer = useRef<ReturnType<typeof setInterval>>()

  const addLog = useCallback((msg: string) => {
    log(msg)
    setEntries([...logs])
  }, [])

  useEffect(() => {
    timer.current = setInterval(() => setEntries([...logs]), 500)
    return () => clearInterval(timer.current)
  }, [])

  useEffect(() => {
    const run = async () => {
      try {
        addLog('Checking GestureHandler...')
        require('react-native-gesture-handler')
        addLog('  OK')

        addLog('Checking SafeAreaContext...')
        require('react-native-safe-area-context')
        addLog('  OK')

        addLog('Checking ReactNavigation...')
        require('@react-navigation/native')
        addLog('  OK')

        addLog('Checking expo-linking...')
        require('expo-linking')
        addLog('  OK')

        addLog('Checking expo-status-bar...')
        require('expo-status-bar')
        addLog('  OK')

        addLog('Checking @membercore/services...')
        require('@membercore/services')
        addLog('  OK')

        addLog('Checking AsyncStorage...')
        require('@react-native-async-storage/async-storage')
        addLog('  OK')

        addLog('Checking theme...')
        const { colors } = require('./src/theme')
        addLog(`  OK (bg=${colors.background})`)

        addLog('Checking AuthContext...')
        require('./src/contexts/AuthContext')
        addLog('  OK')

        addLog('Checking NavigationRef...')
        require('./src/navigation/navigationRef')
        addLog('  OK')

        addLog('Checking NetworkBanner...')
        require('./src/components/NetworkBanner')
        addLog('  OK')

        addLog('Checking RootNavigator...')
        require('./src/navigation/RootNavigator')
        addLog('  OK')

        addLog('All modules loaded. Building full app in 3s...')
        await new Promise((r) => setTimeout(r, 3000))

        addLog('Constructing full app component...')
        const { GestureHandlerRootView } = require('react-native-gesture-handler')
        const { NavigationContainer, DarkTheme } = require('@react-navigation/native')
        const { SafeAreaProvider } = require('react-native-safe-area-context')
        const Linking = require('expo-linking')
        const { StatusBar } = require('expo-status-bar')
        const { AuthProvider } = require('./src/contexts/AuthContext')
        const { RootNavigator } = require('./src/navigation/RootNavigator')
        const { navigationRef } = require('./src/navigation/navigationRef')
        const { NetworkBanner } = require('./src/components/NetworkBanner')

        const prefix = Linking.createURL('/')
        addLog(`Linking prefix: ${prefix}`)

        addLog('Testing Linking.getInitialURL...')
        const initUrl = await Promise.race([
          Linking.getInitialURL(),
          new Promise<string | null>((r) => setTimeout(() => r('__timeout__'), 3000)),
        ])
        addLog(`  Initial URL: ${initUrl ?? 'null'}`)

        const navTheme = {
          ...DarkTheme,
          colors: { ...DarkTheme.colors, background: colors.background, card: colors.background, border: colors.border, text: colors.text, primary: colors.primary },
        }

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
              Auth: { path: '', screens: { Home: '', SignIn: 'signin', SignUp: 'signup', WildApricotCompare: 'compare/wild-apricot', Nonprofits: 'nonprofits', SportsClubs: 'sports-clubs', Support: 'support' } },
              OrgSelector: 'orgs',
              OrgTabs: { path: 'org/:orgId', screens: { Home: 'home', Chat: 'chat', Messages: 'messages', Calendar: 'calendar', Members: 'members', Dues: 'dues', Documents: 'documents', Polls: 'polls', Settings: 'settings', Directory: 'directory' } },
              EventDetail: 'org/:orgId/event/:eventId',
            },
          },
        }

        function WrappedApp() {
          addLog('WrappedApp render called')
          return (
            <GestureHandlerRootView style={{ flex: 1 }}>
              <SafeAreaProvider>
                <NavigationContainer
                  ref={navigationRef}
                  theme={navTheme}
                  linking={linking}
                  onReady={() => addLog('NavigationContainer ready')}
                  fallback={
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' }}>
                      <Text style={{ color: '#000', fontSize: 18 }}>Navigation loading...</Text>
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
          )
        }

        addLog('Switching to full app NOW')
        FullAppRef.current = WrappedApp
        setShowApp(true)
      } catch (e: any) {
        addLog(`ERROR: ${e?.message ?? String(e)}`)
        addLog(e?.stack ?? '')
        setAppError(e?.message ?? String(e))
      }
    }
    run()
  }, [addLog])

  if (showApp && FullAppRef.current) {
    const FullApp = FullAppRef.current
    return (
      <ErrorBoundary onError={(msg) => { addLog(`RENDER ERROR: ${msg}`); setShowApp(false); setAppError(msg) }}>
        <FullApp />
      </ErrorBoundary>
    )
  }

  return <DebugScreen entries={entries} showApp={false} />
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode; onError?: (msg: string) => void },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  componentDidCatch(error: Error) {
    this.props.onError?.(error.message)
  }
  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, backgroundColor: '#1a1a2e', justifyContent: 'center', padding: 24, paddingTop: 80 }}>
          <Text style={{ color: '#ff4444', fontSize: 20, fontWeight: '700', marginBottom: 12 }}>Render Crash</Text>
          <ScrollView>
            <Text style={{ color: '#fff', fontSize: 14, marginBottom: 8 }}>{this.state.error.message}</Text>
            <Text style={{ color: '#888', fontSize: 11 }}>{this.state.error.stack}</Text>
          </ScrollView>
        </View>
      )
    }
    return this.props.children
  }
}
