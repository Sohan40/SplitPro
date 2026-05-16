import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import type { ThemeColors } from '../components/theme';
import { useTheme } from '../context/ThemeContext';
import ProfileScreen from '../screens/profile/ProfileScreen';
import MyQrCodeScreen from '../screens/profile/MyQrCodeScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';
import UpgradeScreen from '../screens/upgrade/UpgradeScreen';
import type { ProfileStackParamList } from './types';

const Stack = createNativeStackNavigator<ProfileStackParamList>();
type ProfileNavigation = NativeStackNavigationProp<ProfileStackParamList, 'ProfileMain'>;

type SettingsHeaderButtonProps = {
  colors: ThemeColors;
  navigation: ProfileNavigation;
};

function SettingsHeaderButton({ colors, navigation }: SettingsHeaderButtonProps) {
  return (
    <TouchableOpacity
      accessibilityLabel="Open settings"
      accessibilityRole="button"
      activeOpacity={0.75}
      onPress={() => navigation.navigate('Settings')}
      style={[
        styles.settingsButton,
        {
          backgroundColor: colors.primaryLight,
          borderColor: colors.borderLight,
        },
      ]}>
      <Icon name="settings-outline" size={20} color={colors.primary} />
    </TouchableOpacity>
  );
}

export default function ProfileStack() {
  const { theme } = useTheme();
  const { colors } = theme;

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { fontWeight: '600', color: colors.textPrimary },
        headerShadowVisible: false,
        animation: 'none',
      }}>
      <Stack.Screen
        name="ProfileMain"
        component={ProfileScreen}
        options={({ navigation }) => ({
          title: 'Profile',
          // React Navigation requires headerRight to be a render callback.
          // eslint-disable-next-line react/no-unstable-nested-components
          headerRight: () => (
            <SettingsHeaderButton colors={colors} navigation={navigation} />
          ),
        })}
      />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
      <Stack.Screen name="MyQrCode" component={MyQrCodeScreen} options={{ title: 'My QR Code' }} />
      <Stack.Screen name="UpgradeAi" component={UpgradeScreen} options={{ title: 'SplitPro AI' }} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  settingsButton: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
});
