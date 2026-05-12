import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useTheme, type ThemePreference } from '../../context/ThemeContext';
import { spacing } from '../../components/theme';
import GlassCard from '../../components/GlassCard';
import Icon from 'react-native-vector-icons/Ionicons';
import type { SettingsScreenProps } from '../../navigation/types';

const APPEARANCE_OPTIONS: { value: ThemePreference; label: string; icon: string }[] = [
  { value: 'light', label: 'Light', icon: 'sunny-outline' },
  { value: 'dark', label: 'Dark', icon: 'moon-outline' },
  { value: 'system', label: 'System', icon: 'phone-portrait-outline' },
];

export default function SettingsScreen(_props: SettingsScreenProps) {
  const { theme, preference, setPreference } = useTheme();
  const { colors } = theme;

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
                !isLast && { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
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
