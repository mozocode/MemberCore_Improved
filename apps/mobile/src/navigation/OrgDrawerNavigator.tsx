import React from 'react'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Feather } from '@expo/vector-icons'
import { OrgHomeScreen } from '../screens/OrgHomeScreen'
import { ChatScreen } from '../screens/ChatScreen'
import { MessagesScreen } from '../screens/MessagesScreen'
import { EventsScreen } from '../screens/EventsScreen'
import { DirectoryScreen } from '../screens/DirectoryScreen'
import { MembersScreen } from '../screens/MembersScreen'
import { DuesScreen } from '../screens/DuesScreen'
import { DocumentsScreen } from '../screens/DocumentsScreen'
import { PollsScreen } from '../screens/PollsScreen'
import { SettingsScreen } from '../screens/SettingsScreen'
import { MoreScreen } from '../screens/MoreScreen'
import type { OrgDrawerParamList, RootStackParamList } from './types'
import { colors } from '../theme'

type Props = NativeStackScreenProps<RootStackParamList, 'OrgTabs'>

type MoreStackParamList = {
  MoreRoot: { orgId: string }
  Messages: { orgId: string }
  Directory: { orgId: string }
  Dues: { orgId: string }
  Documents: { orgId: string }
  Polls: { orgId: string }
  Settings: { orgId: string }
}

const Tab = createBottomTabNavigator<OrgDrawerParamList>()
const MoreStack = createNativeStackNavigator<MoreStackParamList>()

const screenOptions = {
  headerStyle: { backgroundColor: '#000000', borderBottomWidth: 1, borderBottomColor: '#27272a' },
  headerTintColor: '#ffffff',
  headerTitleStyle: { fontSize: 20, fontWeight: '700' as const, color: '#ffffff' },
  contentStyle: { backgroundColor: '#000000' },
}

function MoreStackScreen({ route }: Props) {
  const orgId = route.params.orgId
  return (
    <MoreStack.Navigator screenOptions={screenOptions}>
      <MoreStack.Screen
        name="MoreRoot"
        component={MoreScreen}
        initialParams={{ orgId }}
        options={{ title: 'More' }}
      />
      <MoreStack.Screen name="Messages" component={MessagesScreen} options={{ title: 'Messages' }} />
      <MoreStack.Screen name="Directory" component={DirectoryScreen} options={{ title: 'Directory' }} />
      <MoreStack.Screen name="Dues" component={DuesScreen} options={{ title: 'Dues' }} />
      <MoreStack.Screen name="Documents" component={DocumentsScreen} options={{ title: 'Documents' }} />
      <MoreStack.Screen name="Polls" component={PollsScreen} options={{ title: 'Polls' }} />
      <MoreStack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
    </MoreStack.Navigator>
  )
}

export function OrgDrawerNavigator({ route }: Props) {
  const { orgId } = route.params

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: '#09090b', borderTopColor: '#27272a' },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: '#71717a',
      }}
    >
      <Tab.Screen
        name="Home"
        component={OrgHomeScreen}
        initialParams={{ orgId }}
        options={{ tabBarLabel: 'Home', tabBarIcon: ({ color, size }) => <Feather name="home" size={size} color={color} /> }}
      />
      <Tab.Screen
        name="Chat"
        component={ChatScreen}
        initialParams={{ orgId }}
        options={{ tabBarLabel: 'Chat', tabBarIcon: ({ color, size }) => <Feather name="message-square" size={size} color={color} /> }}
      />
      <Tab.Screen
        name="Calendar"
        component={EventsScreen}
        initialParams={{ orgId }}
        options={{ tabBarLabel: 'Calendar', tabBarIcon: ({ color, size }) => <Feather name="calendar" size={size} color={color} /> }}
      />
      <Tab.Screen
        name="Members"
        component={MembersScreen}
        initialParams={{ orgId }}
        options={{ tabBarLabel: 'Members', tabBarIcon: ({ color, size }) => <Feather name="users" size={size} color={color} /> }}
      />
      <Tab.Screen
        name="More"
        component={MoreStackScreen as any}
        initialParams={{ orgId }}
        options={{ tabBarLabel: 'More', tabBarIcon: ({ color, size }) => <Feather name="menu" size={size} color={color} /> }}
      />
    </Tab.Navigator>
  )
}
