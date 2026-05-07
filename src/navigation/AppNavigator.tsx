import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AuthStack from './AuthStack';
import MainTabs from './MainTabs';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

interface AppNavigatorProps {
  isAuthenticated: boolean;
}

export default function AppNavigator({ isAuthenticated }: AppNavigatorProps) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <Stack.Group>
          <Stack.Screen name="Main" component={MainTabs} />
        </Stack.Group>
      ) : (
        <Stack.Screen name="Auth" component={AuthStack} />
      )}
    </Stack.Navigator>
  );
}
