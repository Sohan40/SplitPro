import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { colors, typography, spacing } from '../../components/theme';
import { useAuth } from '../../context/AuthContext';
import { expenseService } from '../../services/expenseService';
import type { Expense } from '../../models/Expense';
import type { ExpenseDetailScreenProps } from '../../navigation/types';
import Card from '../../components/Card';
import Avatar from '../../components/Avatar';
import CategoryIcon from '../../components/CategoryIcon';
import Icon from 'react-native-vector-icons/Ionicons';

export default function ExpenseDetailScreen({ route, navigation }: ExpenseDetailScreenProps) {
  const { expenseId, groupId } = route.params;
  const { user } = useAuth();
  const [expense, setExpense] = useState<Expense | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity 
          onPress={() => navigation.navigate('AddExpense', { 
            groupId, 
            groupName: 'Edit Expense', 
            expenseId 
          })}
          style={{ marginRight: spacing.md }}
        >
          <Icon name="create-outline" size={24} color={colors.primary} />
        </TouchableOpacity>
      ),
    });

    const unsubscribe = expenseService.subscribeToExpense(expenseId, (data) => {
      setExpense(data);
      setLoading(false);
    });

    return unsubscribe;
  }, [expenseId, groupId, navigation]);

  if (loading || !expense) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <CategoryIcon category={expense.category} size={64} />
        <Text style={styles.description}>{expense.description}</Text>
        <Text style={styles.amount}>₹{expense.amount.toFixed(2)}</Text>
        <Text style={styles.date}>
          Added by {expense.createdBy === user?.id ? 'you' : 'someone'} on{' '}
          {new Date(expense.createdAt).toLocaleDateString()}
        </Text>
      </View>

      <Card style={styles.section}>
        <View style={styles.payerRow}>
          <Avatar name={expense.paidBy.name} size={48} />
          <View style={styles.payerInfo}>
            <Text style={styles.payerLabel}>Paid by</Text>
            <Text style={styles.payerName}>{expense.paidBy.uid === user?.id ? 'You' : expense.paidBy.name}</Text>
          </View>
          <Text style={styles.payerAmount}>₹{expense.amount.toFixed(2)}</Text>
        </View>
      </Card>

      <Text style={styles.sectionTitle}>Split ({expense.splitType})</Text>
      <Card style={styles.section}>
        {expense.participants.map((p, index) => (
          <View 
            key={p.uid} 
            style={[
              styles.participantRow, 
              index < expense.participants.length - 1 && styles.borderBottom
            ]}
          >
            <Avatar name={p.name} size={32} />
            <Text style={styles.participantName}>{p.uid === user?.id ? 'You' : p.name}</Text>
            <Text style={styles.participantAmount}>₹{p.amount.toFixed(2)}</Text>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  description: {
    ...typography.heading2,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  amount: {
    ...typography.amountLarge,
    color: colors.textPrimary,
  },
  date: {
    ...typography.caption,
    marginTop: spacing.sm,
  },
  sectionTitle: {
    ...typography.bodyBold,
    marginBottom: spacing.sm,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  section: {
    marginBottom: spacing.xl,
    padding: spacing.md,
  },
  payerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  payerInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  payerLabel: {
    ...typography.caption,
  },
  payerName: {
    ...typography.bodyBold,
  },
  payerAmount: {
    ...typography.bodyBold,
    color: colors.primary,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  borderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  participantName: {
    ...typography.body,
    flex: 1,
    marginLeft: spacing.md,
  },
  participantAmount: {
    ...typography.bodyBold,
  },
});
