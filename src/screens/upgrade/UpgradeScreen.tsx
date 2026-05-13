import React, { useMemo } from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Button from '../../components/Button';
import GlassCard from '../../components/GlassCard';
import { borderRadius, spacing, type ThemeColors, type ThemeTypography } from '../../components/theme';
import { useTheme } from '../../context/ThemeContext';
import type { UpgradeScreenProps } from '../../navigation/types';

export default function UpgradeScreen({ navigation }: UpgradeScreenProps) {
  const { theme, isDark } = useTheme();
  const { colors, typography } = theme;
  const styles = useMemo(() => createStyles(colors, typography), [colors, typography]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Icon name="sparkles-outline" size={28} color={colors.primary} />
          </View>
          <Text style={styles.title}>SplitPro AI</Text>
          <Text style={styles.subtitle}>AI summaries, budget suggestions, category insights, and group Q&A.</Text>
        </View>

        <GlassCard style={styles.priceCard}>
          <View style={styles.priceRow}>
            <View>
              <Text style={styles.priceTitle}>Monthly</Text>
              <Text style={styles.priceMeta}>Placeholder plan</Text>
            </View>
            <Text style={styles.price}>₹99/month</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.priceRow}>
            <View>
              <Text style={styles.priceTitle}>Yearly</Text>
              <Text style={styles.priceMeta}>Placeholder plan</Text>
            </View>
            <Text style={styles.price}>₹499/year</Text>
          </View>
        </GlassCard>

        <GlassCard style={styles.noticeCard}>
          <Icon name="shield-checkmark-outline" size={22} color={colors.primary} />
          <View style={styles.noticeCopy}>
            <Text style={styles.noticeTitle}>Coming soon</Text>
            <Text style={styles.noticeText}>Secure Google Play checkout will be added in a later phase.</Text>
          </View>
        </GlassCard>

        <Button title="Back" variant="secondary" onPress={() => navigation.goBack()} />
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: ThemeColors, typography: ThemeTypography) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.xl,
    paddingBottom: spacing.huge,
    gap: spacing.lg,
  },
  hero: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
  },
  title: {
    ...typography.heading1,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    textAlign: 'center',
  },
  priceCard: {
    gap: spacing.lg,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  priceTitle: {
    ...typography.bodyBold,
  },
  priceMeta: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  price: {
    ...typography.heading3,
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
  },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  noticeCopy: {
    flex: 1,
  },
  noticeTitle: {
    ...typography.bodyBold,
  },
  noticeText: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
});
