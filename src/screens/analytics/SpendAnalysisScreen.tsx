import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
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
import { useCurrency } from '../../context/CurrencyContext';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import AiInsightsSection from '../../features/ai/components/AiInsightsSection';
import { useAiEntitlement } from '../../features/ai/hooks/useAiEntitlement';
import CategoryDonutChart, { type CategoryDonutItem } from '../../features/analytics/components/CategoryDonutChart';
import {
  calculateSpendAnalytics,
  formatCurrency as formatAnalyticsCurrency,
  getMonthKey,
  getCurrentMonthKey,
  type SpendAnalyticsSummary,
} from '../../features/analytics/calculateSpendAnalytics';
import type { Expense } from '../../models/Expense';
import type { Group } from '../../models/Group';
import type { SpendAnalysisScreenProps } from '../../navigation/types';
import { expenseService } from '../../services/expenseService';
import { warnUnlessPermissionDeniedAfterSignOut } from '../../services/firestoreErrorUtils';
import { groupService } from '../../services/groupService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type LoadState = 'loading' | 'ready' | 'error';
type AnalysisTab = 'overview' | 'categories' | 'members' | 'trends' | 'ai';

type SectionProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

type TabItem = {
  key: AnalysisTab;
  label: string;
};

type MemberSortKey =
  | 'netHighToLow'
  | 'netLowToHigh'
  | 'paidLowToHigh'
  | 'paidHighToLow'
  | 'shareLowToHigh'
  | 'shareHighToLow';

type BasicAnalysisPreview = {
  totalSpend: number;
  expenseCount: number;
  topCategory: string;
  highestExpense: {
    title: string;
    amount: number;
    category: string;
    paidByName: string;
  } | null;
};

type YearTrendItem = {
  monthKey: string;
  monthLabel: string;
  amount: number;
  color: string;
  isSelectedMonth: boolean;
  isFutureMonth: boolean;
};

const ANALYSIS_TABS: TabItem[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'categories', label: 'Category' },
  { key: 'members', label: 'Members' },
  { key: 'trends', label: 'Trends' },
  { key: 'ai', label: 'AI' },
];

const CATEGORY_CHART_COLORS = [
  '#a78bfa',
  '#60a5fa',
  '#34d399',
  '#f59e0b',
  '#f472b6',
  '#22d3ee',
];
const TREND_BAR_COLORS = [
  '#8b5cf6',
  '#60a5fa',
  '#22d3ee',
  '#34d399',
  '#a3e635',
  '#fbbf24',
  '#fb923c',
  '#f472b6',
  '#c084fc',
  '#818cf8',
  '#38bdf8',
  '#2dd4bf',
];
const MAX_PRIMARY_CATEGORY_ITEMS = 5;
const STICKY_TAB_AREA_HEIGHT = 64;
const TREND_TOOLTIP_WIDTH = 96;

const MEMBER_SORT_OPTIONS: Array<{ key: MemberSortKey; label: string }> = [
  { key: 'netHighToLow', label: 'Net: High to Low' },
  { key: 'netLowToHigh', label: 'Net: Low to High' },
  { key: 'paidLowToHigh', label: 'Paid: Low to High' },
  { key: 'paidHighToLow', label: 'Paid: High to Low' },
  { key: 'shareLowToHigh', label: 'Share: Low to High' },
  { key: 'shareHighToLow', label: 'Share: High to Low' },
];

function AnalyticsSection({ title, subtitle, children }: SectionProps) {
  const { theme } = useTheme();

  return (
    <View style={sectionStyles.container}>
      <View style={sectionStyles.header}>
        <Text style={[theme.typography.heading3, sectionStyles.title]}>{title}</Text>
        {subtitle ? <Text style={[theme.typography.caption, sectionStyles.subtitle]}>{subtitle}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function LockedPremiumAnalysisCard({
  onUpgradePress,
  checkingAccess,
}: {
  onUpgradePress: () => void;
  checkingAccess: boolean;
}) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const styles = useMemo(() => createLockedStyles(colors, typography), [colors, typography]);
  const buttonIconColor = theme.dark ? colors.black : colors.white;
  const benefits = ['Category insights', 'Member trends', 'AI suggestions'];

  return (
    <GlassCard style={styles.card} padding="md" opacity={0.96} radius={borderRadius.lg}>
      <View style={styles.badge}>
        {checkingAccess ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Icon name="lock-closed-outline" size={13} color={colors.primary} />
        )}
        <Text style={styles.badgeText}>Premium</Text>
      </View>

      <View style={styles.copy}>
        <Text style={styles.title}>Unlock full spend analysis</Text>
        <Text style={styles.subtitle}>
          See category insights, member trends, and AI-powered suggestions.
        </Text>
      </View>

      <View style={styles.benefitRow}>
        {benefits.map(benefit => (
          <View key={benefit} style={styles.benefitChip}>
            <View style={styles.chipDot} />
            <Text
              style={styles.benefitText}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.82}
            >
              {benefit}
            </Text>
          </View>
        ))}
      </View>

      <Button
        title="Upgrade to SplitPro AI"
        onPress={onUpgradePress}
        disabled={checkingAccess}
        size="sm"
        style={styles.cta}
        icon={<Icon name="sparkles-outline" size={15} color={buttonIconColor} />}
      />
    </GlassCard>
  );
}

function HeaderMonthControl({
  canGoToNext,
  canGoToPrevious,
  colors,
  label,
  onNext,
  onPrevious,
  styles,
}: {
  canGoToNext: boolean;
  canGoToPrevious: boolean;
  colors: ThemeColors;
  label: string;
  onNext: () => void;
  onPrevious: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.headerMonthPill}>
      <TouchableOpacity
        style={[styles.headerMonthStepButton, !canGoToPrevious ? styles.headerMonthStepButtonDisabled : null]}
        accessibilityRole="button"
        accessibilityLabel="Previous period"
        accessibilityState={{ disabled: !canGoToPrevious }}
        disabled={!canGoToPrevious}
        onPress={onPrevious}
      >
        <Icon
          name="chevron-back"
          size={14}
          color={canGoToPrevious ? colors.primary : colors.textTertiary}
        />
      </TouchableOpacity>

      <Text
        style={styles.headerMonthLabel}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.84}
      >
        {label}
      </Text>

      <TouchableOpacity
        style={[styles.headerMonthStepButton, !canGoToNext ? styles.headerMonthStepButtonDisabled : null]}
        accessibilityRole="button"
        accessibilityLabel="Next period"
        accessibilityState={{ disabled: !canGoToNext }}
        disabled={!canGoToNext}
        onPress={onNext}
      >
        <Icon
          name="chevron-forward"
          size={14}
          color={canGoToNext ? colors.primary : colors.textTertiary}
        />
      </TouchableOpacity>
    </View>
  );
}

function shiftMonth(monthKey: string, offset: number): string {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month - 1 + offset, 1);
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}`;
}

function compareMonthKeys(a: string, b: string): number {
  return a.localeCompare(b);
}

function getYearFromMonthKey(monthKey: string): number {
  return Number(monthKey.split('-')[0]) || new Date().getFullYear();
}

function clampMonthKey(monthKey: string, minMonthKey: string, maxMonthKey: string): string {
  if (compareMonthKeys(minMonthKey, maxMonthKey) > 0) {
    return maxMonthKey;
  }

  if (compareMonthKeys(monthKey, minMonthKey) < 0) {
    return minMonthKey;
  }

  if (compareMonthKeys(monthKey, maxMonthKey) > 0) {
    return maxMonthKey;
  }

  return monthKey;
}

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IN', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, 1));
}

function formatMonthName(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IN', {
    month: 'long',
  }).format(new Date(year, month - 1, 1));
}

function formatCompactMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IN', {
    month: 'short',
    year: 'numeric',
  }).format(new Date(year, month - 1, 1));
}

function formatTrendMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  return new Intl.DateTimeFormat('en-IN', { month: 'short' }).format(new Date(year, month - 1, 1));
}

function formatCompactAxisAmount(amount: number): string {
  if (amount <= 0) {
    return '0';
  }

  if (amount >= 1000) {
    const value = amount / 1000;
    const rounded = Math.round(value * 10) / 10;
    return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}k`;
  }

  return `${Math.round(amount)}`;
}

function formatSignedCurrency(amount: number, currency = 'INR'): string {
  if (Math.abs(amount) < 0.005) {
    return formatAnalyticsCurrency(0, currency);
  }

  return `${amount > 0 ? '+' : '-'}${formatAnalyticsCurrency(Math.abs(amount), currency)}`;
}

function getMemberSortLabel(sortKey: MemberSortKey): string {
  return MEMBER_SORT_OPTIONS.find(option => option.key === sortKey)?.label || 'Net: High to Low';
}

function compareMemberStats(
  a: SpendAnalyticsSummary['memberStats'][number],
  b: SpendAnalyticsSummary['memberStats'][number],
  sortKey: MemberSortKey,
): number {
  switch (sortKey) {
    case 'netLowToHigh':
      return a.net - b.net || a.displayName.localeCompare(b.displayName);
    case 'paidLowToHigh':
      return a.paid - b.paid || a.displayName.localeCompare(b.displayName);
    case 'paidHighToLow':
      return b.paid - a.paid || a.displayName.localeCompare(b.displayName);
    case 'shareLowToHigh':
      return a.owedShare - b.owedShare || a.displayName.localeCompare(b.displayName);
    case 'shareHighToLow':
      return b.owedShare - a.owedShare || a.displayName.localeCompare(b.displayName);
    case 'netHighToLow':
    default:
      return b.net - a.net || a.displayName.localeCompare(b.displayName);
  }
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

function formatCustomCategory(category: string): string {
  return category
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ') || 'Other';
}

function normalizePreviewCategory(category?: string): string {
  const labels: Record<string, string> = {
    food: 'Food',
    groceries: 'Groceries',
    rent: 'Rent',
    utilities: 'Utilities',
    transport: 'Travel',
    travel: 'Travel',
    shopping: 'Shopping',
    entertainment: 'Entertainment',
    health: 'Health',
    education: 'Education',
    subscriptions: 'Subscriptions',
    gifts: 'Gifts',
    pets: 'Pets',
    fitness: 'Fitness',
    sports: 'Sports',
    others: 'Other',
    other: 'Other',
  };

  const rawCategory = String(category || '').trim();
  if (!rawCategory) return 'Other';
  return labels[rawCategory.toLowerCase()] || formatCustomCategory(rawCategory);
}

function normalizeBreakdownCategory(category?: string): string {
  const labels: Record<string, string> = {
    food: 'Food',
    groceries: 'Groceries',
    rent: 'Rent',
    utilities: 'Utilities',
    transport: 'Travel',
    travel: 'Travel',
    shopping: 'Shopping',
    entertainment: 'Entertainment',
    health: 'Health',
    others: 'Other',
    other: 'Other',
    payment: 'Other',
  };

  const rawCategory = String(category || '').trim();
  if (!rawCategory) return 'Other';
  return labels[rawCategory.toLowerCase()] || formatCustomCategory(rawCategory);
}

function getCategoryItemId(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'category';
}

function buildCategoryDonutItems({
  categoryBreakdown,
  group,
  expenses,
  monthKey,
}: {
  categoryBreakdown: SpendAnalyticsSummary['categoryBreakdown'];
  group: Group;
  expenses: Expense[];
  monthKey: string;
}): CategoryDonutItem[] {
  const totalAmount = categoryBreakdown.reduce((sum, item) => sum + item.amount, 0);
  if (totalAmount <= 0) {
    return [];
  }

  const expenseCounts = new Map<string, number>();
  expenses
    .filter(expense => (
      expense.groupId === group.id
      && expense.splitType !== 'payment'
      && expense.category !== 'payment'
      && Number.isFinite(expense.amount)
      && expense.amount > 0
      && getMonthKey(expense.createdAt) === monthKey
    ))
    .forEach(expense => {
      const category = normalizeBreakdownCategory(expense.category);
      expenseCounts.set(category, (expenseCounts.get(category) || 0) + 1);
    });

  const rows = categoryBreakdown
    .filter(item => item.amount > 0)
    .map(item => ({
      label: item.category,
      amount: item.amount,
      expenseCount: expenseCounts.get(item.category) || 0,
    }))
    .sort((a, b) => b.amount - a.amount || a.label.localeCompare(b.label));

  const primaryRows = rows.slice(0, MAX_PRIMARY_CATEGORY_ITEMS).map(row => ({ ...row }));
  const overflowRows = rows.slice(MAX_PRIMARY_CATEGORY_ITEMS);
  if (overflowRows.length > 0) {
    const overflowAmount = overflowRows.reduce((sum, row) => sum + row.amount, 0);
    const overflowExpenseCount = overflowRows.reduce((sum, row) => sum + row.expenseCount, 0);
    const existingOther = primaryRows.find(row => row.label === 'Other');

    if (existingOther) {
      existingOther.amount += overflowAmount;
      existingOther.expenseCount += overflowExpenseCount;
    } else {
      primaryRows.push({
        label: 'Other',
        amount: overflowAmount,
        expenseCount: overflowExpenseCount,
      });
    }
  }

  return primaryRows
    .sort((a, b) => b.amount - a.amount || a.label.localeCompare(b.label))
    .map((row, index) => ({
      id: getCategoryItemId(row.label),
      label: row.label,
      amount: Math.round(row.amount * 100) / 100,
      percentage: Math.round((row.amount / totalAmount) * 100),
      expenseCount: row.expenseCount,
      color: CATEGORY_CHART_COLORS[index % CATEGORY_CHART_COLORS.length],
    }));
}

function buildBasicAnalysisPreview(
  group: Group,
  expenses: Expense[],
  monthKey: string,
): BasicAnalysisPreview {
  const selectedExpenses = expenses
    .filter(expense => expense.groupId === group.id)
    .filter(expense => (
      expense.splitType !== 'payment'
      && expense.category !== 'payment'
      && Number.isFinite(expense.amount)
      && expense.amount > 0
      && getMonthKey(expense.createdAt) === monthKey
    ));
  const categoryTotals = new Map<string, number>();
  let totalSpend = 0;

  selectedExpenses.forEach(expense => {
    const amount = expense.amount;
    const category = normalizePreviewCategory(expense.category);
    totalSpend += amount;
    categoryTotals.set(category, (categoryTotals.get(category) || 0) + amount);
  });

  const topCategory = Array.from(categoryTotals.entries())
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'None';
  const highest = [...selectedExpenses].sort((a, b) => b.amount - a.amount)[0];
  const toPreviewExpense = (expense: Expense | undefined) => expense ? {
    title: expense.description || 'Untitled expense',
    amount: Math.round(expense.amount * 100) / 100,
    category: normalizePreviewCategory(expense.category),
    paidByName: expense.paidBy.name || 'Unknown payer',
  } : null;

  return {
    totalSpend: Math.round(totalSpend * 100) / 100,
    expenseCount: selectedExpenses.length,
    topCategory,
    highestExpense: toPreviewExpense(highest),
  };
}

function buildYearTrendItems({
  group,
  expenses,
  year,
  selectedMonthKey,
  currentMonthKey,
}: {
  group: Group;
  expenses: Expense[];
  year: number;
  selectedMonthKey: string;
  currentMonthKey: string;
}): YearTrendItem[] {
  const totals = new Map<string, number>();

  expenses
    .filter(expense => (
      expense.groupId === group.id
      && expense.splitType !== 'payment'
      && expense.category !== 'payment'
      && Number.isFinite(expense.amount)
      && expense.amount > 0
      && getYearFromMonthKey(getMonthKey(expense.createdAt)) === year
    ))
    .forEach(expense => {
      const expenseMonthKey = getMonthKey(expense.createdAt);
      totals.set(expenseMonthKey, (totals.get(expenseMonthKey) || 0) + expense.amount);
    });

  return Array.from({ length: 12 }, (_, index) => {
    const monthKeyForYear = `${year}-${`${index + 1}`.padStart(2, '0')}`;
    const amount = Math.round((totals.get(monthKeyForYear) || 0) * 100) / 100;

    return {
      monthKey: monthKeyForYear,
      monthLabel: formatTrendMonthLabel(monthKeyForYear),
      amount,
      color: TREND_BAR_COLORS[index % TREND_BAR_COLORS.length],
      isSelectedMonth: monthKeyForYear === selectedMonthKey,
      isFutureMonth: compareMonthKeys(monthKeyForYear, currentMonthKey) > 0,
    };
  });
}

export default function SpendAnalysisScreen({ route, navigation }: SpendAnalysisScreenProps) {
  const { groupId, groupName, monthKey: initialMonthKey } = route.params;
  const { currency, formatAmount } = useCurrency();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { isAiEntitled, isLoading: entitlementLoading } = useAiEntitlement();
  const insets = useSafeAreaInsets();
  const { colors, typography } = theme;
  const styles = useMemo(() => createStyles(colors, typography), [colors, typography]);
  const scrollContentStyle = useMemo(
    () => [
      styles.content,
      {
        paddingTop: STICKY_TAB_AREA_HEIGHT + spacing.md,
        paddingBottom: spacing.huge + spacing.xxxl + insets.bottom,
      },
    ],
    [insets.bottom, styles.content],
  );
  const sortSheetInsetStyle = useMemo(
    () => ({ paddingBottom: Math.max(insets.bottom + spacing.lg, spacing.xxl) }),
    [insets.bottom],
  );

  const [group, setGroup] = useState<Group | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [monthKey, setMonthKey] = useState(initialMonthKey || getCurrentMonthKey());
  const [activeTab, setActiveTab] = useState<AnalysisTab>('overview');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [memberSort, setMemberSort] = useState<MemberSortKey>('netHighToLow');
  const [isMemberSortOpen, setIsMemberSortOpen] = useState(false);
  const [trendYear, setTrendYear] = useState(() => getYearFromMonthKey(initialMonthKey || getCurrentMonthKey()));
  const [selectedTrendMonthKey, setSelectedTrendMonthKey] = useState<string | null>(null);

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
      warnUnlessPermissionDeniedAfterSignOut('Failed to load spend analysis:', error);
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
  const isPremium = isAiEntitled;
  const currentMonthKey = getCurrentMonthKey();
  const groupStartMonthKey = group ? getMonthKey(group.createdAt) : currentMonthKey;
  const minMonthKey = compareMonthKeys(groupStartMonthKey, currentMonthKey) > 0
    ? currentMonthKey
    : groupStartMonthKey;
  const minTrendYear = getYearFromMonthKey(minMonthKey);
  const currentTrendYear = getYearFromMonthKey(currentMonthKey);
  const canGoToPreviousMonth = compareMonthKeys(monthKey, minMonthKey) > 0;
  const canGoToNextMonth = compareMonthKeys(monthKey, currentMonthKey) < 0;
  const isTrendTabActive = activeTab === 'trends';
  const canGoToPreviousTrendYear = trendYear > minTrendYear;
  const canGoToNextTrendYear = trendYear < currentTrendYear;
  const renderHeaderMonthControl = useCallback(() => (
    <HeaderMonthControl
      canGoToNext={isTrendTabActive ? canGoToNextTrendYear : canGoToNextMonth}
      canGoToPrevious={isTrendTabActive ? canGoToPreviousTrendYear : canGoToPreviousMonth}
      colors={colors}
      label={isTrendTabActive ? String(trendYear) : formatCompactMonthLabel(monthKey)}
      onNext={isTrendTabActive
        ? () => setTrendYear(current => Math.min(current + 1, currentTrendYear))
        : () => setMonthKey(current => clampMonthKey(shiftMonth(current, 1), minMonthKey, currentMonthKey))}
      onPrevious={isTrendTabActive
        ? () => setTrendYear(current => Math.max(current - 1, minTrendYear))
        : () => setMonthKey(current => clampMonthKey(shiftMonth(current, -1), minMonthKey, currentMonthKey))}
      styles={styles}
    />
  ), [
    canGoToNextMonth,
    canGoToNextTrendYear,
    canGoToPreviousMonth,
    canGoToPreviousTrendYear,
    colors,
    currentMonthKey,
    currentTrendYear,
    isTrendTabActive,
    minMonthKey,
    minTrendYear,
    monthKey,
    trendYear,
    styles,
  ]);

  useEffect(() => {
    navigation.setOptions({
      title: `${groupName} Analysis`,
      headerRight: renderHeaderMonthControl,
    });
  }, [groupName, navigation, renderHeaderMonthControl]);

  const basicPreview = useMemo<BasicAnalysisPreview | null>(() => {
    if (!group) return null;
    return buildBasicAnalysisPreview(group, expenses, monthKey);
  }, [expenses, group, monthKey]);
  const summary = useMemo<SpendAnalyticsSummary | null>(() => {
    if (!group || !isPremium) return null;
    return calculateSpendAnalytics({ group, expenses, monthKey, currency: groupCurrency });
  }, [expenses, group, groupCurrency, isPremium, monthKey]);
  const categoryDonutItems = useMemo<CategoryDonutItem[]>(() => {
    if (!group || !summary) return [];
    return buildCategoryDonutItems({
      categoryBreakdown: summary.categoryBreakdown,
      group,
      expenses,
      monthKey,
    });
  }, [expenses, group, monthKey, summary]);
  const yearTrendItems = useMemo<YearTrendItem[]>(() => {
    if (!group || !summary) return [];
    return buildYearTrendItems({
      group,
      expenses,
      year: trendYear,
      selectedMonthKey: monthKey,
      currentMonthKey,
    });
  }, [currentMonthKey, expenses, group, monthKey, summary, trendYear]);

  const hasAnySpend = group ? hasSpendHistory(group, expenses) : false;
  const maxTrendAmount = Math.max(...yearTrendItems.map(item => item.amount), 1);
  const trendAxisMax = Math.ceil(maxTrendAmount / 5000) * 5000 || 5000;
  const recordedTrendMonths = yearTrendItems.filter(item => item.amount > 0);
  const highestTrendMonth = recordedTrendMonths
    .slice()
    .sort((a, b) => b.amount - a.amount || a.monthKey.localeCompare(b.monthKey))[0];
  const selectedTrendMonth = yearTrendItems.find(item => item.monthKey === selectedTrendMonthKey)
    || yearTrendItems.find(item => item.monthKey === monthKey)
    || highestTrendMonth
    || yearTrendItems[0];
  const selectedTrendMonthIndex = selectedTrendMonth
    ? yearTrendItems.findIndex(item => item.monthKey === selectedTrendMonth.monthKey)
    : -1;
  const memberBalanceRows = useMemo(() => {
    if (!summary) return [];

    return [...summary.memberStats].sort((a, b) => compareMemberStats(a, b, memberSort));
  }, [memberSort, summary]);
  const maxMemberAbsNet = Math.max(...memberBalanceRows.map(member => Math.abs(member.net)), 0);
  const allMembersSettled = memberBalanceRows.length > 0 && maxMemberAbsNet < 0.005;
  const topCategory = summary?.categoryBreakdown[0]?.category || basicPreview?.topCategory || 'None';
  const highestExpense = summary?.topExpenses[0] || basicPreview?.highestExpense;
  const overviewTotalSpend = summary?.totalSpend ?? basicPreview?.totalSpend ?? 0;
  const overviewExpenseCount = summary?.expenseCount ?? basicPreview?.expenseCount ?? 0;
  const overviewMetrics = [
    {
      label: 'Top category',
      value: topCategory,
      icon: 'pricetag-outline',
    },
    {
      label: 'Highest expense',
      value: highestExpense ? formatAnalyticsCurrency(highestExpense.amount, groupCurrency) : 'None',
      icon: 'trending-up-outline',
    },
    {
      label: 'Expenses',
      value: String(overviewExpenseCount),
      icon: 'receipt-outline',
    },
  ];

  useEffect(() => {
    if (!group) return;
    setMonthKey(current => clampMonthKey(current, minMonthKey, currentMonthKey));
  }, [currentMonthKey, group, minMonthKey]);

  useEffect(() => {
    if (activeTab === 'trends') {
      setTrendYear(getYearFromMonthKey(monthKey));
    }
  }, [activeTab, monthKey]);

  useEffect(() => {
    if (!yearTrendItems.length) {
      setSelectedTrendMonthKey(null);
      return;
    }

    setSelectedTrendMonthKey(current => (
      current && yearTrendItems.some(item => item.monthKey === current)
        ? current
        : (yearTrendItems.find(item => item.monthKey === monthKey)?.monthKey
          || highestTrendMonth?.monthKey
          || yearTrendItems[0].monthKey)
    ));
  }, [highestTrendMonth, monthKey, yearTrendItems]);

  useEffect(() => {
    setSelectedCategoryId(categoryDonutItems[0]?.id ?? null);
  }, [categoryDonutItems]);

  if (loadState === 'loading') {
    return (
      <View style={styles.centerContainer}>
        <StatusBar barStyle="light-content" backgroundColor={colors.background} />
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.loadingText}>Loading spend analysis...</Text>
      </View>
    );
  }

  if (loadState === 'error' || !group || !basicPreview) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={colors.background} />
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
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <View style={styles.stickyTabShell}>
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
                <Text
                  style={[styles.tabLabel, isActive ? styles.tabLabelActive : null]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.82}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={scrollContentStyle}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'overview' && (
          <View style={styles.tabPanel}>
            {summary ? (
              <>
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

                {hasAnySpend && basicPreview.expenseCount === 0 && (
                  <GlassCard style={styles.noticeCard}>
                    <Icon name="calendar-outline" size={22} color={colors.textSecondary} />
                    <View style={styles.noticeCopy}>
                      <Text style={styles.noticeTitle}>No expenses this month</Text>
                      <Text style={styles.noticeText}>Try another month or add a new expense for this group.</Text>
                    </View>
                  </GlassCard>
                )}

                {basicPreview.expenseCount > 0 && basicPreview.expenseCount < 3 && (
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

                <GlassCard style={styles.overviewHeroCard} padding="lg" opacity={0.97}>
                  <View style={styles.overviewHeroHeader}>
                    <View style={styles.overviewHeroBadge}>
                      <Icon name="wallet-outline" size={16} color={colors.primary} />
                    </View>
                    <Text style={styles.overviewHeroLabel} numberOfLines={1}>
                      Total spend in {formatMonthName(monthKey)}
                    </Text>
                  </View>

                  <Text
                    style={styles.overviewHeroAmount}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.72}
                  >
                    {formatAnalyticsCurrency(overviewTotalSpend, groupCurrency)}
                  </Text>
                  <Text style={styles.overviewHeroSubtitle}>{formatMonthLabel(monthKey)}</Text>

                  <View style={styles.overviewMetricList}>
                    {overviewMetrics.map(metric => (
                      <View key={metric.label} style={styles.overviewMetricRow}>
                        <View style={styles.overviewMetricLabelWrap}>
                          <Icon name={metric.icon} size={15} color={colors.textSecondary} />
                          <Text style={styles.overviewMetricLabel} numberOfLines={1}>{metric.label}</Text>
                        </View>
                        <Text
                          style={styles.overviewMetricValue}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.82}
                        >
                          {metric.value}
                        </Text>
                      </View>
                    ))}
                  </View>
                </GlassCard>

                <AnalyticsSection
                  title="Quick Insights"
                  subtitle="Helpful patterns from this month's spending."
                >
                  <GlassCard style={styles.insightCard} padding="md">
                    {summary.deterministicInsights.map(insight => (
                      <View key={insight} style={styles.insightRow}>
                        <Icon name="sparkles-outline" size={17} color={colors.primary} />
                        <Text style={styles.insightText}>{insight}</Text>
                      </View>
                    ))}
                  </GlassCard>
                </AnalyticsSection>
              </>
            ) : (
              <LockedPremiumAnalysisCard
                checkingAccess={entitlementLoading}
                onUpgradePress={() => navigation.navigate('UpgradeAi')}
              />
            )}
          </View>
        )}

        {activeTab === 'categories' && (
          summary ? (
            <View style={styles.tabPanel}>
              <AnalyticsSection
                title="Category Breakdown"
                subtitle="Spending share by category for the selected month."
              >
                {categoryDonutItems.length === 0 ? (
                  <EmptyState
                    icon="pricetag-outline"
                    title="No category data yet"
                    message="Add expenses to see your spending breakdown."
                  />
                ) : (
                  <CategoryDonutChart
                    items={categoryDonutItems}
                    totalAmount={summary.totalSpend}
                    selectedId={selectedCategoryId}
                    onSelect={setSelectedCategoryId}
                    formatAmount={amount => formatAnalyticsCurrency(amount, groupCurrency)}
                  />
                )}
              </AnalyticsSection>
            </View>
          ) : (
            <LockedPremiumAnalysisCard
              checkingAccess={entitlementLoading}
              onUpgradePress={() => navigation.navigate('UpgradeAi')}
            />
          )
        )}

        {activeTab === 'members' && (
          summary ? (
            <View style={styles.tabPanel}>
              <AnalyticsSection
                title="Members Balance Overview"
                subtitle="See who is owed and who still owes."
              >
                {memberBalanceRows.length === 0 ? (
                  <EmptyState
                    icon="people-outline"
                    title="No members to analyze"
                    message="Member analytics appear after this group has members."
                  />
                ) : (
                  <View style={styles.memberBalanceList}>
                    <View style={styles.memberLegendRow}>
                      <View style={styles.memberLegendItem}>
                        <View style={[styles.memberLegendDot, styles.memberLegendDotPositive]} />
                        <Text style={styles.memberLegendText}>Paid</Text>
                      </View>
                      <View style={styles.memberLegendItem}>
                        <View style={[styles.memberLegendDot, styles.memberLegendDotNegative]} />
                        <Text style={styles.memberLegendText}>Share</Text>
                      </View>
                      <View style={styles.memberLegendSpacer} />
                      <TouchableOpacity
                        style={styles.memberSortButton}
                        accessibilityRole="button"
                        accessibilityLabel={`Sort members, current sort ${getMemberSortLabel(memberSort)}`}
                        onPress={() => setIsMemberSortOpen(true)}
                      >
                        <Icon name="swap-vertical-outline" size={15} color={colors.primary} />
                        <Text style={styles.memberSortButtonText}>Sort</Text>
                      </TouchableOpacity>
                      <Text style={styles.memberLegendHelp} numberOfLines={1}>
                        Balance is shown on the right.
                      </Text>
                    </View>

                    {allMembersSettled && (
                      <View style={styles.memberSettledBanner}>
                        <Icon name="checkmark-circle-outline" size={17} color={colors.owed} />
                        <Text style={styles.memberSettledText}>Everyone is balanced for this month.</Text>
                      </View>
                    )}

                    {memberBalanceRows.map(member => {
                      const isPositive = member.net > 0.005;
                      const isNegative = member.net < -0.005;
                      const comparisonTotal = member.paid + member.owedShare;
                      const paidPercent = comparisonTotal > 0 && member.paid > 0
                        ? (member.paid / comparisonTotal) * 100
                        : 0;
                      const sharePercent = comparisonTotal > 0 && member.owedShare > 0
                        ? (member.owedShare / comparisonTotal) * 100
                        : 0;
                      const amountColor = isPositive ? colors.owed : isNegative ? colors.owes : colors.textSecondary;
                      const amountLabel = isPositive || isNegative
                        ? formatSignedCurrency(member.net, groupCurrency)
                        : 'Settled';

                      return (
                        <GlassCard key={member.uid} style={styles.memberBalanceRow} padding="sm">
                          <View style={styles.memberBalanceTopLine}>
                            <Text style={styles.memberBalanceName} numberOfLines={1}>{member.displayName}</Text>
                            <Text
                              style={[styles.memberBalanceAmount, { color: amountColor }]}
                              numberOfLines={1}
                              adjustsFontSizeToFit
                              minimumFontScale={0.82}
                            >
                              {amountLabel}
                            </Text>
                          </View>

                          <View style={styles.memberBalanceTrack}>
                            <View
                              style={[
                                styles.memberBalanceBar,
                                styles.memberBalanceBarPaid,
                                { width: `${paidPercent}%` },
                              ]}
                            />
                            <View
                              style={[
                                styles.memberBalanceBar,
                                styles.memberBalanceBarShare,
                                { width: `${sharePercent}%` },
                              ]}
                            />
                          </View>

                          <View style={styles.memberBalanceMetaRow}>
                            <Text style={styles.memberBalancePaidMeta} numberOfLines={1}>
                              Paid {formatAmount(member.paid, { currency: groupCurrency })}
                            </Text>
                            <Text style={styles.memberBalanceShareMeta} numberOfLines={1}>
                              Share {formatAmount(member.owedShare, { currency: groupCurrency })}
                            </Text>
                          </View>
                        </GlassCard>
                      );
                    })}
                  </View>
                )}
              </AnalyticsSection>
            </View>
          ) : (
            <LockedPremiumAnalysisCard
              checkingAccess={entitlementLoading}
              onUpgradePress={() => navigation.navigate('UpgradeAi')}
            />
          )
        )}

        {activeTab === 'trends' && (
          summary ? (
            <View style={styles.tabPanel}>
              <AnalyticsSection
                title="Monthly Trend"
                subtitle={`Spending across months in ${trendYear}.`}
              >
                <GlassCard style={styles.yearTrendCard} padding="md">
                  <View style={styles.yearTrendSummaryRow}>
                    <View>
                      <Text style={styles.yearTrendSummaryLabel}>Highest month</Text>
                      <Text style={styles.yearTrendSummaryValue}>
                        {highestTrendMonth ? highestTrendMonth.monthLabel : 'No spend yet'}
                      </Text>
                    </View>
                    <Text
                      style={styles.yearTrendSummaryAmount}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.78}
                    >
                      {highestTrendMonth
                        ? formatAnalyticsCurrency(highestTrendMonth.amount, groupCurrency)
                        : formatAnalyticsCurrency(0, groupCurrency)}
                    </Text>
                  </View>

                  <View style={styles.yearTrendChartArea}>
                    <View style={styles.yearTrendYAxis}>
                      <Text style={styles.yearTrendAxisLabel}>
                        {formatCompactAxisAmount(trendAxisMax)}
                      </Text>
                      <Text style={styles.yearTrendAxisLabel}>
                        {formatCompactAxisAmount(trendAxisMax / 2)}
                      </Text>
                      <Text style={styles.yearTrendAxisLabel}>
                        0
                      </Text>
                    </View>

                    <View style={styles.yearTrendPlot}>
                      <View style={styles.yearTrendGridLineTop} />
                      <View style={styles.yearTrendGridLineMiddle} />
                      <View style={styles.yearTrendBarsRow}>
                        {yearTrendItems.map(item => {
                          const barHeightPercent = item.amount > 0
                            ? Math.max((item.amount / trendAxisMax) * 100, 5)
                            : 0;
                          const isSelected = item.monthKey === selectedTrendMonth?.monthKey;
                          const isHighlighted = isSelected || item.isSelectedMonth || item.monthKey === currentMonthKey;

                          return (
                            <TouchableOpacity
                              key={item.monthKey}
                              style={styles.yearTrendBarColumn}
                              accessibilityRole="button"
                              accessibilityLabel={`${item.monthLabel} ${trendYear}, ${formatAnalyticsCurrency(item.amount, groupCurrency)}`}
                              onPress={() => setSelectedTrendMonthKey(item.monthKey)}
                              activeOpacity={0.78}
                            >
                              <View style={styles.yearTrendBarSlot}>
                                <View
                                  style={[
                                    styles.yearTrendBarFill,
                                    {
                                      backgroundColor: item.color,
                                      height: `${barHeightPercent}%`,
                                    },
                                    isHighlighted ? styles.yearTrendBarFillActive : null,
                                    item.isFutureMonth ? styles.yearTrendBarFillMuted : null,
                                  ]}
                                />
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                      {selectedTrendMonth && selectedTrendMonthIndex >= 0 ? (
                        <View
                          pointerEvents="none"
                          style={[
                            styles.yearTrendTooltip,
                            selectedTrendMonthIndex <= 1
                              ? styles.yearTrendTooltipStart
                              : selectedTrendMonthIndex >= yearTrendItems.length - 2
                                ? styles.yearTrendTooltipEnd
                                : [
                                  styles.yearTrendTooltipCentered,
                                  { left: `${((selectedTrendMonthIndex + 0.5) / yearTrendItems.length) * 100}%` },
                                ],
                          ]}
                        >
                          <Text
                            style={styles.yearTrendTooltipText}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.72}
                          >
                            {formatAnalyticsCurrency(selectedTrendMonth.amount, groupCurrency)}
                          </Text>
                          <View style={styles.yearTrendTooltipCaret} />
                        </View>
                      ) : null}
                      <View style={styles.yearTrendMonthRow}>
                        {yearTrendItems.map(item => {
                          const isSelected = item.monthKey === selectedTrendMonth?.monthKey;
                          const isHighlighted = isSelected || item.isSelectedMonth || item.monthKey === currentMonthKey;

                          return (
                            <Text
                              key={item.monthKey}
                              style={[
                                styles.yearTrendMonthLabel,
                                isHighlighted ? styles.yearTrendMonthLabelActive : null,
                                item.isFutureMonth ? styles.yearTrendMonthLabelMuted : null,
                              ]}
                              numberOfLines={1}
                            >
                              {item.monthLabel}
                            </Text>
                          );
                        })}
                      </View>
                    </View>
                  </View>
                </GlassCard>
              </AnalyticsSection>
            </View>
          ) : (
            <LockedPremiumAnalysisCard
              checkingAccess={entitlementLoading}
              onUpgradePress={() => navigation.navigate('UpgradeAi')}
            />
          )
        )}

        {activeTab === 'ai' && (
          <AiInsightsSection
            groupId={groupId}
            monthKey={monthKey}
            hasMonthlyExpenses={isPremium ? (summary?.expenseCount ?? 0) > 0 : false}
            isSmallDataSet={isPremium ? (summary?.expenseCount ?? 0) > 0 && (summary?.expenseCount ?? 0) < 3 : false}
            summary={isPremium ? summary : null}
            expenses={isPremium ? expenses : undefined}
            currentUserId={isPremium ? user?.id : undefined}
            groupCurrency={isPremium ? groupCurrency : currency}
            onUpgradePress={() => navigation.navigate('UpgradeAi')}
          />
        )}
      </ScrollView>
      <Modal
        animationType="fade"
        transparent
        statusBarTranslucent
        navigationBarTranslucent
        visible={isMemberSortOpen}
        onRequestClose={() => setIsMemberSortOpen(false)}
      >
        <View style={styles.sortModalBackdrop}>
          <TouchableOpacity
            style={styles.sortModalDismissArea}
            accessibilityRole="button"
            accessibilityLabel="Close member sort options"
            activeOpacity={1}
            onPress={() => setIsMemberSortOpen(false)}
          />
          <View style={[styles.sortSheet, sortSheetInsetStyle]}>
            <View style={styles.sortSheetHeader}>
              <Text style={styles.sortSheetTitle}>Sort members</Text>
              <TouchableOpacity
                style={styles.sortCloseButton}
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={() => setIsMemberSortOpen(false)}
              >
                <Icon name="close" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.sortOptionList}>
              {MEMBER_SORT_OPTIONS.map(option => {
                const isSelected = option.key === memberSort;
                return (
                  <TouchableOpacity
                    key={option.key}
                    style={[styles.sortOptionRow, isSelected ? styles.sortOptionRowActive : null]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => {
                      setMemberSort(option.key);
                      setIsMemberSortOpen(false);
                    }}
                  >
                    <Text style={[styles.sortOptionText, isSelected ? styles.sortOptionTextActive : null]}>
                      {option.label}
                    </Text>
                    {isSelected ? <Icon name="checkmark" size={18} color={colors.primary} /> : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  header: {
    gap: spacing.xs,
  },
  title: {},
  subtitle: {},
});

const createLockedStyles = (colors: ThemeColors, typography: ThemeTypography) => StyleSheet.create({
  card: {
    gap: spacing.md,
    backgroundColor: colors.surfaceContainer,
    borderColor: colors.borderLight,
  },
  badge: {
    alignSelf: 'flex-start',
    minHeight: 26,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.primaryLight,
  },
  badgeText: {
    ...typography.small,
    color: colors.primary,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  copy: {
    gap: spacing.xs,
  },
  title: {
    ...typography.heading3,
  },
  subtitle: {
    ...typography.caption,
  },
  benefitRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  benefitChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 30,
    maxWidth: '100%',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
  },
  chipDot: {
    width: 5,
    height: 5,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
  },
  benefitText: {
    ...typography.small,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  cta: {
    alignSelf: 'stretch',
    marginTop: spacing.xs,
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.huge,
    gap: spacing.lg,
  },
  stickyTabShell: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: STICKY_TAB_AREA_HEIGHT,
    zIndex: 10,
    elevation: 8,
    justifyContent: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  scrollArea: {
    flex: 1,
  },
  headerMonthPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 32,
    maxWidth: 150,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceContainerHigh,
    paddingHorizontal: spacing.xs,
    gap: 2,
  },
  headerMonthStepButton: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerMonthStepButtonDisabled: {
    opacity: 0.45,
  },
  headerMonthLabel: {
    ...typography.captionBold,
    maxWidth: 82,
    textAlign: 'center',
    color: colors.textPrimary,
    includeFontPadding: false,
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
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
    gap: 2,
  },
  tabButton: {
    flex: 1,
    minWidth: 0,
    minHeight: 36,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
    paddingVertical: spacing.xs,
  },
  tabButtonActive: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  tabLabel: {
    ...typography.small,
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 14,
    flexShrink: 1,
    maxWidth: '100%',
    includeFontPadding: false,
  },
  tabLabelActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  tabPanel: {
    gap: spacing.xxl,
  },
  overviewHeroCard: {
    gap: spacing.sm,
    backgroundColor: colors.surfaceContainer,
    borderColor: colors.borderLight,
  },
  overviewHeroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  overviewHeroBadge: {
    width: 30,
    height: 30,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
  },
  overviewHeroLabel: {
    ...typography.captionBold,
    flex: 1,
    color: colors.textSecondary,
  },
  overviewHeroAmount: {
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 36,
    letterSpacing: 0,
    color: colors.textPrimary,
    includeFontPadding: false,
  },
  overviewHeroSubtitle: {
    ...typography.small,
    color: colors.textTertiary,
  },
  overviewMetricList: {
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  overviewMetricRow: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  overviewMetricLabelWrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  overviewMetricLabel: {
    ...typography.caption,
    flexShrink: 1,
    color: colors.textSecondary,
  },
  overviewMetricValue: {
    ...typography.bodyBold,
    maxWidth: '54%',
    textAlign: 'right',
    includeFontPadding: false,
  },
  memberBalanceList: {
    gap: spacing.md,
  },
  memberSortButton: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
  },
  memberSortButtonText: {
    ...typography.small,
    color: colors.primary,
    fontWeight: '700',
  },
  memberLegendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: spacing.md,
    rowGap: spacing.xs,
  },
  memberLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  memberLegendDot: {
    width: 8,
    height: 8,
    borderRadius: borderRadius.full,
  },
  memberLegendDotPositive: {
    backgroundColor: colors.owed,
  },
  memberLegendDotNegative: {
    backgroundColor: colors.owes,
  },
  memberLegendText: {
    ...typography.small,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  memberLegendSpacer: {
    flex: 1,
    minWidth: spacing.xs,
  },
  memberLegendHelp: {
    ...typography.small,
    flexBasis: '100%',
    color: colors.textTertiary,
  },
  memberSettledBanner: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.owed,
    backgroundColor: colors.owedLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  memberSettledText: {
    ...typography.caption,
    flex: 1,
    color: colors.owed,
    fontWeight: '600',
  },
  memberBalanceRow: {
    gap: spacing.xs,
    backgroundColor: colors.surfaceContainer,
    borderColor: colors.borderLight,
  },
  memberBalanceTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  memberBalanceName: {
    ...typography.bodyBold,
    flex: 1,
    minWidth: 0,
  },
  memberBalanceAmount: {
    ...typography.captionBold,
    minWidth: 92,
    maxWidth: 116,
    textAlign: 'right',
    includeFontPadding: false,
  },
  memberBalanceTrack: {
    width: '100%',
    height: 10,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceContainerHighest,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  memberBalanceBar: {
    height: 10,
  },
  memberBalanceBarPaid: {
    backgroundColor: colors.owed,
  },
  memberBalanceBarShare: {
    backgroundColor: colors.owes,
  },
  memberBalanceMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  memberBalancePaidMeta: {
    ...typography.small,
    flex: 1,
    minWidth: 0,
    color: colors.textTertiary,
  },
  memberBalanceShareMeta: {
    ...typography.small,
    flex: 1,
    minWidth: 0,
    color: colors.textTertiary,
    textAlign: 'right',
  },
  sortModalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.48)',
  },
  sortModalDismissArea: {
    flex: 1,
  },
  sortSheet: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceContainer,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  sortSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sortSheetTitle: {
    ...typography.heading3,
  },
  sortCloseButton: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceContainerHigh,
  },
  sortOptionList: {
    gap: spacing.xs,
  },
  sortOptionRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  sortOptionRowActive: {
    backgroundColor: colors.primaryLight,
  },
  sortOptionText: {
    ...typography.body,
    flex: 1,
    color: colors.textSecondary,
  },
  sortOptionTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  rowCard: {
    gap: spacing.md,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  rowTitle: {
    ...typography.bodyBold,
  },
  rowAmount: {
    ...typography.bodyBold,
    textAlign: 'right',
    flexShrink: 0,
    minWidth: 108,
    includeFontPadding: false,
  },
  rowMeta: {
    ...typography.caption,
    marginTop: spacing.sm,
  },
  barTrack: {
    height: 10,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceContainerHighest,
    overflow: 'hidden',
    marginTop: spacing.lg,
  },
  barFill: {
    height: '100%',
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
  },
  memberNameWrap: {
    flex: 1,
    minWidth: 0,
  },
  memberNet: {
    ...typography.bodyBold,
    textAlign: 'right',
    flexShrink: 0,
    minWidth: 108,
    includeFontPadding: false,
  },
  trendCard: {
    gap: spacing.md,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 36,
  },
  trendMonth: {
    ...typography.captionBold,
    width: 42,
    flexShrink: 0,
  },
  trendTrack: {
    flex: 1,
    minWidth: 48,
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
    width: 112,
    flexShrink: 0,
    textAlign: 'right',
    includeFontPadding: false,
  },
  yearTrendCard: {
    gap: spacing.lg,
    backgroundColor: colors.surfaceContainer,
    borderColor: colors.borderLight,
  },
  yearTrendSummaryRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  yearTrendSummaryLabel: {
    ...typography.small,
    color: colors.textTertiary,
  },
  yearTrendSummaryValue: {
    ...typography.bodyBold,
    marginTop: 2,
    color: colors.textPrimary,
  },
  yearTrendSummaryAmount: {
    ...typography.heading3,
    maxWidth: '58%',
    textAlign: 'right',
    color: colors.primary,
    includeFontPadding: false,
  },
  yearTrendChartArea: {
    minHeight: 220,
    flexDirection: 'row',
    gap: spacing.xs,
  },
  yearTrendYAxis: {
    width: 28,
    justifyContent: 'space-between',
    paddingTop: spacing.xs,
    paddingBottom: 18,
  },
  yearTrendAxisLabel: {
    ...typography.small,
    color: colors.textTertiary,
    textAlign: 'right',
  },
  yearTrendPlot: {
    flex: 1,
    minWidth: 0,
    position: 'relative',
    paddingTop: spacing.xs,
  },
  yearTrendGridLineTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: spacing.xs,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  yearTrendGridLineMiddle: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '48%',
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  yearTrendBarsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 0,
  },
  yearTrendBarColumn: {
    flex: 1,
    height: '100%',
    minWidth: 0,
    alignItems: 'center',
    position: 'relative',
  },
  yearTrendBarSlot: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    backgroundColor: colors.surfaceContainerHighest,
    overflow: 'hidden',
  },
  yearTrendBarFill: {
    width: '100%',
    minHeight: 0,
  },
  yearTrendBarFillActive: {
    opacity: 1,
  },
  yearTrendBarFillMuted: {
    opacity: 0.28,
  },
  yearTrendTooltip: {
    position: 'absolute',
    top: spacing.sm,
    zIndex: 4,
    width: TREND_TOOLTIP_WIDTH,
    minHeight: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.surfaceContainerHigh,
    paddingHorizontal: spacing.xs,
    elevation: 8,
  },
  yearTrendTooltipStart: {
    left: spacing.xs,
  },
  yearTrendTooltipEnd: {
    right: spacing.xs,
  },
  yearTrendTooltipCentered: {
    transform: [{ translateX: -TREND_TOOLTIP_WIDTH / 2 }],
  },
  yearTrendTooltipText: {
    ...typography.small,
    color: colors.textPrimary,
    fontWeight: '800',
    textAlign: 'center',
    includeFontPadding: false,
  },
  yearTrendTooltipCaret: {
    position: 'absolute',
    bottom: -4,
    width: 8,
    height: 8,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.surfaceContainerHigh,
    transform: [{ rotate: '45deg' }],
  },
  yearTrendMonthRow: {
    height: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  yearTrendMonthLabel: {
    ...typography.small,
    fontSize: 9,
    lineHeight: 12,
    flex: 1,
    minWidth: 0,
    color: colors.textSecondary,
    textAlign: 'center',
    includeFontPadding: false,
  },
  yearTrendMonthLabelActive: {
    color: colors.primary,
    fontWeight: '800',
  },
  yearTrendMonthLabelMuted: {
    color: colors.textTertiary,
    opacity: 0.65,
  },
  expenseAmountWrap: {
    alignItems: 'flex-end',
    flexShrink: 0,
    minWidth: 112,
  },
  largestExpenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 42,
  },
  largestExpenseInfo: {
    flex: 1,
    minWidth: 0,
    paddingRight: spacing.xs,
  },
  largestExpenseMeta: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  largestExpenseAmountColumn: {
    minWidth: 118,
    maxWidth: 134,
    flexShrink: 0,
    alignItems: 'flex-end',
  },
  largestExpenseAmount: {
    ...typography.bodyBold,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'right',
    includeFontPadding: false,
  },
  largestExpenseDate: {
    ...typography.small,
    marginTop: 2,
    textAlign: 'right',
  },
  insightCard: {
    gap: spacing.lg,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  insightText: {
    ...typography.body,
    flex: 1,
  },
});
