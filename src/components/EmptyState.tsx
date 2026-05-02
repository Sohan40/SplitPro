import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { colors, spacing, typography } from './theme';

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
  return (
    <View style={styles.container}>
      <Icon name={icon} size={64} color={colors.textTertiary} />
      <Text style={styles.title}>{title}</Text>
      {message && <Text style={styles.message}>{message}</Text>}
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
    ...typography.heading3,
    color: colors.textSecondary,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  message: {
    ...typography.caption,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  action: {
    marginTop: spacing.xl,
  },
});
