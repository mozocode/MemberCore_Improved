import React, { useCallback, useState, useEffect } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useAuth } from '../contexts/AuthContext'
import { usePushNotifications } from '../hooks/usePushNotifications'
import { AuthStack } from './AuthStack'
import { OnboardingScreen } from '../screens/OnboardingScreen'
import { OrgSelectorScreen } from '../screens/OrgSelectorScreen'
import { ONBOARDING_SEEN_KEY } from '../constants/onboarding'
import { OrgDrawerNavigator } from './OrgDrawerNavigator'
import { EventDetailScreen } from '../screens/EventDetailScreen'
import { SettingsPersonalScreen } from '../screens/settings/SettingsPersonalScreen'
import { SettingsOrgScreen } from '../screens/settings/SettingsOrgScreen'
import { SettingsMyTicketsScreen } from '../screens/settings/SettingsMyTicketsScreen'
import { SettingsEventOptionsScreen } from '../screens/settings/SettingsEventOptionsScreen'
import { SettingsAnalyticsScreen } from '../screens/settings/SettingsAnalyticsScreen'
import { SettingsPaymentsScreen } from '../screens/settings/SettingsPaymentsScreen'
import { SettingsDocumentsScreen } from '../screens/settings/SettingsDocumentsScreen'
import { SettingsDirectoryScreen } from '../screens/settings/SettingsDirectoryScreen'
import { SettingsAffiliateScreen } from '../screens/settings/SettingsAffiliateScreen'
import { SettingsVideoTutorialsScreen } from '../screens/settings/SettingsVideoTutorialsScreen'
import type { RootStackParamList } from './types'
import { colors } from '../theme'
import { ActivityIndicator, View, TouchableOpacity, Text, StyleSheet } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useNavigation } from '@react-navigation/native'
import { navigationRef } from './navigationRef'

const Stack = createNativeStackNavigator<RootStackParamList>()

function BackButton() {
  const nav = useNavigation()
  return (
    <TouchableOpacity
      onPress={() => nav.goBack()}
      style={backStyles.btn}
      activeOpacity={0.7}
    >
      <Feather name="chevron-left" size={26} color="#ffffff" />
      <Text style={backStyles.label}>Back</Text>
    </TouchableOpacity>
  )
}

const backStyles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: -8,
    paddingRight: 8,
    minHeight: 44,
  },
  label: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '400',
  },
})

const settingsScreenOptions = {
  headerStyle: { backgroundColor: '#000000', height: 100 } as const,
  headerTintColor: '#ffffff',
  headerTitleStyle: { fontSize: 20, fontWeight: '700' as const, color: '#ffffff' },
  headerShadowVisible: false,
  headerBackTitleVisible: false,
  headerLeft: () => <BackButton />,
  contentStyle: { backgroundColor: '#000000' },
}

export function RootNavigator() {
  const { user, loading } = useAuth()
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(null)

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_SEEN_KEY).then((value) => {
      setHasSeenOnboarding(value === 'true')
    })
  }, [])

  const finishOnboarding = useCallback(() => {
    AsyncStorage.setItem(ONBOARDING_SEEN_KEY, 'true')
    setHasSeenOnboarding(true)
  }, [])

  const handleNotificationTap = useCallback((data: Record<string, string>) => {
    if (!navigationRef.isReady()) return
    const { type, org_id, event_id, channel_id, conversation_id } = data
    if (!org_id) return

    switch (type) {
      case 'event':
        if (event_id) {
          navigationRef.navigate('EventDetail', { orgId: org_id, eventId: event_id })
        }
        break
      case 'chat':
      case 'channel_message':
        navigationRef.navigate('OrgTabs', { orgId: org_id, screen: 'Chat', params: { orgId: org_id } })
        break
      case 'dm':
      case 'direct_message':
        navigationRef.navigate('OrgTabs', { orgId: org_id, screen: 'Messages', params: { orgId: org_id } })
        break
      case 'poll':
        navigationRef.navigate('OrgTabs', { orgId: org_id, screen: 'Polls', params: { orgId: org_id } })
        break
      case 'dues':
        navigationRef.navigate('OrgTabs', { orgId: org_id, screen: 'Dues', params: { orgId: org_id } })
        break
      default:
        navigationRef.navigate('OrgTabs', { orgId: org_id, screen: 'Home', params: { orgId: org_id } })
        break
    }
  }, [])

  usePushNotifications(user?.id, handleNotificationTap)

  if (hasSeenOnboarding === null || loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  if (!hasSeenOnboarding) {
    return <OnboardingScreen onComplete={finishOnboarding} />
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      {!user ? (
        <Stack.Screen name="Auth" component={AuthStack} options={{ headerShown: false }} />
      ) : (
        <>
          <Stack.Screen
            name="OrgSelector"
            component={OrgSelectorScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="OrgTabs"
            component={OrgDrawerNavigator}
            options={{ headerShown: false }}
          />
          <Stack.Screen name="EventDetail" component={EventDetailScreen} options={{ ...settingsScreenOptions, title: 'Event Detail' }} />
          <Stack.Screen name="SettingsPersonal" component={SettingsPersonalScreen} options={{ ...settingsScreenOptions, title: 'Personal Settings' }} />
          <Stack.Screen name="SettingsOrg" component={SettingsOrgScreen} options={{ ...settingsScreenOptions, title: 'Organization Settings' }} />
          <Stack.Screen name="SettingsMyTickets" component={SettingsMyTicketsScreen} options={{ ...settingsScreenOptions, title: 'My Tickets' }} />
          <Stack.Screen name="SettingsEventOptions" component={SettingsEventOptionsScreen} options={{ ...settingsScreenOptions, title: 'Event Options' }} />
          <Stack.Screen name="SettingsAnalytics" component={SettingsAnalyticsScreen} options={{ ...settingsScreenOptions, title: 'Analytics Dashboard' }} />
          <Stack.Screen name="SettingsPayments" component={SettingsPaymentsScreen} options={{ ...settingsScreenOptions, title: 'Payment Settings' }} />
          <Stack.Screen name="SettingsDocuments" component={SettingsDocumentsScreen} options={{ ...settingsScreenOptions, title: 'Document Settings' }} />
          <Stack.Screen name="SettingsDirectory" component={SettingsDirectoryScreen} options={{ ...settingsScreenOptions, title: 'Directory Settings' }} />
          <Stack.Screen name="SettingsAffiliate" component={SettingsAffiliateScreen} options={{ ...settingsScreenOptions, title: 'Affiliate Settings' }} />
          <Stack.Screen name="SettingsVideoTutorials" component={SettingsVideoTutorialsScreen} options={{ ...settingsScreenOptions, title: 'Video Tutorials' }} />
        </>
      )}
    </Stack.Navigator>
  )
}
