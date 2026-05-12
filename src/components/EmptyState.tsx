import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { spacing } from './theme';

interface EmptyStateProps {
  icon?: string;
  title: string;
  message?: string;
  action?: React.ReactNode;
}

export default function EmptyState({
  icon = 'folder-open-outline',
  title,
  message,
  action,
}: EmptyStateProps) {
  const { theme } = useTheme();
  const { colors } = theme;

  return (
    <View style={styles.container}>
      <Icon name={icon} size={64} color={colors.textTertiary} />
      <Text style={[styles.title, { color: colors.textSecondary }]}>{title}</Text>
      {message && <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>}
      {action && <View style={styles.action}>{action}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxxl,
    paddingVertical: spacing.huge,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 24,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  action: {
    marginTop: spacing.xl,
  },
});
