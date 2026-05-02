import React from 'react';
import { Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { colors, typography } from './theme';

interface BalanceBadgeProps {
  amount: number;
  style?: TextStyle;
  showSign?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function formatCurrency(amount: number, showSign = true): string {
  const abs = Math.abs(amount);
  const formatted = '₹' + abs.toFixed(2);
  if (!showSign || amount === 0) return formatted;
  return amount > 0 ? `+${formatted}` : `-${formatted}`;
}

export default function BalanceBadge({
  amount,
  style,
  showSign = true,
  size = 'md',
}: BalanceBadgeProps) {
  const isPositive = amount > 0;
  const isZero = amount === 0;

  return (
    <Text
      style={[
        styles[size],
        {
          color: isZero
            ? colors.textSecondary
            : isPositive
            ? colors.owed
            : colors.owes,
        },
        style,
      ]}>
      {formatCurrency(amount, showSign)}
    </Text>
  );
}

const styles = StyleSheet.create({
  sm: {
    fontSize: 14,
    fontWeight: '600',
  },
  md: {
    fontSize: 16,
    fontWeight: '700',
  },
  lg: {
    fontSize: 24,
    fontWeight: '700',
  },
});
