import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useCurrency } from '../context/CurrencyContext';
import { useTheme } from '../context/ThemeContext';
import { spacing, borderRadius } from './theme';

interface GlassBalanceCardProps {
  netBalance: number;
  totalOwes: number;
  totalOwed: number;
  negativeGroupCount: number;
  positiveGroupCount: number;
  onSettleUp: () => void;
  onAddExpense: () => void;
}

export default function GlassBalanceCard({
  netBalance,
  totalOwes,
  totalOwed,
  negativeGroupCount,
  positiveGroupCount,
  onSettleUp,
  onAddExpense,
}: GlassBalanceCardProps) {
  const { theme } = useTheme();
  const { formatAmount } = useCurrency();
  const { colors } = theme;
  const isPositive = netBalance >= 0;
  const primaryForeground = theme.dark ? colors.black : colors.white;

  const wrapperBg = theme.dark
    ? 'rgba(30,28,42,0.86)'
    : 'rgba(255,255,255,0.9)';
  const borderColor = theme.dark
    ? 'rgba(167,139,250,0.22)'
    : 'rgba(124,58,237,0.12)';
  const glowColor = isPositive
    ? (theme.dark ? 'rgba(52,211,153,0.16)' : 'rgba(5,150,105,0.08)')
    : (theme.dark ? 'rgba(239,68,68,0.12)' : 'rgba(220,38,38,0.06)');
  const secondaryGlow = theme.dark
    ? 'rgba(124,58,237,0.10)'
    : 'rgba(124,58,237,0.04)';
  const dividerColor = theme.dark
    ? 'rgba(167,139,250,0.2)'
    : 'rgba(124,58,237,0.12)';

  return (
    <View style={[styles.wrapper, { backgroundColor: wrapperBg, borderColor }]}>
      <View pointerEvents="none" style={[styles.glowPrimary, { backgroundColor: glowColor }]} />
      <View pointerEvents="none" style={[styles.glowSecondary, { backgroundColor: secondaryGlow }]} />

      <View style={styles.content}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Total Balance</Text>
        <Text style={[styles.amount, { color: isPositive ? colors.owed : colors.owes }]}>
          {formatAmount(netBalance)}
        </Text>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: colors.textPrimary }]}>{formatAmount(totalOwes)}</Text>
            <Text style={[styles.statLabel, { color: colors.owes }]}>
              you owe · {negativeGroupCount} groups
            </Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: dividerColor }]} />
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: colors.owed }]}>{formatAmount(totalOwed)}</Text>
            <Text style={[styles.statLabel, { color: colors.owed }]}>
              owed to you · {positiveGroupCount} groups
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={[styles.settleBtnGlass, { backgroundColor: colors.primary }]} onPress={onSettleUp} activeOpacity={0.8}>
            <Text style={[styles.settleBtnText, { color: primaryForeground }]}>Settle Up</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.addBtn, {
              backgroundColor: colors.primaryLight,
              borderColor: theme.dark ? 'rgba(167,139,250,0.25)' : 'rgba(124,58,237,0.15)',
            }]}
            onPress={onAddExpense}
            activeOpacity={0.8}
          >
            <Text style={[styles.addBtnText, { color: colors.primary }]}>Add Expense</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    minHeight: 220,
    borderWidth: 1,
  },
  glowPrimary: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    top: -90,
    right: -70,
  },
  glowSecondary: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    bottom: -80,
    left: -70,
  },
  content: {
    padding: spacing.xl,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  amount: {
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: -2,
    marginBottom: spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
    textTransform: 'lowercase',
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    height: 28,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  settleBtnGlass: {
    flex: 1,
    borderRadius: borderRadius.md,
    paddingVertical: 13,
    alignItems: 'center',
  },
  settleBtnText: {
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.2,
  },
  addBtn: {
    flex: 1,
    borderRadius: borderRadius.md,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1,
  },
  addBtnText: {
    fontWeight: '600',
    fontSize: 14,
  },
});
