import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  ActivityIndicator,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import {
  spacing,
  borderRadius,
  shadows,
  type ThemeColors,
  type ThemeTypography,
} from '../../components/theme';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useCurrency } from '../../context/CurrencyContext';
import { groupService } from '../../services/groupService';
import { expenseService } from '../../services/expenseService';
import type { Group } from '../../models/Group';
import type { Expense } from '../../models/Expense';
import type { GroupDetailScreenProps } from '../../navigation/types';
import EmptyState from '../../components/EmptyState';
import CategoryIcon from '../../components/CategoryIcon';
import Icon from 'react-native-vector-icons/Ionicons';

type ExpenseSection = {
  title: string;
  data: Expense[];
};

function getExpenseDateKey(expense: Expense): string {
  return new Date(expense.createdAt).toDateString();
}

function getExpenseDateLabel(expense: Expense): string {
  const expenseDate = new Date(expense.createdAt);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (expenseDate.toDateString() === today.toDateString()) {
    return 'Today';
  }

  if (expenseDate.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year:
      expenseDate.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  }).format(expenseDate);
}

function groupExpensesByDate(expenses: Expense[]): ExpenseSection[] {
  const sortedExpenses = [...expenses].sort(
    (a, b) => b.createdAt - a.createdAt,
  );
  const sections: ExpenseSection[] = [];
  const sectionMap = new Map<string, ExpenseSection>();

  sortedExpenses.forEach(expense => {
    const key = getExpenseDateKey(expense);
    let section = sectionMap.get(key);

    if (!section) {
      section = {
        title: getExpenseDateLabel(expense),
        data: [],
      };
      sectionMap.set(key, section);
      sections.push(section);
    }

    section.data.push(expense);
  });

  return sections;
}

export default function GroupDetailScreen({
  route,
  navigation,
}: GroupDetailScreenProps) {
  const { groupId, groupName } = route.params;
  const { user } = useAuth();
  const { currency, formatAmount } = useCurrency();
  const { theme, isDark } = useTheme();
  const { colors, typography } = theme;
  const styles = useMemo(
    () => createStyles(colors, typography),
    [colors, typography],
  );
  const primaryForeground = isDark ? colors.black : colors.white;

  const [group, setGroup] = useState<Group | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const expenseSections = useMemo(
    () => groupExpensesByDate(expenses),
    [expenses],
  );

  useEffect(() => {
    navigation.setOptions({ title: groupName });

    setLoading(true);
    let groupUnsubscribe: () => void;
    let expensesUnsubscribe: () => void;

    try {
      groupUnsubscribe = groupService.subscribeToGroup(groupId, groupData => {
        setGroup(groupData);
      });

      expensesUnsubscribe = expenseService.subscribeToGroupExpenses(
        groupId,
        expensesData => {
          setExpenses(expensesData);
          setLoading(false);
        },
      );
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
      descriptionText = iPaid
        ? `You paid ${otherPerson}`
        : `${otherPerson} paid you`;
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

    return (
      <TouchableOpacity
        onPress={() =>
          navigation.navigate('ExpenseDetail', { groupId, expenseId: item.id })
        }
        activeOpacity={0.7}
        style={styles.expenseCardWrapper}
      >
        <View style={styles.expenseRow}>
          <View style={styles.iconBox}>
            <CategoryIcon category={item.category || 'others'} size={28} />
          </View>
          {item.splitType === 'payment' ? (
            <>
              <View style={styles.expenseInfo}>
                <Text style={styles.expenseDesc} numberOfLines={1}>
                  {descriptionText}
                </Text>
              </View>
              <View style={styles.expenseMyShare}>
                <Text style={[styles.shareAmount, { color }]}>
                  {formatAmount(amountText, {
                    currency: group?.currency || currency,
                  })}
                </Text>
              </View>
            </>
          ) : (
            <>
              <View style={styles.expenseInfo}>
                <Text style={styles.expenseDesc} numberOfLines={1}>
                  {item.description}
                </Text>
                <Text style={styles.expensePaidBy}>
                  {item.paidBy.uid === user?.id ? 'You' : item.paidBy.name} paid{' '}
                  {formatAmount(item.amount, {
                    currency: group?.currency || currency,
                  })}
                </Text>
              </View>
              {amountText !== 0 ? (
                <View style={styles.expenseMyShare}>
                  <Text style={[styles.shareLabel, { color }]}>
                    {descriptionText}
                  </Text>
                  <Text style={[styles.shareAmount, { color }]}>
                    {formatAmount(amountText, {
                      currency: group?.currency || currency,
                    })}
                  </Text>
                </View>
              ) : (
                <Text style={styles.notInvolved}>Not involved</Text>
              )}
            </>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const myBalance = user && group ? group.balances?.[user.id] || 0 : 0;
  const isPositive = myBalance >= 0;
  const groupCurrency = group?.currency || currency;

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />

      {/* Balance Hero Header */}
      <View style={styles.header}>
        <View style={styles.balanceSummary}>
          <Text style={styles.balanceLabel}>Your balance in this group</Text>
          <Text
            style={[
              styles.balanceAmount,
              { color: isPositive ? colors.owed : colors.owes },
            ]}
          >
            {formatAmount(myBalance, { currency: groupCurrency })}
          </Text>
          <Text
            style={[
              styles.balanceSubLabel,
              { color: isPositive ? colors.owed : colors.owes },
            ]}
          >
            {myBalance === 0
              ? 'All settled up 🎉'
              : isPositive
              ? 'People owe you'
              : 'You owe people'}
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() =>
              navigation.navigate('SettleUp', { groupId, groupName })
            }
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
          <View style={styles.actionDivider} />
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() =>
              navigation.navigate('SpendAnalysis', { groupId, groupName })
            }
          >
            <Icon name="stats-chart-outline" size={20} color={colors.primary} />
            <Text style={styles.actionText}>Analysis</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Expenses */}
      <View style={styles.listSection}>
        <Text style={styles.sectionTitle}>Recent Expenses</Text>
      </View>

      {loading ? (
        <ActivityIndicator
          style={{ marginTop: spacing.xl }}
          color={colors.primary}
        />
      ) : (
        <SectionList
          sections={expenseSections}
          keyExtractor={item => item.id}
          renderItem={renderExpense}
          renderSectionHeader={({ section }) => (
            <View style={styles.dateHeader}>
              <Text style={styles.dateHeaderText}>{section.title}</Text>
            </View>
          )}
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
        onPress={() =>
          navigation.navigate('AddExpense', { groupId, groupName })
        }
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Add expense"
      >
        <Icon name="add" size={30} color={primaryForeground} />
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (colors: ThemeColors, typography: ThemeTypography) =>
  StyleSheet.create({
    container: {
      backgroundColor: colors.background,
      flex: 1,
    },
    header: {
      paddingTop: spacing.xl,
      paddingBottom: spacing.lg,
    },
    balanceSummary: {
      alignItems: 'center',
      paddingBottom: spacing.lg,
      paddingHorizontal: spacing.xl,
      marginBottom: spacing.md,
    },
    balanceLabel: {
      ...typography.captionBold,
      color: colors.textSecondary,
      marginBottom: spacing.xs,
    },
    balanceAmount: {
      ...typography.amountLarge,
    },
    balanceSubLabel: {
      ...typography.captionBold,
      marginTop: 4,
    },
    actionRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
    },
    actionBtn: {
      flex: 1,
      alignItems: 'center',
      gap: spacing.xs,
    },
    actionDivider: {
      width: 1,
      height: '100%',
      backgroundColor: colors.borderLight,
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
    dateHeader: {
      paddingTop: spacing.sm,
      paddingBottom: spacing.sm,
    },
    dateHeaderText: {
      ...typography.label,
      color: colors.textSecondary,
    },
    expenseCardWrapper: {
      marginBottom: spacing.md,
    },
    expenseRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceContainer,
      borderRadius: borderRadius.lg,
      borderWidth: 1,
      borderColor: colors.borderLight,
      padding: spacing.lg,
    },
    iconBox: {
      marginRight: spacing.md,
    },
    expenseInfo: {
      flex: 1,
    },
    expenseDesc: {
      ...typography.bodyBold,
    },
    expensePaidBy: {
      ...typography.caption,
      color: colors.textSecondary,
      marginTop: 2,
    },
    expenseMyShare: {
      alignItems: 'flex-end',
      marginLeft: spacing.sm,
    },
    shareLabel: {
      ...typography.caption,
      textTransform: 'uppercase',
      marginBottom: 2,
    },
    shareAmount: {
      ...typography.bodyBold,
    },
    notInvolved: {
      ...typography.caption,
      color: colors.textSecondary,
      marginLeft: spacing.sm,
    },
    fab: {
      position: 'absolute',
      bottom: spacing.xl,
      right: spacing.xl,
      alignItems: 'center',
      justifyContent: 'center',
      height: 60,
      width: 60,
      borderRadius: 30,
      backgroundColor: colors.primary,
      ...shadows.lg,
    },
  });
