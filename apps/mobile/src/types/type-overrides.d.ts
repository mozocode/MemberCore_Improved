import type React from 'react'

// Temporary compatibility overrides for upstream type package mismatch
// in the current Expo/RN/React versions used by this app.
declare module 'react-native' {
  interface FlatListProps<ItemT> {
    [key: string]: any
    contentContainerStyle?: any
    pagingEnabled?: boolean
    scrollEventThrottle?: number
    refreshControl?: React.ReactElement | null
  }

  interface SectionListProps<ItemT, SectionT = any> {
    [key: string]: any
    contentContainerStyle?: any
    refreshControl?: React.ReactElement | null
  }
}

declare module 'react-native-gesture-handler' {
  interface GestureHandlerRootViewProps {
    children?: React.ReactNode
  }
}

declare module '@react-navigation/stack' {
  interface StackNavigationOptions {
    [key: string]: any
    contentStyle?: any
  }
}
