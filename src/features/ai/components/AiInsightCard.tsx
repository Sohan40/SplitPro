import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Button from '../../../components/Button';
import GlassCard from '../../../components/GlassCard';
import { borderRadius, spacing, type ThemeColors } from '../../../components/theme';
import { useTheme } from '../../../context/ThemeContext';

type AiInsightCardProps = {
  title: string;
  description: string;
  icon: string;
  loading: boolean;
  disabled?: boolean;
  onPress: () => void;
};

export default function AiInsightCard({
  title,
  description,
  icon,
  loading,
  disabled = false,
  onPress,
}: AiInsightCardProps) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <GlassCard style={styles.card} padding="none">
      <View style={styles.cardBody}>
        <View>
          <View style={styles.header}>
            <View style={styles.iconWrap}>
              <Icon name={icon} size={20} color={colors.primary} />
            </View>
            <View style={styles.readyBadge}>
              <Icon name="sparkles-outline" size={14} color={colors.primary} />
            </View>
          </View>
          <Text style={[typography.bodyBold, styles.title]} numberOfLines={2}>{title}</Text>
          <Text style={[typography.caption, styles.description]} numberOfLines={2}>{description}</Text>
        </View>
        <Button
          title="Generate"
          size="sm"
          loading={loading}
          disabled={disabled}
          onPress={onPress}
          style={styles.button}
        />
      </View>
    </GlassCard>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  card: {
    minHeight: 178,
  },
  cardBody: {
    minHeight: 178,
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
  },
  readyBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: borderRadius.full,
    width: 30,
    height: 30,
    borderColor: colors.border,
    backgroundColor: colors.surfaceContainerHigh,
  },
  title: {
    marginTop: spacing.sm,
  },
  description: {
    marginTop: spacing.xs,
  },
  button: {
    marginTop: spacing.md,
  },
});
