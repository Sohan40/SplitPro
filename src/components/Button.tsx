import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  View,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { borderRadius, spacing } from './theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export default function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
  textStyle,
  icon,
}: ButtonProps) {
  const { theme } = useTheme();
  const { colors } = theme;
  const isDisabled = disabled || loading;
  const primaryForeground = theme.dark ? colors.black : colors.white;

  const variantStyles: Record<string, ViewStyle> = {
    primary: { backgroundColor: colors.primary },
    secondary: { backgroundColor: colors.surfaceContainerHigh, borderWidth: 1, borderColor: colors.border },
    outline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.border },
    danger: { backgroundColor: colors.owes },
    ghost: { backgroundColor: 'transparent' },
  };

  const textColorMap: Record<string, string> = {
    primary: primaryForeground,
    secondary: colors.primary,
    outline: colors.textPrimary,
    danger: colors.white,
    ghost: colors.primary,
  };

  const sizeStyles = { sm: styles.size_sm, md: styles.size_md, lg: styles.size_lg };
  const textSizeStyles = { sm: styles.textSize_sm, md: styles.textSize_md, lg: styles.textSize_lg };

  return (
    <TouchableOpacity
      style={[
        styles.base,
        variantStyles[variant],
        sizeStyles[size],
        isDisabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.75}>
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'outline' || variant === 'ghost' ? colors.primary : primaryForeground}
        />
      ) : (
        <View style={styles.inner}>
          {icon}
          <Text
            style={[
              styles.text,
              { color: textColorMap[variant] },
              textSizeStyles[size],
              textStyle,
            ]}>
            {title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  size_sm: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    minHeight: 36,
  },
  size_md: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    minHeight: 46,
  },
  size_lg: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxl,
    minHeight: 54,
  },
  disabled: {
    opacity: 0.4,
  },
  text: {
    fontWeight: '600',
  },
  textSize_sm: {
    fontSize: 13,
  },
  textSize_md: {
    fontSize: 15,
  },
  textSize_lg: {
    fontSize: 17,
  },
});
