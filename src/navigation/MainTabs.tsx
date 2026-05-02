import React from 'react';
import { StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/Ionicons';
import { colors } from '../components/theme';
import HomeScreen from '../screens/home/HomeScreen';
import GroupStack from './GroupStack';
import ActivityScreen from '../screens/activity/ActivityScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_ICONS: Record<string, { focused: string; default: string }> = {
  Home: { focused: 'home', default: 'home-outline' },
  Groups: { focused: 'people', default: 'people-outline' },
  Activity: { focused: 'receipt', default: 'receipt-outline' },
  Profile: { focused: 'person', default: 'person-outline' },
};

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: route.name !== 'Groups',
        headerStyle: { backgroundColor: colors.surface },
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700', fontSize: 18 },
        tabBarIcon: ({ focused, color, size }) => {
          const icons = TAB_ICONS[route.name];
          const iconName = focused ? icons.focused : icons.default;
          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabBarLabel,
      })}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen
        name="Groups"
        component={GroupStack}
        options={{ headerShown: false, unmountOnBlur: true }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            // Force reset to the root of the Groups stack when the tab is pressed
            navigation.navigate('Groups', { screen: 'GroupList' });
          },
        })}
      />
      <Tab.Screen name="Activity" component={ActivityScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.borderLight,
    borderTopWidth: 1,
    height: 60,
    paddingBottom: 8,
    paddingTop: 4,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
});
