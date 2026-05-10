import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, borderRadius } from './theme';

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
  const isPositive = netBalance >= 0;
  const glowColor = isPositive ? 'rgba(52,211,153,0.16)' : 'rgba(239,68,68,0.12)';

  return (
    <View style={styles.wrapper}>
      <View pointerEvents="none" style={[styles.glowPrimary, { backgroundColor: glowColor }]} />
      <View pointerEvents="none" style={styles.glowSecondary} />

      <View style={styles.content}>
        <Text style={styles.label}>Total Balance</Text>
        <Text style={[styles.amount, { color: isPositive ? colors.owed : colors.owes }]}>
          {isPositive ? '+' : '-'}₹{Math.abs(netBalance).toFixed(2)}
        </Text>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{'\u20B9'}{totalOwes.toFixed(2)}</Text>
            <Text style={[styles.statLabel, { color: colors.owes }]}>
              you owe · {negativeGroupCount} groups
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: colors.owed }]}>{'\u20B9'}{totalOwed.toFixed(2)}</Text>
            <Text style={[styles.statLabel, { color: colors.owed }]}>
              owed to you · {positiveGroupCount} groups
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.settleBtnGlass} onPress={onSettleUp} activeOpacity={0.8}>
            <Text style={styles.settleBtnText}>Settle Up</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addBtn} onPress={onAddExpense} activeOpacity={0.8}>
            <Text style={styles.addBtnText}>+ Add Expense</Text>
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
    backgroundColor: 'rgba(30,28,42,0.86)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.22)',
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
    backgroundColor: 'rgba(124,58,237,0.10)',
  },
  content: {
    padding: spacing.xl,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textSecondary,
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
    color: colors.textPrimary,
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
    backgroundColor: 'rgba(167,139,250,0.2)',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  settleBtnGlass: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 13,
    alignItems: 'center',
  },
  settleBtnText: {
    color: colors.black,
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.2,
  },
  addBtn: {
    flex: 1,
    backgroundColor: 'rgba(167,139,250,0.12)',
    borderRadius: borderRadius.md,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.25)',
  },
  addBtnText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 14,
  },
});
