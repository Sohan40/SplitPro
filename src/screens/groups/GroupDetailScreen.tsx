import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { colors, typography, spacing, borderRadius, shadows } from '../../components/theme';
import { useAuth } from '../../context/AuthContext';
import { groupService } from '../../services/groupService';
import { expenseService } from '../../services/expenseService';
import type { Group } from '../../models/Group';
import type { Expense } from '../../models/Expense';
import type { GroupDetailScreenProps } from '../../navigation/types';
import Card from '../../components/Card';
import BalanceBadge from '../../components/BalanceBadge';
import EmptyState from '../../components/EmptyState';
import Icon from 'react-native-vector-icons/Ionicons';
import CategoryIcon from '../../components/CategoryIcon';

export default function GroupDetailScreen({ route, navigation }: GroupDetailScreenProps) {
  const { groupId, groupName } = route.params;
  const { user } = useAuth();
  
  const [group, setGroup] = useState<Group | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    navigation.setOptions({ title: groupName });
    
    setLoading(true);
    let groupUnsubscribe: () => void;
    let expensesUnsubscribe: () => void;

    try {
      groupUnsubscribe = groupService.subscribeToGroup(groupId, (groupData) => {
        setGroup(groupData);
      });

      expensesUnsubscribe = expenseService.subscribeToGroupExpenses(groupId, (expensesData) => {
        setExpenses(expensesData);
        setLoading(false); // Only set loading false once expenses load
      });
    } catch (error) {
      console.error('Failed to subscribe to group details:', error);
      setLoading(false);
    }

    return () => {
      if (groupUnsubscribe) groupUnsubscribe();
      if (expensesUnsubscribe) expensesUnsubscribe();
    };
  }, [groupId, groupName, navigation]);

  const renderExpense = ({ item }: { item: Expense }) => {
    // Determine how much the user owes/paid for this specific expense
    const participantMe = item.participants.find(p => p.uid === user?.id);
    const iPaid = item.paidBy.uid === user?.id;
    
    let descriptionText = '';
    let amountText = 0;
    let color = colors.textSecondary;

    if (item.splitType === 'payment') {
      const otherPerson = iPaid ? item.participants[0].name : item.paidBy.name;
      if (iPaid) {
        descriptionText = `You paid ${otherPerson}`;
        amountText = item.amount;
        color = colors.textSecondary;
      } else {
        descriptionText = `${otherPerson} paid you`;
        amountText = item.amount;
        color = colors.textSecondary;
      }
    } else if (iPaid) {
      const myShare = participantMe ? participantMe.amount : 0;
      amountText = item.amount - myShare;
      descriptionText = 'You lent';
      color = colors.owed;
    } else if (participantMe) {
      amountText = participantMe.amount;
      descriptionText = 'You borrowed';
      color = colors.owes;
    } else {
      descriptionText = 'Not involved';
      amountText = 0;
    }

    return (
      <TouchableOpacity 
        onPress={() => navigation.navigate('ExpenseDetail', { groupId, expenseId: item.id })}
        activeOpacity={0.7}
      >
        <Card style={styles.expenseCard} padding="sm">
          <View style={styles.expenseRow}>
            <View style={styles.dateBox}>
              <Text style={styles.dateMonth}>
                {new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short' })}
              </Text>
              <Text style={styles.dateDay}>
                {new Date(item.createdAt).getDate()}
              </Text>
            </View>
            <View style={styles.iconBox}>
              {/* Fallback to simple icon since CategoryIcon needs to be implemented */}
              <Icon name="receipt-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.expenseInfo}>
              <Text style={styles.expenseDesc} numberOfLines={1}>{item.description}</Text>
              <Text style={styles.expensePaidBy}>
                {item.paidBy.uid === user?.id ? 'You' : item.paidBy.name} paid ₹{item.amount.toFixed(2)}
              </Text>
            </View>
            <View style={styles.expenseMyShare}>
              {amountText !== 0 ? (
                <>
                  <Text style={[styles.shareDesc, { color }]}>{descriptionText}</Text>
                  <Text style={[styles.shareAmount, { color }]}>
                    ₹{amountText.toFixed(2)}
                  </Text>
                </>
              ) : (
                <Text style={styles.shareDesc}>Not involved</Text>
              )}
            </View>
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  const myBalance = user && group ? (group.balances?.[user.id] || 0) : 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.balanceContainer}>
          <Text style={styles.balanceLabel}>Your overall balance in this group</Text>
          <BalanceBadge amount={myBalance} size="lg" />
        </View>
        <View style={styles.actionRow}>
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={() => navigation.navigate('SettleUp', { groupId, groupName })}
          >
            <Icon name="cash-outline" size={24} color={colors.primary} />
            <Text style={styles.actionText}>Settle Up</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={() => navigation.navigate('GroupMembers', { groupId })}
          >
            <Icon name="people-outline" size={24} color={colors.primary} />
            <Text style={styles.actionText}>Members</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.primary} />
      ) : (
        <FlatList
          data={expenses}
          keyExtractor={item => item.id}
          renderItem={renderExpense}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <EmptyState 
              title="No expenses yet" 
              message="Add an expense to start sharing costs."
            />
          }
        />
      )}

      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => navigation.navigate('AddExpense', { groupId, groupName })}
        activeOpacity={0.8}
      >
        <Icon name="receipt" size={24} color={colors.white} />
        <Text style={styles.fabText}>Add Expense</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.surface,
    padding: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.sm,
  },
  balanceContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  balanceLabel: {
    ...typography.caption,
    marginBottom: spacing.xs,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionButton: {
    alignItems: 'center',
  },
  actionText: {
    ...typography.small,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  listContent: {
    padding: spacing.xl,
    paddingBottom: spacing.huge * 2,
    flexGrow: 1,
  },
  expenseCard: {
    marginBottom: spacing.md,
  },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateBox: {
    alignItems: 'center',
    marginRight: spacing.sm,
    width: 36,
  },
  dateMonth: {
    fontSize: 10,
    textTransform: 'uppercase',
    color: colors.textSecondary,
    fontWeight: 'bold',
  },
  dateDay: {
    fontSize: 18,
    color: colors.textPrimary,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  expenseInfo: {
    flex: 1,
  },
  expenseDesc: {
    ...typography.bodyBold,
  },
  expensePaidBy: {
    ...typography.small,
    marginTop: 2,
  },
  expenseMyShare: {
    alignItems: 'flex-end',
    marginLeft: spacing.sm,
  },
  shareDesc: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  shareAmount: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  fab: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    ...shadows.lg,
  },
  fabText: {
    ...typography.bodyBold,
    color: colors.white,
    marginLeft: spacing.sm,
  },
});
