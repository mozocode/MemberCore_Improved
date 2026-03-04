import React from 'react'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { HomeScreen } from '../screens/HomeScreen'
import { SignInScreen } from '../screens/SignInScreen'
import { SignUpScreen } from '../screens/SignUpScreen'
import { WildApricotComparisonScreen } from '../screens/WildApricotComparisonScreen'
import { NonprofitScreen } from '../screens/NonprofitScreen'
import { SportsClubsScreen } from '../screens/SportsClubsScreen'
import { SupportScreen } from '../screens/SupportScreen'
import type { AuthStackParamList } from './types'
import { colors } from '../theme'

const Stack = createNativeStackNavigator<AuthStackParamList>()

export function AuthStack() {
  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '600' },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="SignIn" component={SignInScreen} options={{ headerShown: false }} />
      <Stack.Screen name="SignUp" component={SignUpScreen} options={{ title: 'Create Account' }} />
      <Stack.Screen
        name="WildApricotCompare"
        component={WildApricotComparisonScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Nonprofits"
        component={NonprofitScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="SportsClubs"
        component={SportsClubsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Support"
        component={SupportScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  )
}
