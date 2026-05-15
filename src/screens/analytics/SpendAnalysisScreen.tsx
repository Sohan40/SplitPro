import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Button from '../../components/Button';
import EmptyState from '../../components/EmptyState';
import GlassCard from '../../components/GlassCard';
import { borderRadius, spacing, type ThemeColors, type ThemeTypography } from '../../components/theme';
import { useAuth } from '../../context/AuthContext';
import { useCurrency } from '../../context/CurrencyContext';
import { useTheme } from '../../context/ThemeContext';
import AiInsightsSection from '../../features/ai/components/AiInsightsSection';
import {
  calculateSpendAnalytics,
  getCurrentMonthKey,
  type SpendAnalyticsSummary,
} from '../../features/analytics/calculateSpendAnalytics';
import type { Expense } from '../../models/Expense';
import type { Group } from '../../models/Group';
import type { SpendAnalysisScreenProps } from '../../navigation/types';
import { expenseService } from '../../services/expenseService';
import { groupService } from '../../services/groupService';

type LoadState = 'loading' | 'ready' | 'error';
type AnalysisTab = 'overview' | 'members' | 'trends' | 'ai';

type SectionProps = {
  title: string;
  children: React.ReactNode;
};

type TabItem = {
  key: AnalysisTab;
  label: string;
  icon: string;
};

const ANALYSIS_TABS: TabItem[] = [
  { key: 'overview', label: 'Overview', icon: 'grid-outline' },
  { key: 'members', label: 'Members', icon: 'people-outline' },
  { key: 'trends', label: 'Trends', icon: 'trending-up-outline' },
  { key: 'ai', label: 'AI', icon: 'sparkles-outline' },
];

function AnalyticsSection({ title, children }: SectionProps) {
  const { theme } = useTheme();

  return (
    <View style={sectionStyles.container}>
      <Text style={[theme.typography.heading3, sectionStyles.title]}>{title}</Text>
      {children}
    </View>
  );
}

function shiftMonth(monthKey: string, offset: number): string {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month - 1 + offset, 1);
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}`;
}

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IN', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, 1));
}

function hasSpendHistory(group: Group, expenses: Expense[]): boolean {
  return expenses.some(expense => (
    expense.groupId === group.id
    && expense.splitType !== 'payment'
    && expense.category !== 'payment'
    && Number.isFinite(expense.amount)
    && expense.amount > 0
  ));
}

export default function SpendAnalysisScreen({ route, navigation }: SpendAnalysisScreenProps) {
  const { groupId, groupName, monthKey: initialMonthKey } = route.params;
  const { user } = useAuth();
  const { currency, formatAmount } = useCurrency();
  const { theme, isDark } = useTheme();
  const { colors, typography } = theme;
  const styles = useMemo(() => createStyles(colors, typography), [colors, typography]);

  const [group, setGroup] = useState<Group | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [monthKey, setMonthKey] = useState(initialMonthKey || getCurrentMonthKey());
  const [activeTab, setActiveTab] = useState<AnalysisTab>('overview');

  useEffect(() => {
    navigation.setOptions({ title: `${groupName} Analysis` });
  }, [groupName, navigation]);

  useEffect(() => {
    setLoadState('loading');
    let isActive = true;
    let groupLoaded = false;
    let expensesLoaded = false;
    let groupUnsubscribe: (() => void) | undefined;
    let expensesUnsubscribe: (() => void) | undefined;

    const markReady = () => {
      if (isActive && groupLoaded && expensesLoaded) {
        setLoadState('ready');
      }
    };

    try {
      groupUnsubscribe = groupService.subscribeToGroup(groupId, groupData => {
        if (!isActive) return;
        setGroup(groupData);
        groupLoaded = true;
        markReady();
      });

      expensesUnsubscribe = expenseService.subscribeToGroupExpenses(groupId, expensesData => {
        if (!isActive) return;
        setExpenses(expensesData);
        expensesLoaded = true;
        markReady();
      });
    } catch (error) {
      console.error('Failed to load spend analysis:', error);
      if (isActive) {
        setLoadState('error');
      }
    }

    return () => {
      isActive = false;
      groupUnsubscribe?.();
      expensesUnsubscribe?.();
    };
  }, [groupId]);

  const groupCurrency = group?.currency || currency;
  const summary = useMemo<SpendAnalyticsSummary | null>(() => {
    if (!group) return null;
    return calculateSpendAnalytics({ group, expenses, monthKey, currency: groupCurrency });
  }, [expenses, group, groupCurrency, monthKey]);

  const hasAnySpend = group ? hasSpendHistory(group, expenses) : false;
  const currentUserStats = summary?.memberStats.find(member => member.uid === user?.id);
  const maxTrendAmount = Math.max(...(summary?.monthlyTrend.map(item => item.amount) || [0]), 1);
  const topCategory = summary?.categoryBreakdown[0]?.category || 'None';
  const highestExpense = summary?.topExpenses[0];

  if (loadState === 'loading') {
    return (
      <View style={styles.centerContainer}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.loadingText}>Loading spend analysis...</Text>
      </View>
    );
  }

  if (loadState === 'error' || !group || !summary) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
        <EmptyState
          icon="alert-circle-outline"
          title="Could not load analysis"
          message="Please go back and try opening this group again."
          action={<Button title="Go Back" onPress={() => navigation.goBack()} variant="secondary" />}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.monthSwitcher}>
          <TouchableOpacity
            style={styles.monthButton}
            accessibilityRole="button"
            onPress={() => setMonthKey(current => shiftMonth(current, -1))}
          >
            <Icon name="chevron-back" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.monthLabelWrap}>
            <Text style={styles.monthEyebrow}>Spend Analysis</Text>
            <Text style={styles.monthLabel}>{formatMonthLabel(monthKey)}</Text>
          </View>
          <TouchableOpacity
            style={styles.monthButton}
            accessibilityRole="button"
            onPress={() => setMonthKey(current => shiftMonth(current, 1))}
          >
            <Icon name="chevron-forward" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {!hasAnySpend && (
          <GlassCard style={styles.noticeCard}>
            <Icon name="analytics-outline" size={22} color={colors.textSecondary} />
            <View style={styles.noticeCopy}>
              <Text style={styles.noticeTitle}>No spending to analyze yet</Text>
              <Text style={styles.noticeText}>
                Add a group expense to unlock richer analysis across these tabs.
              </Text>
            </View>
          </GlassCard>
        )}

        {hasAnySpend && summary.expenseCount === 0 && (
          <GlassCard style={styles.noticeCard}>
            <Icon name="calendar-outline" size={22} color={colors.textSecondary} />
            <View style={styles.noticeCopy}>
              <Text style={styles.noticeTitle}>No expenses this month</Text>
              <Text style={styles.noticeText}>Try another month or add a new expense for this group.</Text>
            </View>
          </GlassCard>
        )}

        <View style={styles.metricGrid}>
          {renderMetricCard(styles, colors, 'Total Spend', formatAmount(summary.totalSpend, { currency: groupCurrency }), 'wallet-outline')}
          {renderMetricCard(styles, colors, 'Expenses', `${summary.expenseCount}`, 'receipt-outline')}
          {renderMetricCard(styles, colors, 'Top Category', topCategory, 'pricetag-outline')}
          {renderMetricCard(
            styles,
            colors,
            'Your Net',
            currentUserStats ? formatAmount(currentUserStats.net, { currency: groupCurrency }) : 'N/A',
            'person-circle-outline',
            currentUserStats && currentUserStats.net < 0 ? colors.owes : colors.owed,
          )}
        </View>

        {summary.expenseCount > 0 && summary.expenseCount < 3 && (
          <GlassCard style={styles.noticeCard}>
            <Icon name="information-circle-outline" size={22} color={colors.info} />
            <View style={styles.noticeCopy}>
              <Text style={styles.noticeTitle}>Small data set</Text>
              <Text style={styles.noticeText}>
                Insights will become more useful after a few more expenses are added.
              </Text>
            </View>
          </GlassCard>
        )}

        <View style={styles.tabBar} accessibilityRole="tablist">
          {ANALYSIS_TABS.map(tab => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tabButton, isActive ? styles.tabButtonActive : null]}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                onPress={() => setActiveTab(tab.key)}
              >
                <Icon
                  name={tab.icon}
                  size={16}
                  color={isActive ? colors.primary : colors.textSecondary}
                />
                <Text style={[styles.tabLabel, isActive ? styles.tabLabelActive : null]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {activeTab === 'overview' && (
          <>
            <AnalyticsSection title="Overview Snapshot">
              <View style={styles.overviewGrid}>
                {renderCompactStat(styles, colors, 'Total Spend', formatAmount(summary.totalSpend, { currency: groupCurrency }), 'wallet-outline')}
                {renderCompactStat(styles, colors, 'Top Category', topCategory, 'pricetag-outline')}
                {renderCompactStat(
                  styles,
                  colors,
                  'Highest Expense',
                  highestExpense ? formatAmount(highestExpense.amount, { currency: groupCurrency }) : 'None',
                  'receipt-outline',
                )}
              </View>
              {highestExpense && (
                <GlassCard style={styles.rowCard} padding="sm">
                  <View style={styles.rowHeader}>
                    <View style={styles.memberNameWrap}>
                      <Text style={styles.rowTitle} numberOfLines={1}>{highestExpense.title}</Text>
                      <Text style={styles.rowMeta}>
                        Highest expense - {highestExpense.category} - Paid by {highestExpense.paidByName}
                      </Text>
                    </View>
                    <Text style={styles.rowAmount}>{formatAmount(highestExpense.amount, { currency: groupCurrency })}</Text>
                  </View>
                </GlassCard>
              )}
            </AnalyticsSection>

            <AnalyticsSection title="Category Breakdown">
              {summary.categoryBreakdown.length === 0 ? (
                <EmptyState
                  icon="pricetag-outline"
                  title="No category totals"
                  message="Category breakdown appears after this month has spending."
                />
              ) : (
                summary.categoryBreakdown.map(item => (
                  <GlassCard key={item.category} style={styles.rowCard} padding="sm">
                    <View style={styles.rowHeader}>
                      <Text style={styles.rowTitle}>{item.category}</Text>
                      <Text style={styles.rowAmount}>{formatAmount(item.amount, { currency: groupCurrency })}</Text>
                    </View>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: `${Math.max(item.percentage, 4)}%` }]} />
                    </View>
                    <Text style={styles.rowMeta}>{item.percentage}% of monthly spend</Text>
                  </GlassCard>
                ))
              )}
            </AnalyticsSection>

            <AnalyticsSection title="Basic Insights">
              <GlassCard style={styles.insightCard}>
                {summary.deterministicInsights.map(insight => (
                  <View key={insight} style={styles.insightRow}>
                    <Icon name="sparkles-outline" size={18} color={colors.primary} />
                    <Text style={styles.insightText}>{insight}</Text>
                  </View>
                ))}
              </GlassCard>
            </AnalyticsSection>
          </>
        )}

        {activeTab === 'members' && (
          <AnalyticsSection title="Member-wise Spend">
            {summary.memberStats.length === 0 ? (
              <EmptyState
                icon="people-outline"
                title="No members to analyze"
                message="Member analytics appear after this group has members."
              />
            ) : (
              summary.memberStats.map(member => (
                <GlassCard key={member.uid} style={styles.rowCard} padding="sm">
                  <View style={styles.rowHeader}>
                    <View style={styles.memberNameWrap}>
                      <Text style={styles.rowTitle} numberOfLines={1}>{member.displayName}</Text>
                      <Text style={styles.rowMeta}>
                        Paid {formatAmount(member.paid, { currency: groupCurrency })} - Share {formatAmount(member.owedShare, { currency: groupCurrency })}
                      </Text>
                    </View>
                    <Text style={[styles.memberNet, { color: member.net < 0 ? colors.owes : colors.owed }]}>
                      {formatAmount(member.net, { currency: groupCurrency })}
                    </Text>
                  </View>
                </GlassCard>
              ))
            )}
          </AnalyticsSection>
        )}

        {activeTab === 'trends' && (
          <>
            <AnalyticsSection title="Monthly Trend">
              <GlassCard style={styles.trendCard}>
                {summary.monthlyTrend.map(item => (
                  <View key={item.monthKey} style={styles.trendRow}>
                    <Text style={styles.trendMonth}>{item.monthKey.slice(5)}</Text>
                    <View style={styles.trendTrack}>
                      <View
                        style={[
                          styles.trendFill,
                          { width: `${Math.max((item.amount / maxTrendAmount) * 100, item.amount > 0 ? 6 : 0)}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.trendAmount}>{formatAmount(item.amount, { currency: groupCurrency })}</Text>
                  </View>
                ))}
              </GlassCard>
            </AnalyticsSection>

            <AnalyticsSection title="Largest Expenses">
              {summary.topExpenses.length === 0 ? (
                <EmptyState
                  icon="receipt-outline"
                  title="No largest expenses yet"
                  message="Largest expenses appear after this month has spending."
                />
              ) : (
                summary.topExpenses.map(expense => (
                  <GlassCard key={expense.id} style={styles.rowCard} padding="sm">
                    <View style={styles.rowHeader}>
                      <View style={styles.memberNameWrap}>
                        <Text style={styles.rowTitle} numberOfLines={1}>{expense.title}</Text>
                        <Text style={styles.rowMeta}>{expense.category} - Paid by {expense.paidByName}</Text>
                      </View>
                      <View style={styles.expenseAmountWrap}>
                        <Text style={styles.rowAmount}>{formatAmount(expense.amount, { currency: groupCurrency })}</Text>
                        <Text style={styles.rowMeta}>{expense.date}</Text>
                      </View>
                    </View>
                  </GlassCard>
                ))
              )}
            </AnalyticsSection>
          </>
        )}

        {activeTab === 'ai' && (
          <AiInsightsSection
            groupId={groupId}
            monthKey={monthKey}
            hasMonthlyExpenses={summary.expenseCount > 0}
            isSmallDataSet={summary.expenseCount > 0 && summary.expenseCount < 3}
            onUpgradePress={() => navigation.navigate('UpgradeAi')}
          />
        )}
      </ScrollView>
    </View>
  );
}

function renderMetricCard(
  styles: ReturnType<typeof createStyles>,
  colors: ThemeColors,
  label: string,
  value: string,
  icon: string,
  valueColor?: string,
) {
  return (
    <GlassCard style={styles.metricCard}>
      <Icon name={icon} size={22} color={colors.primary} />
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, valueColor ? { color: valueColor } : null]} numberOfLines={1}>
        {value}
      </Text>
    </GlassCard>
  );
}

function renderCompactStat(
  styles: ReturnType<typeof createStyles>,
  colors: ThemeColors,
  label: string,
  value: string,
  icon: string,
) {
  return (
    <GlassCard style={styles.compactStatCard} padding="sm">
      <Icon name={icon} size={18} color={colors.primary} />
      <Text style={styles.compactStatLabel}>{label}</Text>
      <Text style={styles.compactStatValue} numberOfLines={1}>{value}</Text>
    </GlassCard>
  );
}

const sectionStyles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  title: {
    marginTop: spacing.sm,
  },
});

const createStyles = (colors: ThemeColors, typography: ThemeTypography) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  loadingText: {
    ...typography.caption,
    marginTop: spacing.md,
  },
  content: {
    padding: spacing.xl,
    paddingBottom: spacing.huge,
    gap: spacing.lg,
  },
  monthSwitcher: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  monthButton: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: colors.border,
  },
  monthLabelWrap: {
    flex: 1,
    alignItems: 'center',
  },
  monthEyebrow: {
    ...typography.label,
  },
  monthLabel: {
    ...typography.heading2,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  noticeCopy: {
    flex: 1,
  },
  noticeTitle: {
    ...typography.bodyBold,
  },
  noticeText: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  metricCard: {
    width: '48%',
    minHeight: 118,
  },
  metricLabel: {
    ...typography.label,
    marginTop: spacing.md,
  },
  metricValue: {
    ...typography.heading3,
    marginTop: spacing.xs,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xs,
    gap: spacing.xs,
  },
  tabButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  tabButtonActive: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  tabLabel: {
    ...typography.small,
    textAlign: 'center',
  },
  tabLabelActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  overviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  compactStatCard: {
    flex: 1,
    minWidth: 96,
    gap: spacing.xs,
  },
  compactStatLabel: {
    ...typography.small,
    textTransform: 'uppercase',
  },
  compactStatValue: {
    ...typography.bodyBold,
  },
  rowCard: {
    gap: spacing.sm,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  rowTitle: {
    ...typography.bodyBold,
  },
  rowAmount: {
    ...typography.bodyBold,
    textAlign: 'right',
  },
  rowMeta: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  barTrack: {
    height: 8,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceContainerHighest,
    overflow: 'hidden',
    marginTop: spacing.md,
  },
  barFill: {
    height: '100%',
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
  },
  memberNameWrap: {
    flex: 1,
  },
  memberNet: {
    ...typography.bodyBold,
    textAlign: 'right',
  },
  trendCard: {
    gap: spacing.md,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  trendMonth: {
    ...typography.captionBold,
    width: 32,
  },
  trendTrack: {
    flex: 1,
    height: 10,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceContainerHighest,
    overflow: 'hidden',
  },
  trendFill: {
    height: '100%',
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
  },
  trendAmount: {
    ...typography.captionBold,
    width: 86,
    textAlign: 'right',
  },
  expenseAmountWrap: {
    alignItems: 'flex-end',
  },
  insightCard: {
    gap: spacing.md,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  insightText: {
    ...typography.body,
    flex: 1,
  },
});
