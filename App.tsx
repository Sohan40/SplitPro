import React from 'react';
import { StatusBar, ActivityIndicator, View } from 'react-native';
import {
  DarkTheme as NavigationDarkTheme,
  NavigationContainer,
  type Theme as NavigationTheme,
} from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { navigationRef } from './src/navigation/navigationRef';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { CurrencyProvider } from './src/context/CurrencyContext';
import { ErrorProvider } from './src/context/ErrorContext';
import { useNotificationHandler } from './src/hooks/useNotificationHandler';
import { configureGoogleSignIn } from './src/services/googleAuthService';

// Initialize Google Sign-In once at app startup
configureGoogleSignIn();

function Root() {
  const { user, loading } = useAuth();
  const { theme } = useTheme();
  const navigationTheme = React.useMemo<NavigationTheme>(
    () => ({
      ...NavigationDarkTheme,
      colors: {
        ...NavigationDarkTheme.colors,
        primary: theme.colors.primary,
        background: theme.colors.background,
        card: theme.colors.surface,
        text: theme.colors.textPrimary,
        border: theme.colors.border,
        notification: theme.colors.primary,
      },
    }),
    [theme.colors],
  );

  // Set up push notification handlers (foreground, background tap, quit-state tap)
  useNotificationHandler();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.surface }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar
        barStyle="light-content"
        backgroundColor={theme.colors.surface}
      />
      <NavigationContainer ref={navigationRef} theme={navigationTheme}>
        <AppNavigator isAuthenticated={!!user} />
      </NavigationContainer>
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <CurrencyProvider>
          <ErrorProvider>
            <AuthProvider>
              <Root />
            </AuthProvider>
          </ErrorProvider>
        </CurrencyProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
