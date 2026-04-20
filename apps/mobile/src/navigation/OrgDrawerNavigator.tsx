import React from 'react'
import { Modal, TouchableOpacity, View, Text, StyleSheet, Image } from 'react-native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
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
import type { OrgDrawerParamList, RootStackParamList } from './types'
import { colors } from '../theme'
import { organizationService } from '@membercore/services'

type Props = NativeStackScreenProps<RootStackParamList, 'OrgTabs'>

const Tab = createBottomTabNavigator<OrgDrawerParamList>()

export function OrgDrawerNavigator({ route, navigation }: Props) {
  const { orgId } = route.params
  const [sidebarOpen, setSidebarOpen] = React.useState(false)
  const [orgName, setOrgName] = React.useState('')
  const [orgLogo, setOrgLogo] = React.useState<string | null>(null)

  React.useEffect(() => {
    organizationService
      .get(orgId)
      .then((org: any) => {
        setOrgName(org?.name ?? '')
        setOrgLogo(org?.logo ?? null)
      })
      .catch(() => {
        setOrgName('')
        setOrgLogo(null)
      })
  }, [orgId])

  const goToMenuItem = React.useCallback(
    (
      target:
        | 'Chat'
        | 'Messages'
        | 'Calendar'
        | 'Directory'
        | 'Members'
        | 'Dues'
        | 'Documents'
        | 'Polls'
        | 'Settings',
    ) => {
      setSidebarOpen(false)
      navigation.navigate('OrgTabs', { orgId, screen: target, params: { orgId } })
    },
    [navigation, orgId],
  )

  return (
    <>
      <Tab.Navigator
        initialRouteName="Chat"
        screenOptions={{
          headerShown: true,
          // Keep header pinned; never collapse/hide while content scrolls.
          headerHideOnScroll: false,
          headerTransparent: false,
          headerLargeTitle: false,
          headerStyle: {
            backgroundColor: '#000000',
            borderBottomWidth: 1,
            borderBottomColor: '#27272a',
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.35,
            shadowRadius: 6,
            elevation: 10,
            height: 96,
          },
          headerTitleStyle: {
            color: '#ffffff',
            fontSize: 22,
            fontWeight: '700' as const,
          },
          headerTitleAlign: 'left',
          headerTitleContainerStyle: {
            paddingBottom: 6,
          },
          headerLeftContainerStyle: {
            paddingLeft: 8,
            paddingBottom: 6,
          },
          headerRightContainerStyle: {
            paddingRight: 10,
            paddingBottom: 6,
          },
          headerTintColor: '#ffffff',
          headerLeft: () => (
            <TouchableOpacity
              style={styles.headerMenuBtn}
              onPress={() => setSidebarOpen(true)}
              activeOpacity={0.7}
            >
              <Feather name="menu" size={28} color="#ffffff" />
            </TouchableOpacity>
          ),
          tabBarStyle: { display: 'none' },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: '#71717a',
        }}
      >
        <Tab.Screen
          name="Chat"
          component={ChatScreen}
          initialParams={{ orgId }}
          options={{
            title: 'Chat',
            tabBarLabel: 'Chat',
            tabBarIcon: ({ color, size }) => (
              <Feather name="message-square" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Messages"
          component={MessagesScreen}
          initialParams={{ orgId }}
          options={{ title: 'Messages', tabBarButton: () => null }}
        />
        <Tab.Screen
          name="Calendar"
          component={EventsScreen}
          initialParams={{ orgId }}
          options={{
            title: 'Calendar',
            tabBarLabel: 'Calendar',
            tabBarIcon: ({ color, size }) => (
              <Feather name="calendar" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Directory"
          component={DirectoryScreen}
          initialParams={{ orgId }}
          options={{ title: 'Directory', tabBarButton: () => null }}
        />
        <Tab.Screen
          name="Members"
          component={MembersScreen}
          initialParams={{ orgId }}
          options={{
            title: 'Members',
            tabBarLabel: 'Members',
            tabBarIcon: ({ color, size }) => (
              <Feather name="users" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="Dues"
          component={DuesScreen}
          initialParams={{ orgId }}
          options={{ title: 'Dues', tabBarButton: () => null }}
        />
        <Tab.Screen
          name="Documents"
          component={DocumentsScreen}
          initialParams={{ orgId }}
          options={{ title: 'Documents', tabBarButton: () => null }}
        />
        <Tab.Screen
          name="Polls"
          component={PollsScreen}
          initialParams={{ orgId }}
          options={{ title: 'Polls', tabBarButton: () => null }}
        />
        <Tab.Screen
          name="Settings"
          component={SettingsScreen}
          initialParams={{ orgId }}
          options={{ title: 'Settings', tabBarButton: () => null }}
        />
        {/* Legacy hidden aliases kept for backward navigation compatibility */}
        <Tab.Screen
          name="Home"
          component={OrgHomeScreen}
          initialParams={{ orgId }}
          options={{ title: 'Home', tabBarButton: () => null }}
        />
        <Tab.Screen
          name="More"
          component={SettingsScreen as any}
          initialParams={{ orgId }}
          options={{ title: 'Settings', tabBarButton: () => null }}
        />
      </Tab.Navigator>

      <Modal
        visible={sidebarOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setSidebarOpen(false)}
      >
        <View style={styles.sidebarOverlay}>
          <View style={styles.sidebarPanel}>
            <View style={styles.sidebarTopRow}>
              <TouchableOpacity
                onPress={() => {
                  setSidebarOpen(false)
                  navigation.navigate('OrgSelector')
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.sidebarBackText}>Back to Organizations</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setSidebarOpen(false)}
                style={styles.sidebarCloseBtn}
              >
                <Feather name="x" size={28} color="#a1a1aa" />
              </TouchableOpacity>
            </View>

            <View style={styles.orgRow}>
              {orgLogo ? (
                <Image source={{ uri: orgLogo }} style={styles.orgLogo} />
              ) : (
                <View style={styles.orgLogoFallback}>
                  <Text style={styles.orgLogoLetter}>
                    {(orgName || '?').charAt(0)}
                  </Text>
                </View>
              )}
              <Text style={styles.orgName}>{orgName || 'Organization'}</Text>
              <TouchableOpacity
                style={styles.orgHomeBtn}
                onPress={() => {
                  setSidebarOpen(false)
                  navigation.navigate('OrgSelector')
                }}
                activeOpacity={0.7}
              >
                <Feather name="home" size={20} color="#ffffff" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.menuItem} onPress={() => goToMenuItem('Chat')}>
              <Feather name="message-square" size={24} color="#ef4444" />
              <Text style={styles.menuItemActive}>Chat</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => goToMenuItem('Messages')}>
              <Feather name="mail" size={24} color="#ef4444" />
              <Text style={styles.menuItemText}>Messages</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => goToMenuItem('Calendar')}>
              <Feather name="calendar" size={24} color="#ef4444" />
              <Text style={styles.menuItemText}>Calendar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => goToMenuItem('Directory')}>
              <Feather name="map-pin" size={24} color="#ef4444" />
              <Text style={styles.menuItemText}>Directory</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => goToMenuItem('Members')}>
              <Feather name="users" size={24} color="#ef4444" />
              <Text style={styles.menuItemText}>Members</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => goToMenuItem('Dues')}>
              <Feather name="dollar-sign" size={24} color="#ef4444" />
              <Text style={styles.menuItemText}>Dues</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => goToMenuItem('Documents')}>
              <Feather name="file-text" size={24} color="#ef4444" />
              <Text style={styles.menuItemText}>Documents</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => goToMenuItem('Polls')}>
              <Feather name="bar-chart-2" size={24} color="#ef4444" />
              <Text style={styles.menuItemText}>Polls</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => goToMenuItem('Settings')}>
              <Feather name="settings" size={24} color="#ef4444" />
              <Text style={styles.menuItemText}>Settings</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.sidebarBackdrop}
            activeOpacity={1}
            onPress={() => setSidebarOpen(false)}
          />
        </View>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  headerMenuBtn: {
    marginLeft: 2,
    width: 52,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sidebarOverlay: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  sidebarBackdrop: {
    flex: 1,
  },
  sidebarPanel: {
    width: '82%',
    maxWidth: 360,
    backgroundColor: '#000000',
    borderRightWidth: 1,
    borderRightColor: '#27272a',
    paddingTop: 14,
  },
  sidebarTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  sidebarBackText: { color: '#fafafa', fontSize: 16, fontWeight: '500' as const },
  sidebarCloseBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  orgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  orgLogo: { width: 42, height: 42, borderRadius: 21 },
  orgLogoFallback: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#18181b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  orgLogoLetter: { color: '#fafafa', fontSize: 18, fontWeight: '700' as const },
  orgName: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700' as const,
    flex: 1,
    marginRight: 8,
  },
  orgHomeBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    marginLeft: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 18,
    minHeight: 54,
  },
  menuItemActive: { color: '#fafafa', fontSize: 16, fontWeight: '600' as const },
  menuItemText: { color: '#d4d4d8', fontSize: 16, fontWeight: '500' as const },
})
