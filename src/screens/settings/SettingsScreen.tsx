import React from 'react';
import { Alert, View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTheme, type ThemePreference } from '../../context/ThemeContext';
import { spacing, type ThemeColors } from '../../components/theme';
import GlassCard from '../../components/GlassCard';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../../context/AuthContext';
import { useCurrency } from '../../context/CurrencyContext';
import { groupService } from '../../services/groupService';
import { userService } from '../../services/userService';
import { auth } from '../../services/firebase';
import { calculateUserSummary, hasOutstandingBalances } from '../../utils/balanceCalculator';

const APPEARANCE_OPTIONS: { value: ThemePreference; label: string; icon: string }[] = [
  { value: 'light', label: 'Light', icon: 'sunny-outline' },
  { value: 'dark', label: 'Dark', icon: 'moon-outline' },
  { value: 'system', label: 'System', icon: 'phone-portrait-outline' },
];

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const { theme, preference, setPreference, isDark } = useTheme();
  const { currency, options: currencyOptions, setCurrency, formatAmount } = useCurrency();
  const { colors } = theme;

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This action is irreversible. All your data will be permanently deleted. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!user) return;

            try {
              const groups = await groupService.getUserGroups(user.id);
              const latestSummary = calculateUserSummary(groups, user.id);

              if (hasOutstandingBalances(groups, user.id)) {
                const unsettledDetails: string[] = [];

                if (latestSummary.youOwe > 0.01) {
                  unsettledDetails.push(`you still owe ${formatAmount(latestSummary.youOwe)}`);
                }

                if (latestSummary.youAreOwed > 0.01) {
                  unsettledDetails.push(`you are still owed ${formatAmount(latestSummary.youAreOwed)}`);
                }

                Alert.alert(
                  'Settle Up Required',
                  `Please settle all balances before deleting your account. Right now ${unsettledDetails.join(' and ')}.`,
                );
                return;
              }

              await userService.deleteUser(user.id);
              await auth.currentUser?.delete();
            } catch (error: any) {
              console.error(error);
              if (error.code === 'auth/requires-recent-login') {
                Alert.alert(
                  'Authentication Required',
                  'For security reasons, please log out and log back in before deleting your account.',
                );
              } else {
                Alert.alert('Error', error.message || 'Failed to delete account.');
              }
            }
          },
        },
      ],
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      {/* Appearance Section */}
      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>APPEARANCE</Text>
      <GlassCard padding="none" style={styles.card}>
        {APPEARANCE_OPTIONS.map((opt, index) => {
          const isSelected = preference === opt.value;
          const isLast = index === APPEARANCE_OPTIONS.length - 1;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.optionRow,
                !isLast && styles.optionDivider,
                !isLast && { borderBottomColor: colors.borderLight },
              ]}
              activeOpacity={0.6}
              onPress={() => setPreference(opt.value)}
            >
              <View style={[styles.optionIcon, { backgroundColor: colors.primaryLight }]}>
                <Icon name={opt.icon} size={18} color={colors.primary} />
              </View>
              <Text style={[styles.optionLabel, { color: colors.textPrimary }]}>{opt.label}</Text>
              {isSelected && (
                <Icon name="checkmark-circle" size={22} color={colors.primary} />
              )}
            </TouchableOpacity>
          );
        })}
      </GlassCard>

      <Text style={[styles.hint, { color: colors.textTertiary }]}>
        System follows your device's appearance setting.
      </Text>

      {/* Currency Section */}
      <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: spacing.xxxl }]}>
        DEFAULT CURRENCY
      </Text>
      <GlassCard padding="none" style={styles.card}>
        {currencyOptions.map((opt, index) => {
          const isSelected = currency === opt.code;
          const isLast = index === currencyOptions.length - 1;
          return (
            <TouchableOpacity
              key={opt.code}
              style={[
                styles.optionRow,
                !isLast && styles.optionDivider,
                !isLast && { borderBottomColor: colors.borderLight },
              ]}
              activeOpacity={0.6}
              onPress={() => setCurrency(opt.code)}>
              <View style={[styles.optionIcon, { backgroundColor: colors.primaryLight }]}>
                <Text style={[styles.currencySymbol, { color: colors.primary }]}>{opt.symbol}</Text>
              </View>
              <View style={styles.optionCopy}>
                <Text style={[styles.optionLabel, { color: colors.textPrimary }]}>{opt.code}</Text>
                <Text style={[styles.optionDescription, { color: colors.textTertiary }]}>{opt.label}</Text>
              </View>
              {isSelected && (
                <Icon name="checkmark-circle" size={22} color={colors.primary} />
              )}
            </TouchableOpacity>
          );
        })}
      </GlassCard>
      <Text style={[styles.hint, { color: colors.textTertiary }]}>
        Used as the default when creating a new group. Existing group currencies cannot be changed.
      </Text>

      {/* Account Section */}
      <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: spacing.xxxl }]}>
        ACCOUNT
      </Text>
      <GlassCard padding="none" style={styles.card}>
        <AccountAction
          colors={colors}
          iconName="log-out-outline"
          iconTint={colors.warning}
          label="Logout"
          onPress={handleLogout}
          surface={isDark ? 'rgba(245,158,11,0.14)' : 'rgba(217,119,6,0.10)'}
          textColor={colors.warning}
        />
        <AccountAction
          colors={colors}
          iconName="trash-outline"
          iconTint={colors.owes}
          label="Delete Account"
          last
          onPress={handleDeleteAccount}
          surface={colors.owesLight}
          textColor={colors.owes}
        />
      </GlassCard>

      {/* About Section */}
      <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: spacing.xxxl }]}>
        ABOUT
      </Text>
      <GlassCard padding="none" style={styles.card}>
        <View style={styles.aboutRow}>
          <Text style={[styles.aboutLabel, { color: colors.textSecondary }]}>Version</Text>
          <Text style={[styles.aboutValue, { color: colors.textPrimary }]}>1.0.4</Text>
        </View>
      </GlassCard>
    </ScrollView>
  );
}

type AccountActionProps = {
  colors: ThemeColors;
  iconName: string;
  iconTint: string;
  label: string;
  onPress: () => void;
  surface: string;
  last?: boolean;
  textColor?: string;
};

function AccountAction({
  colors,
  iconName,
  iconTint,
  label,
  onPress,
  surface,
  last = false,
  textColor,
}: AccountActionProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.6}
      onPress={onPress}
      style={[
        styles.optionRow,
        !last && styles.optionDivider,
        !last && { borderBottomColor: colors.borderLight },
      ]}>
      <View style={[styles.optionIcon, { backgroundColor: surface }]}>
        <Icon name={iconName} size={18} color={iconTint} />
      </View>
      <Text style={[styles.optionLabel, { color: textColor || colors.textPrimary }]}>{label}</Text>
      <Icon name="chevron-forward" size={20} color={colors.textTertiary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.xl,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  card: {
    marginBottom: spacing.sm,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
  },
  optionDivider: {
    borderBottomWidth: 1,
  },
  optionIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  optionLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  optionCopy: {
    flex: 1,
  },
  optionDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  currencySymbol: {
    fontSize: 15,
    fontWeight: '800',
  },
  hint: {
    fontSize: 12,
    marginLeft: spacing.xs,
    marginTop: spacing.xs,
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
  },
  aboutLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  aboutValue: {
    fontSize: 15,
    fontWeight: '600',
  },
});
