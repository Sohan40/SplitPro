import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  SectionList,
} from 'react-native';
import { spacing, borderRadius, type ThemeColors, type ThemeTypography } from '../../components/theme';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useCurrency } from '../../context/CurrencyContext';
import { expenseService } from '../../services/expenseService';
import { groupService } from '../../services/groupService';
import { activityService } from '../../services/activityService';
import { warnUnlessPermissionDeniedAfterSignOut } from '../../services/firestoreErrorUtils';
import type { Expense } from '../../models/Expense';
import type { GroupActivity } from '../../models/Activity';
import type { ActivityScreenProps } from '../../navigation/types';
import type { CurrencyCode } from '../../utils/currency';
import { getSettlementDisplay } from '../../utils/expenseDisplay';
import EmptyState from '../../components/EmptyState';
import GlassCard from '../../components/GlassCard';
import CategoryIcon from '../../components/CategoryIcon';
import Icon from 'react-native-vector-icons/Ionicons';

type ExpenseFeedItem = {
  id: string;
  kind: 'expense';
  createdAt: number;
  expense: Expense;
};

type ActivityFeedItem = {
  id: string;
  kind: 'activity';
  createdAt: number;
  activity: GroupActivity;
};

type FeedItem = ExpenseFeedItem | ActivityFeedItem;

function groupByDate(items: FeedItem[]): { title: string; data: FeedItem[] }[] {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const sections: Record<string, FeedItem[]> = {};
  const sortedItems = [...items].sort((a, b) => b.createdAt - a.createdAt);

  for (const item of sortedItems) {
    const d = new Date(item.createdAt);
    let label: string;
    if (d.toDateString() === today.toDateString()) {
      label = 'Today';
    } else if (d.toDateString() === yesterday.toDateString()) {
      label = 'Yesterday';
    } else {
      label = d.toLocaleDateString('en-IN', { month: 'long', day: 'numeric' });
    }
    if (!sections[label]) sections[label] = [];
    sections[label].push(item);
  }

  return Object.entries(sections).map(([title, data]) => ({ title, data }));
}

function formatChangedFields(fields: string[] | undefined): string {
  const safeFields = (fields || []).filter(Boolean);
  if (safeFields.length === 0) return 'Expense updated';
  if (safeFields.length === 1) return `${safeFields[0]} changed`;
  if (safeFields.length === 2) return `${safeFields[0]} and ${safeFields[1]} changed`;
  return `${safeFields.slice(0, -1).join(', ')}, and ${safeFields[safeFields.length - 1]} changed`;
}

export default function ActivityScreen({ navigation }: ActivityScreenProps) {
  const { user } = useAuth();
  const { currency, formatAmount } = useCurrency();
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const styles = useMemo(() => createStyles(colors, typography), [colors, typography]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [groupActivities, setGroupActivities] = useState<GroupActivity[]>([]);
  const [groupCurrencies, setGroupCurrencies] = useState<Record<string, CurrencyCode>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    let isActive = true;
    let expensesUnsubscribe: () => void;
    let activityUnsubscribe: () => void;

    const setupSubscription = async () => {
      try {
        const groups = await groupService.getUserGroups(user.id);
        if (!isActive) return;

        const groupIds = groups.map(g => g.id);
        setGroupCurrencies(
          groups.reduce<Record<string, CurrencyCode>>((acc, group) => {
            acc[group.id] = group.currency || currency;
            return acc;
          }, {})
        );

        expensesUnsubscribe = expenseService.subscribeToUserExpenses(groupIds, (data) => {
          if (!isActive) return;
          setExpenses(data);
          setLoading(false);
        });

        activityUnsubscribe = activityService.subscribeToGroupsActivity(groupIds, (data) => {
          if (!isActive) return;
          setGroupActivities(data);
        });
      } catch (error) {
        warnUnlessPermissionDeniedAfterSignOut('Failed to setup activity subscription:', error);
        if (isActive) {
          setLoading(false);
        }
      }
    };

    setupSubscription();

    return () => {
      isActive = false;
      if (expensesUnsubscribe) expensesUnsubscribe();
      if (activityUnsubscribe) activityUnsubscribe();
    };
  }, [currency, user]);

  const feedItems = useMemo<FeedItem[]>(() => {
    const expenseItems: ExpenseFeedItem[] = expenses.map(expense => ({
      id: `expense:${expense.id}`,
      kind: 'expense',
      createdAt: expense.createdAt,
      expense,
    }));
    const activityItems: ActivityFeedItem[] = groupActivities.map(activity => ({
      id: `activity:${activity.groupId}:${activity.id}`,
      kind: 'activity',
      createdAt: activity.createdAt,
      activity,
    }));

    return [...expenseItems, ...activityItems].sort((a, b) => b.createdAt - a.createdAt);
  }, [expenses, groupActivities]);

  const sections = groupByDate(feedItems);

  const renderExpenseItem = (expense: Expense, isLast: boolean) => {
    const iPaid = expense.paidBy.uid === user?.id;
    const participantMe = expense.participants.find(p => p.uid === user?.id);
    const itemCurrency = groupCurrencies[expense.groupId] || currency;

    let color = colors.textSecondary;
    let label = '';
    let amount = 0;
    let subtext = `${expense.paidBy.uid === user?.id ? 'You' : expense.paidBy.name} paid ${formatAmount(expense.amount, { currency: itemCurrency })}`;

    if (expense.splitType === 'payment') {
      const settlement = getSettlementDisplay(expense, user?.id);
      label = settlement.label;
      amount = expense.amount;
      subtext = settlement.title;
      color = colors.textSecondary;
    } else if (iPaid) {
      const myShare = participantMe ? participantMe.amount : 0;
      amount = expense.amount - myShare;
      label = 'You lent';
      color = colors.owed;
    } else if (participantMe) {
      amount = participantMe.amount;
      label = 'You owe';
      color = colors.owes;
    }

    return (
      <TouchableOpacity
        onPress={() => navigation.navigate('Groups', {
          screen: 'ExpenseDetail',
          params: { groupId: expense.groupId, expenseId: expense.id, returnToActivity: true },
        })}
        activeOpacity={0.7}
        style={styles.itemWrapper}
      >
        <GlassCard padding="none">
          <View style={[styles.item, !isLast && styles.itemBorder]}>
            <View style={styles.categoryIconWrap}>
              <CategoryIcon category={expense.category || 'others'} size={44} />
            </View>
            <View style={styles.info}>
              <Text style={styles.description} numberOfLines={1}>{expense.description}</Text>
              <Text style={styles.subtext} numberOfLines={1}>
                {subtext}
              </Text>
            </View>
            <View style={styles.balance}>
              <Text style={[styles.amountLabel, { color }]}>{label}</Text>
              <Text style={[styles.amountText, { color }]}>{formatAmount(amount, { currency: itemCurrency })}</Text>
            </View>
          </View>
        </GlassCard>
      </TouchableOpacity>
    );
  };

  const renderActivityItem = (activity: GroupActivity, isLast: boolean) => (
    <TouchableOpacity
      onPress={() => navigation.navigate('Groups', {
        screen: 'ExpenseDetail',
        params: { groupId: activity.groupId, expenseId: activity.expenseId, returnToActivity: true },
      })}
      activeOpacity={0.7}
      style={styles.itemWrapper}
    >
      <GlassCard padding="none">
        <View style={[styles.item, !isLast && styles.itemBorder]}>
          <View style={[styles.iconBox, { borderColor: colors.border }]}>
            <Icon name="create-outline" size={22} color={colors.primary} />
          </View>
          <View style={styles.info}>
            <Text style={styles.description} numberOfLines={1}>
              {activity.actorName || 'Someone'} updated {activity.expenseTitle || 'an expense'}
            </Text>
            <Text style={styles.subtext} numberOfLines={1}>
              {formatChangedFields(activity.changedFields)}
            </Text>
          </View>
          <View style={styles.activityChevron}>
            <Icon name="chevron-forward" size={18} color={colors.textTertiary} />
          </View>
        </View>
      </GlassCard>
    </TouchableOpacity>
  );

  const renderItem = ({ item, index, section }: { item: FeedItem; index: number; section: { data: FeedItem[] } }) => {
    const isLast = index === section.data.length - 1;
    return item.kind === 'expense'
      ? renderExpenseItem(item.expense, isLast)
      : renderActivityItem(item.activity, isLast);
  };

  const renderSectionHeader = ({ section }: { section: { title: string } }) => (
    <Text style={styles.sectionHeader}>{section.title}</Text>
  );

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator color={colors.primary} /></View>;
  }

  return (
    <View style={styles.container}>
      {sections.length === 0 ? (
        <EmptyState
          title="No activity yet"
          message="Your recent expenses and payments will show up here."
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
          renderSectionFooter={() => <View style={styles.sectionFooter} />}
        />
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors, typography: ThemeTypography) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  listContent: {
    padding: spacing.xl,
    paddingBottom: spacing.huge,
  },
  sectionHeader: {
    ...typography.label,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
    paddingLeft: spacing.xs,
  },
  sectionFooter: {
    marginBottom: spacing.md,
  },
  // Each item is wrapped in a GlassCard — this just handles spacing
  itemWrapper: {
    marginBottom: spacing.sm,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  itemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(167,139,250,0.12)',
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceContainerHighest,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  categoryIconWrap: {
    marginRight: spacing.md,
  },
  info: {
    flex: 1,
  },
  description: {
    ...typography.bodyBold,
  },
  subtext: {
    ...typography.caption,
    marginTop: 2,
  },
  balance: {
    alignItems: 'flex-end',
    marginLeft: spacing.sm,
  },
  activityChevron: {
    marginLeft: spacing.sm,
  },
  amountLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  amountText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
