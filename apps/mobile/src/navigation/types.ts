import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { DrawerScreenProps } from '@react-navigation/drawer'
import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native'

export type RootStackParamList = {
  Auth: undefined
  OrgSelector: undefined
  OrgTabs: NavigatorScreenParams<OrgDrawerParamList> & { orgId: string }
  EventDetail: { orgId: string; eventId: string }
  SettingsPersonal: { orgId: string }
  SettingsOrg: { orgId: string }
  SettingsMyTickets: { orgId: string }
  SettingsEventOptions: { orgId: string }
  SettingsAnalytics: { orgId: string }
  SettingsPayments: { orgId: string }
  SettingsDocuments: { orgId: string }
  SettingsDirectory: { orgId: string }
  SettingsAffiliate: { orgId: string }
  SettingsVideoTutorials: { orgId: string }
}

export type OrgDrawerParamList = {
  Home: { orgId: string }
  Chat: { orgId: string }
  Messages: { orgId: string }
  Calendar: { orgId: string }
  Directory: { orgId: string }
  Members: { orgId: string }
  Dues: { orgId: string }
  Documents: { orgId: string }
  Polls: { orgId: string }
  More: { orgId: string }
  Settings: { orgId: string }
}

export type AuthStackParamList = {
  Home: undefined
  SignIn: undefined
  SignUp: undefined
  WildApricotCompare: undefined
  Nonprofits: undefined
  SportsClubs: undefined
}

export type RootStackScreenProps<T extends keyof RootStackParamList> =
  NativeStackScreenProps<RootStackParamList, T>

export type OrgDrawerScreenProps<T extends keyof OrgDrawerParamList> =
  CompositeScreenProps<
    DrawerScreenProps<OrgDrawerParamList, T>,
    NativeStackScreenProps<RootStackParamList>
  >

// Keep backward compat alias
export type OrgTabParamList = OrgDrawerParamList
export type OrgTabScreenProps<T extends keyof OrgDrawerParamList> = OrgDrawerScreenProps<T>
