import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { spacing, borderRadius, shadows, type ThemeColors, type ThemeTypography } from '../../components/theme';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { groupService } from '../../services/groupService';
import { expenseService } from '../../services/expenseService';
import type { Group } from '../../models/Group';
import type { Expense } from '../../models/Expense';
import type { GroupDetailScreenProps } from '../../navigation/types';
import EmptyState from '../../components/EmptyState';
import GlassCard from '../../components/GlassCard';
import Icon from 'react-native-vector-icons/Ionicons';

const CATEGORY_ICON_MAP: Record<string, string> = {
  food: 'restaurant',
  travel: 'airplane',
  shopping: 'cart',
  entertainment: 'film',
  utilities: 'flash',
  health: 'medkit',
  other: 'receipt-outline',
};

export default function GroupDetailScreen({ route, navigation }: GroupDetailScreenProps) {
  const { groupId, groupName } = route.params;
  const { user } = useAuth();
  const { theme, isDark } = useTheme();
  const { colors, typography } = theme;
  const styles = useMemo(() => createStyles(colors, typography), [colors, typography]);
  const primaryForeground = isDark ? colors.black : colors.white;

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
        setLoading(false);
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
    const participantMe = item.participants.find(p => p.uid === user?.id);
    const iPaid = item.paidBy.uid === user?.id;

    let descriptionText = '';
    let amountText = 0;
    let color = colors.textSecondary;

    if (item.splitType === 'payment') {
      const otherPerson = iPaid ? item.participants[0]?.name : item.paidBy.name;
      descriptionText = iPaid ? `You paid ${otherPerson}` : `${otherPerson} paid you`;
      amountText = item.amount;
      color = colors.textSecondary;
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

    const iconName = CATEGORY_ICON_MAP[item.category?.toLowerCase()] || 'receipt-outline';

    return (
      <TouchableOpacity
        onPress={() => navigation.navigate('ExpenseDetail', { groupId, expenseId: item.id })}
        activeOpacity={0.7}
        style={styles.expenseCardWrapper}
      >
        <GlassCard padding="none">
          <View style={styles.expenseRow}>
            <View style={[styles.iconBox, { borderColor: colors.border }]}>
              <Icon name={iconName} size={20} color={color === colors.textSecondary ? colors.primary : color} />
            </View>
            <View style={styles.expenseInfo}>
              <Text style={styles.expenseDesc} numberOfLines={1}>{item.description}</Text>
              <Text style={styles.expensePaidBy}>
                {item.paidBy.uid === user?.id ? 'You' : item.paidBy.name} paid ₹{item.amount.toFixed(2)}
              </Text>
            </View>
            {amountText !== 0 ? (
              <View style={styles.expenseMyShare}>
                <Text style={[styles.shareLabel, { color }]}>{descriptionText}</Text>
                <Text style={[styles.shareAmount, { color }]}>₹{amountText.toFixed(2)}</Text>
              </View>
            ) : (
              <Text style={styles.notInvolved}>Not involved</Text>
            )}
          </View>
        </GlassCard>
      </TouchableOpacity>
    );
  };

  const myBalance = user && group ? (group.balances?.[user.id] || 0) : 0;
  const isPositive = myBalance >= 0;

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      {/* Balance Hero Header - wrapped in GlassCard with Skia glow */}
      <GlassCard padding="none" gradientDir="diagonal" style={styles.header}>
        <View style={styles.balanceSummary}>
          <Text style={styles.balanceLabel}>Your balance in this group</Text>
          <Text style={[styles.balanceAmount, { color: isPositive ? colors.owed : colors.owes }]}>
            {isPositive ? '+' : '-'}₹{Math.abs(myBalance).toFixed(2)}
          </Text>
          <Text style={[styles.balanceSubLabel, { color: isPositive ? colors.owed : colors.owes }]}>
            {myBalance === 0 ? 'All settled up 🎉' : isPositive ? 'People owe you' : 'You owe people'}
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => navigation.navigate('SettleUp', { groupId, groupName })}
          >
            <Icon name="cash-outline" size={20} color={colors.primary} />
            <Text style={styles.actionText}>Settle Up</Text>
          </TouchableOpacity>
          <View style={styles.actionDivider} />
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => navigation.navigate('GroupMembers', { groupId })}
          >
            <Icon name="people-outline" size={20} color={colors.primary} />
            <Text style={styles.actionText}>Members</Text>
          </TouchableOpacity>
        </View>
      </GlassCard>

      {/* Expenses */}
      <View style={styles.listSection}>
        <Text style={styles.sectionTitle}>Recent Expenses</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.primary} />
      ) : (
        <FlatList
          data={expenses}
          keyExtractor={item => item.id}
          renderItem={renderExpense}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              title="No expenses yet"
              message="Add an expense to start sharing costs."
            />
          }
        />
      )}

      {/* Glowing FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('AddExpense', { groupId, groupName })}
        activeOpacity={0.8}
      >
        <Icon name="add" size={24} color={primaryForeground} />
        <Text style={[styles.fabText, { color: primaryForeground }]}>Add Expense</Text>
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (colors: ThemeColors, typography: ThemeTypography) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  balanceSummary: {
    alignItems: 'center',
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.lg,
  },
  balanceLabel: {
    ...typography.label,
    marginBottom: spacing.sm,
  },
  balanceAmount: {
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -1.5,
  },
  balanceSubLabel: {
    ...typography.captionBold,
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.xl,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  actionDivider: {
    width: 1,
    height: '100%',
    backgroundColor: colors.border,
  },
  actionText: {
    ...typography.small,
    color: colors.primary,
    fontWeight: '600',
  },
  listSection: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.heading3,
  },
  listContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.huge * 2,
    flexGrow: 1,
    paddingTop: spacing.sm,
  },
  expenseCardWrapper: {
    marginBottom: spacing.md,
  },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceContainerHighest,
    borderWidth: 1,
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
  shareLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  shareAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  notInvolved: {
    ...typography.small,
    marginLeft: spacing.sm,
  },
  fab: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.primary,
    gap: spacing.sm,
    ...shadows.lg,
  },
  fabText: {
    fontWeight: '700',
    fontSize: 15,
  },
});
