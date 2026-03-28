import React from 'react'
import { createStackNavigator } from '@react-navigation/stack'
import { HomeScreen } from '../screens/HomeScreen'
import { SignInScreen } from '../screens/SignInScreen'
import { SignUpScreen } from '../screens/SignUpScreen'
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen'
import { WildApricotComparisonScreen } from '../screens/WildApricotComparisonScreen'
import { NonprofitScreen } from '../screens/NonprofitScreen'
import { SportsClubsScreen } from '../screens/SportsClubsScreen'
import { SupportScreen } from '../screens/SupportScreen'
import type { AuthStackParamList } from './types'
import { colors } from '../theme'

const Stack = createStackNavigator<AuthStackParamList>()

export function AuthStack() {
  return (
    <Stack.Navigator
      initialRouteName="SignIn"
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="SignIn" component={SignInScreen} options={{ headerShown: false }} />
      <Stack.Screen name="SignUp" component={SignUpScreen} options={{ title: 'Create Account' }} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: 'Forgot Password' }} />
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
