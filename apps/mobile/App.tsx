import React from 'react'
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

const prefix = Linking.createURL('/')

const linking: LinkingOptions<any> = {
  prefixes: [prefix, 'membercore://'],
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

const RootView = GestureHandlerRootView as React.ComponentType<
  React.PropsWithChildren<{ style?: { flex?: number } }>
>

export default function App() {
  return (
    <RootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer ref={navigationRef} theme={navTheme} linking={linking}>
          <AuthProvider>
            <StatusBar style="light" />
            <NetworkBanner />
            <RootNavigator />
          </AuthProvider>
        </NavigationContainer>
      </SafeAreaProvider>
    </RootView>
  )
}
