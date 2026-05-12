import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';
import { spacing } from './theme';
import { Category } from '../models/Expense';

const CATEGORY_CONFIG: Record<Category, { icon: string; color: string; bg: string }> = {
  food: { icon: 'restaurant', color: '#EA580C', bg: '#FFF7ED' },
  groceries: { icon: 'cart', color: '#16A34A', bg: '#F0FDF4' },
  rent: { icon: 'home', color: '#7C3AED', bg: '#F5F3FF' },
  utilities: { icon: 'flash', color: '#EAB308', bg: '#FEFCE8' },
  transport: { icon: 'car', color: '#2563EB', bg: '#EFF6FF' },
  entertainment: { icon: 'film', color: '#DB2777', bg: '#FDF2F8' },
  payment: { icon: 'cash', color: '#059669', bg: 'rgba(5,150,105,0.1)' },
  others: { icon: 'ellipsis-horizontal', color: '#6B7280', bg: '#F9FAFB' },
};

interface CategoryIconProps {
  category: Category;
  size?: number;
  showLabel?: boolean;
}

export default function CategoryIcon({
  category,
  size = 36,
  showLabel = false,
}: CategoryIconProps) {
  const { theme } = useTheme();
  const { colors } = theme;
  const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.others;
  const iconSize = size * 0.5;

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.iconContainer,
          {
            width: size,
            height: size,
            borderRadius: size * 0.3,
            backgroundColor: config.bg,
          },
        ]}>
        <Icon name={config.icon} size={iconSize} color={config.color} />
      </View>
      {showLabel && (
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          {category.charAt(0).toUpperCase() + category.slice(1)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 11,
    fontWeight: '400',
    lineHeight: 14,
  },
});
