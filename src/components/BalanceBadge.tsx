import React from 'react';
import { Text, StyleSheet, TextStyle } from 'react-native';
import { useCurrency } from '../context/CurrencyContext';
import { useTheme } from '../context/ThemeContext';
import { formatCurrencyAmount, type CurrencyCode } from '../utils/currency';

interface BalanceBadgeProps {
  amount: number;
  currency?: CurrencyCode;
  style?: TextStyle;
  showSign?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function formatCurrency(amount: number, showSign = true, currency: CurrencyCode = 'INR'): string {
  const formatted = formatCurrencyAmount(amount, currency);
  if (!showSign) return formatCurrencyAmount(amount, currency, { absolute: true });
  if (amount === 0) return formatted;
  return amount > 0 ? formatted : formatCurrencyAmount(amount, currency);
}

export default function BalanceBadge({
  amount,
  currency,
  style,
  showSign = true,
  size = 'md',
}: BalanceBadgeProps) {
  const { theme } = useTheme();
  const { formatAmount } = useCurrency();
  const { colors } = theme;
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
      {!showSign
        ? formatAmount(amount, { absolute: true, currency })
        : formatAmount(amount, { currency })}
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
