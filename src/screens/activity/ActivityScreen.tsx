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
import { expenseService } from '../../services/expenseService';
import { groupService } from '../../services/groupService';
import type { Expense } from '../../models/Expense';
import type { ActivityScreenProps } from '../../navigation/types';
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
  other: 'ellipsis-horizontal-circle',
};

function groupByDate(expenses: Expense[]): { title: string; data: Expense[] }[] {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const sections: Record<string, Expense[]> = {};
  const sortedExpenses = [...expenses].sort((a, b) => b.createdAt - a.createdAt);

  for (const e of sortedExpenses) {
    const d = new Date(e.createdAt);
    let label: string;
    if (d.toDateString() === today.toDateString()) {
      label = 'Today';
    } else if (d.toDateString() === yesterday.toDateString()) {
      label = 'Yesterday';
    } else {
      label = d.toLocaleDateString('en-IN', { month: 'long', day: 'numeric' });
    }
    if (!sections[label]) sections[label] = [];
    sections[label].push(e);
  }

  return Object.entries(sections).map(([title, data]) => ({ title, data }));
}

export default function ActivityScreen({ navigation }: ActivityScreenProps) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const styles = useMemo(() => createStyles(colors, typography), [colors, typography]);
  const [activities, setActivities] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    let expensesUnsubscribe: () => void;

    const setupSubscription = async () => {
      try {
        const groups = await groupService.getUserGroups(user.id);
        const groupIds = groups.map(g => g.id);

        expensesUnsubscribe = expenseService.subscribeToUserExpenses(groupIds, (data) => {
          setActivities(data);
          setLoading(false);
        });
      } catch (error) {
        console.error('Failed to setup activity subscription:', error);
        setLoading(false);
      }
    };

    setupSubscription();

    return () => {
      if (expensesUnsubscribe) expensesUnsubscribe();
    };
  }, [user]);

  const sections = groupByDate(activities);

  const renderItem = ({ item, index, section }: { item: Expense; index: number; section: { data: Expense[] } }) => {
    const iPaid = item.paidBy.uid === user?.id;
    const participantMe = item.participants.find(p => p.uid === user?.id);

    let color = colors.textSecondary;
    let label = '';
    let amount = 0;

    if (item.splitType === 'payment') {
      label = iPaid ? 'You paid' : 'You received';
      amount = item.amount;
      color = colors.textSecondary;
    } else if (iPaid) {
      const myShare = participantMe ? participantMe.amount : 0;
      amount = item.amount - myShare;
      label = 'You lent';
      color = colors.owed;
    } else if (participantMe) {
      amount = participantMe.amount;
      label = 'You owe';
      color = colors.owes;
    }

    const isLast = index === section.data.length - 1;

    const iconName = CATEGORY_ICON_MAP[item.category?.toLowerCase()] || 'ellipsis-horizontal-circle';
    const iconColor = color === colors.owes ? colors.owes : color === colors.owed ? colors.owed : colors.primary;

    return (
      <TouchableOpacity
        onPress={() => navigation.navigate('Groups', {
          screen: 'ExpenseDetail',
          params: { groupId: item.groupId, expenseId: item.id }
        })}
        activeOpacity={0.7}
        style={styles.itemWrapper}
      >
        <GlassCard padding="none">
          <View style={[styles.item, !isLast && styles.itemBorder]}>
            <View style={[styles.iconBox, { borderColor: colors.border }]}>
              <Icon name={iconName} size={22} color={iconColor} />
            </View>
            <View style={styles.info}>
              <Text style={styles.description} numberOfLines={1}>{item.description}</Text>
              <Text style={styles.subtext} numberOfLines={1}>
                {item.paidBy.uid === user?.id ? 'You' : item.paidBy.name} paid ₹{item.amount.toFixed(2)}
              </Text>
            </View>
            <View style={styles.balance}>
              <Text style={[styles.amountLabel, { color }]}>{label}</Text>
              <Text style={[styles.amountText, { color }]}>₹{amount.toFixed(2)}</Text>
            </View>
          </View>
        </GlassCard>
      </TouchableOpacity>
    );
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
