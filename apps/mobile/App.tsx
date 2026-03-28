import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { NavigationContainer, DarkTheme } from '@react-navigation/native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { AuthProvider } from './src/contexts/AuthContext'
import { RootNavigator } from './src/navigation/RootNavigator'
import { navigationRef } from './src/navigation/navigationRef'

export default function App() {
  const GHRoot = GestureHandlerRootView as any
  return (
    <GHRoot style={styles.root}>
      <AuthProvider>
        <NavigationContainer
          ref={navigationRef}
          theme={{
            ...DarkTheme,
            colors: {
              ...DarkTheme.colors,
              background: '#000000',
              card: '#000000',
            },
          }}
          fallback={
            <View style={styles.booting}>
              <Text style={styles.bootingText}>Loading MemberCore...</Text>
            </View>
          }
        >
          <StatusBar style="light" />
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
    </GHRoot>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  booting: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bootingText: { color: '#d1d5db', fontSize: 15 },
})
