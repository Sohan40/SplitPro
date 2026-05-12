import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { borderRadius, spacing } from './theme';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: 'elevated' | 'outlined' | 'flat';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export default function Card({
  children,
  style,
  variant = 'elevated',
  padding = 'md',
}: CardProps) {
  const { theme } = useTheme();
  const { colors } = theme;

  const variantStyles: Record<string, ViewStyle> = {
    elevated: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceContainer },
    outlined: { borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surfaceContainer },
    flat: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  };

  const paddingStyles: Record<string, ViewStyle> = {
    none: { padding: 0 },
    sm: { padding: spacing.md },
    md: { padding: spacing.lg },
    lg: { padding: spacing.xl },
  };

  return (
    <View
      style={[
        styles.base,
        variantStyles[variant],
        paddingStyles[padding],
        style,
      ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: borderRadius.lg,
  },
});
