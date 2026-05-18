import React from 'react';
import { StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import HomeScreen from '../screens/home/HomeScreen';
import GroupStack from './GroupStack';
import ActivityScreen from '../screens/activity/ActivityScreen';
import ProfileStack from './ProfileStack';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_ICONS: Record<string, { focused: string; default: string }> = {
  Home: { focused: 'home', default: 'home-outline' },
  Groups: { focused: 'people', default: 'people-outline' },
  Activity: { focused: 'receipt', default: 'receipt-outline' },
  Profile: { focused: 'person', default: 'person-outline' },
};

export default function MainTabs() {
  const { theme } = useTheme();
  const { colors } = theme;
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 8);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: route.name !== 'Groups',
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.textPrimary,
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700', fontSize: 18, color: colors.textPrimary },
        tabBarIcon: ({ focused, color, size }) => {
          const icons = TAB_ICONS[route.name];
          const iconName = focused ? icons.focused : icons.default;
          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.borderLight,
          borderTopWidth: 1,
          height: 52 + bottomInset,
          paddingBottom: bottomInset,
          paddingTop: 4,
        },
        tabBarLabelStyle: styles.tabBarLabel,
      })}>
      <Tab.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
      <Tab.Screen
        name="Groups"
        component={GroupStack}
        options={{ headerShown: false, popToTopOnBlur: true }}
      />
      <Tab.Screen name="Activity" component={ActivityScreen} />
      <Tab.Screen
        name="Profile"
        component={ProfileStack}
        options={{ headerShown: false, popToTopOnBlur: true }}
        listeners={({ navigation }) => ({
          tabPress: () => {
            navigation.navigate('Profile', { screen: 'ProfileMain' });
          },
        })}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
});
