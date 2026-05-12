import React from 'react';
import { StatusBar, ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { navigationRef } from './src/navigation/navigationRef';
import { colors } from './src/components/theme';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ErrorProvider } from './src/context/ErrorContext';
import { useNotificationHandler } from './src/hooks/useNotificationHandler';
import { configureGoogleSignIn } from './src/services/googleAuthService';

// Initialize Google Sign-In once at app startup
configureGoogleSignIn();

function Root() {
  const { user, loading } = useAuth();

  // Set up push notification handlers (foreground, background tap, quit-state tap)
  useNotificationHandler();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <AppNavigator isAuthenticated={!!user} />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ErrorProvider>
        <AuthProvider>
          <StatusBar
            barStyle="dark-content"
            backgroundColor={colors.surface}
          />
          <Root />
        </AuthProvider>
      </ErrorProvider>
    </SafeAreaProvider>
  );
}