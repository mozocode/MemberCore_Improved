import React from 'react'
import { TouchableOpacity, StyleSheet } from 'react-native'
import { createDrawerNavigator } from '@react-navigation/drawer'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { Feather } from '@expo/vector-icons'
import { DrawerContent } from '../components/DrawerContent'
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
import type { OrgDrawerParamList, RootStackParamList } from './types'

const Drawer = createDrawerNavigator<OrgDrawerParamList>()

type Props = NativeStackScreenProps<RootStackParamList, 'OrgTabs'>

function HamburgerButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.hamburger}
      activeOpacity={0.7}
    >
      <Feather name="menu" size={28} color="#ffffff" />
    </TouchableOpacity>
  )
}

export function OrgDrawerNavigator({ route }: Props) {
  const { orgId } = route.params

  return (
    <Drawer.Navigator
      drawerContent={(props) => <DrawerContent {...props} />}
      screenOptions={({ navigation }) => ({
        drawerType: 'front',
        drawerStyle: {
          backgroundColor: '#000000',
          width: 288,
        },
        headerStyle: {
          backgroundColor: '#000000',
          borderBottomWidth: 1,
          borderBottomColor: '#27272a',
          elevation: 0,
          shadowOpacity: 0,
          height: 100,
        } as any,
        headerTintColor: '#ffffff',
        headerTitleStyle: {
          fontSize: 20,
          fontWeight: '700',
          color: '#ffffff',
        },
        headerShadowVisible: false,
        headerLeftContainerStyle: { paddingLeft: 8 },
        headerLeft: () => (
          <HamburgerButton onPress={() => navigation.openDrawer()} />
        ),
        sceneContainerStyle: { backgroundColor: '#000000' },
      })}
    >
      <Drawer.Screen
        name="Home"
        component={OrgHomeScreen}
        initialParams={{ orgId }}
        options={{
          headerShown: false,
          drawerItemStyle: { display: 'none' },
        }}
      />
      <Drawer.Screen
        name="Chat"
        component={ChatScreen}
        initialParams={{ orgId }}
        options={{
          title: 'Chat',
        }}
      />
      <Drawer.Screen
        name="Messages"
        component={MessagesScreen}
        initialParams={{ orgId }}
        options={{
          title: 'Messages',
        }}
      />
      <Drawer.Screen
        name="Calendar"
        component={EventsScreen}
        initialParams={{ orgId }}
        options={{
          title: 'Calendar',
        }}
      />
      <Drawer.Screen
        name="Directory"
        component={DirectoryScreen}
        initialParams={{ orgId }}
        options={{
          title: 'Directory',
        }}
      />
      <Drawer.Screen
        name="Members"
        component={MembersScreen}
        initialParams={{ orgId }}
        options={{
          title: 'Members',
        }}
      />
      <Drawer.Screen
        name="Dues"
        component={DuesScreen}
        initialParams={{ orgId }}
        options={{
          title: 'Dues',
        }}
      />
      <Drawer.Screen
        name="Documents"
        component={DocumentsScreen}
        initialParams={{ orgId }}
        options={{
          title: 'Documents',
        }}
      />
      <Drawer.Screen
        name="Polls"
        component={PollsScreen}
        initialParams={{ orgId }}
        options={{
          title: 'Polls',
        }}
      />
      <Drawer.Screen
        name="Settings"
        component={SettingsScreen}
        initialParams={{ orgId }}
        options={{
          title: 'Settings',
        }}
      />
    </Drawer.Navigator>
  )
}

const styles = StyleSheet.create({
  hamburger: {
    padding: 12,
    marginLeft: 0,
    minHeight: 48,
    minWidth: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
})
