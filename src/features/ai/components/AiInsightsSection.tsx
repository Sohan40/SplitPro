import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Button from '../../../components/Button';
import GlassCard from '../../../components/GlassCard';
import { borderRadius, spacing, type ThemeColors, type ThemeTypography } from '../../../components/theme';
import { useTheme } from '../../../context/ThemeContext';
import type { Expense } from '../../../models/Expense';
import {
  formatCurrency,
  getMonthKey,
  type SpendAnalyticsSummary,
} from '../../analytics/calculateSpendAnalytics';
import { useAiEntitlement } from '../hooks/useAiEntitlement';
import {
  AiInsightRequestError,
  requestSpendInsight,
} from '../services/requestSpendInsight';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type {
  AiFeature,
  AiGroupHealth,
  AiHealthLabel,
  AiInsight,
  AiRequestErrorCode,
  AiUsageSnapshot,
  RequestSpendInsightResult,
} from '../types';

type AiInsightsSectionProps = {
  groupId: string;
  monthKey: string;
  hasMonthlyExpenses: boolean;
  isSmallDataSet: boolean;
  onUpgradePress: () => void;
  summary?: SpendAnalyticsSummary | null;
  expenses?: Expense[];
  currentUserId?: string;
  groupCurrency?: string;
};

type FriendlyError = {
  message: string;
  showUpgrade: boolean;
};

type MyInsights = {
  rows: Array<{
    label: string;
    value: string;
    tone?: 'positive' | 'negative' | 'neutral';
  }>;
  suggestion?: string;
  limitedReason?: string;
};

type AiDetailPanel = 'health' | 'my' | 'monthly' | 'settlement' | 'budget' | 'ask';

type AskResponse = {
  question: string;
  answer: string;
  cached: boolean;
};

const QUESTION_LIMIT = 300;
const CATEGORY_LABELS: Record<string, string> = {
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
  payment: 'Other',
};

function formatRemaining(usage?: AiUsageSnapshot | null, fallback?: number | null): string {
  if (usage) {
    return `${usage.remaining ?? Math.max(usage.limit - usage.used, 0)} of ${usage.limit} credits left`;
  }

  if (fallback !== null && fallback !== undefined) {
    return `${fallback} credits left`;
  }

  return 'Credits update after generation';
}

function getFriendlyError(error: unknown): FriendlyError {
  const code: AiRequestErrorCode = error instanceof AiInsightRequestError ? error.code : 'internal';

  switch (code) {
    case 'unauthenticated':
      return { message: 'Please sign in again to request AI insights.', showUpgrade: false };
    case 'permission-denied':
    case 'failed-precondition':
      return { message: 'AI access is locked for this account. Upgrade to SplitPro AI to continue.', showUpgrade: true };
    case 'resource-exhausted':
      return { message: 'Monthly AI limit reached. Try again after your credits reset.', showUpgrade: false };
    case 'invalid-argument':
      return { message: 'Check your question and try again.', showUpgrade: false };
    case 'unavailable':
      return { message: 'Network error. Please check your connection and retry.', showUpgrade: false };
    default:
      return { message: 'AI insight could not be generated right now. Please try again.', showUpgrade: false };
  }
}

function getHealthLabel(score: number): AiHealthLabel {
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Needs attention';
  return 'Unbalanced';
}

function buildGroupHealth(summary?: SpendAnalyticsSummary | null): AiGroupHealth | null {
  if (!summary) return null;

  let score = 100;
  const tips: string[] = [];
  const totalAbsNet = summary.memberStats.reduce((sum, member) => sum + Math.abs(member.net), 0);
  const topCategory = summary.categoryBreakdown[0];
  const topCategoryShare = topCategory?.percentage ?? 0;
  const topPaid = Math.max(...summary.memberStats.map(member => member.paid), 0);
  const topPayerShare = summary.totalSpend > 0 ? Math.round((topPaid / summary.totalSpend) * 100) : 0;
  const activeMembers = summary.memberStats.filter(member => member.paid > 0 || member.owedShare > 0).length;
  const participationShare = summary.memberStats.length > 0
    ? Math.round((activeMembers / summary.memberStats.length) * 100)
    : 0;
  const settlementLoad = summary.totalSpend > 0
    ? Math.round((totalAbsNet / (summary.totalSpend * 2)) * 100)
    : 0;

  if (settlementLoad > 35) {
    score -= 20;
    tips.push('Consider settling the largest open balances before adding many more expenses.');
  } else if (settlementLoad > 18) {
    score -= 10;
    tips.push('A quick settlement round could keep balances easier to manage.');
  }

  if (topPayerShare > 70) {
    score -= 15;
    tips.push('Try rotating who pays so one person does not carry most expenses.');
  } else if (topPayerShare > 50) {
    score -= 8;
    tips.push('One member is paying a lot, so settling sooner may help the group feel balanced.');
  }

  if (topCategoryShare >= 60) {
    score -= 15;
    tips.push(`Review ${topCategory?.category || 'the top category'} because it makes up most of this month's spend.`);
  } else if (topCategoryShare >= 40) {
    score -= 8;
    tips.push(`Keep an eye on ${topCategory?.category || 'the top category'} next month.`);
  }

  if (participationShare < 50 && summary.memberStats.length > 1) {
    score -= 10;
    tips.push('Some members have little activity this month; check whether all shared expenses were recorded.');
  } else if (participationShare < 75 && summary.memberStats.length > 2) {
    score -= 5;
  }

  if (summary.expenseCount < 3) {
    score -= 15;
    tips.push('Add a few more expenses before treating these patterns as reliable.');
  } else if (summary.expenseCount < 6) {
    score -= 8;
    tips.push('More expense entries will make the monthly pattern clearer.');
  }

  const boundedScore = Math.max(35, Math.min(100, Math.round(score)));
  const defaultTips = [
    'Keep categories clean so future insights are easier to understand.',
    'Settle balances regularly so the group stays simple.',
    'Use this as a SplitPro app insight, not financial advice.',
  ];

  return {
    score: boundedScore,
    label: getHealthLabel(boundedScore),
    explanation: 'SplitPro Health Score is an app insight based on settlement cleanliness, payment spread, category concentration, participation, and tracking volume. It is not financial advice.',
    tips: [...tips, ...defaultTips].slice(0, 3),
  };
}

function normalizeCategoryLabel(category?: string): string {
  return CATEGORY_LABELS[String(category || '').toLowerCase()] || 'Other';
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function cleanText(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function cleanList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map(item => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
}

function normalizeHealth(value: unknown, fallback: AiGroupHealth | null): AiGroupHealth {
  const raw = asRecord(value);
  const score = Number(raw.score);
  const tips = cleanList(raw.tips).slice(0, 3);

  if (Number.isFinite(score) && cleanText(raw.explanation) && tips.length > 0) {
    const boundedScore = Math.max(0, Math.min(100, Math.round(score)));
    return {
      score: boundedScore,
      label: ['Excellent', 'Good', 'Needs attention', 'Unbalanced'].includes(cleanText(raw.label))
        ? cleanText(raw.label) as AiHealthLabel
        : getHealthLabel(boundedScore),
      explanation: cleanText(raw.explanation),
      tips,
    };
  }

  return fallback || {
    score: 60,
    label: 'Needs attention',
    explanation: 'SplitPro Health Score is an app insight based on group expense patterns. It is not financial advice.',
    tips: [
      'Add more expenses for clearer patterns.',
      'Settle balances regularly so the group stays simple.',
    ],
  };
}

function buildFallbackKeyInsights(summary?: SpendAnalyticsSummary | null, currency = 'INR') {
  const topCategory = summary?.categoryBreakdown[0];
  const topPayer = summary?.memberStats.slice().sort((a, b) => b.paid - a.paid)[0];
  const topCategoryName = topCategory?.category || 'the top category';
  const topCategoryShare = topCategory?.percentage ?? 0;

  return {
    category: topCategory
      ? `${topCategoryName} is the biggest category at about ${topCategoryShare}% of this month's spend.`
      : 'No clear category pattern is available yet.',
    concentration: topCategoryShare >= 40
      ? `Spending is concentrated in ${topCategoryName}, so consider reviewing that category first.`
      : 'Spending is not heavily concentrated in one category based on current group data.',
    memberPayment: topPayer && topPayer.paid > 0
      ? `${topPayer.displayName} paid the most this month with ${formatCurrency(topPayer.paid, currency)} recorded.`
      : 'No single payer pattern is strong enough to highlight yet.',
  };
}

function buildFallbackSettlement(summary?: SpendAnalyticsSummary | null, currency = 'INR'): string[] {
  const debtor = summary?.memberStats.slice().sort((a, b) => a.net - b.net)[0];
  const creditor = summary?.memberStats.slice().sort((a, b) => b.net - a.net)[0];

  if (debtor && creditor && debtor.net < -0.005 && creditor.net > 0.005) {
    const amount = Math.min(Math.abs(debtor.net), creditor.net);
    return [
      `${debtor.displayName} could consider settling about ${formatCurrency(amount, currency)} with ${creditor.displayName}.`,
    ];
  }

  return ['Review current balances in SplitPro before recording a settlement.'];
}

function buildFallbackBudget(summary?: SpendAnalyticsSummary | null, currency = 'INR'): string[] {
  const topCategory = summary?.categoryBreakdown[0]?.category || 'the top category';
  const totalSpend = summary?.totalSpend ?? 0;

  if (totalSpend <= 0) {
    return ['Consider adding more expenses before using this month as a suggested budget reference.'];
  }

  return [
    `Consider using ${formatCurrency(totalSpend, currency)} as a suggested reference for a similar group month.`,
    `Based on current group data, consider watching ${topCategory} next month.`,
  ];
}

function normalizeInsightForDisplay({
  fallbackHealth,
  result,
  summary,
  currency,
}: {
  fallbackHealth: AiGroupHealth | null;
  result: RequestSpendInsightResult;
  summary?: SpendAnalyticsSummary | null;
  currency: string;
}): RequestSpendInsightResult {
  const raw = asRecord(result.structured as unknown);
  const rawKeyInsights = asRecord(raw.keyInsights);
  const legacyKeyInsights = cleanList(raw.keyInsights);
  const legacyPatterns = cleanList(raw.unusualPatterns);
  const legacyMemberInsights = cleanList(raw.memberInsights);
  const legacyBullets = cleanList(raw.bullets);
  const fallbackKeyInsights = buildFallbackKeyInsights(summary, currency);
  const aiSummary = cleanText(
    raw.aiSummary,
    cleanText(
      raw.summary,
      summary
        ? `This group recorded ${summary.expenseCount} expenses totaling ${formatCurrency(summary.totalSpend, currency)} this month.`
        : 'SplitPro generated a structured insight for this month.',
    ),
  );
  const structured: AiInsight = {
    title: cleanText(raw.title, 'SplitPro AI insight'),
    summary: aiSummary,
    aiSummary,
    groupHealth: normalizeHealth(raw.groupHealth, fallbackHealth),
    keyInsights: {
      category: cleanText(
        rawKeyInsights.category,
        legacyKeyInsights[0] || legacyBullets[0] || fallbackKeyInsights.category,
      ),
      concentration: cleanText(
        rawKeyInsights.concentration,
        legacyPatterns[0] || legacyKeyInsights[1] || legacyBullets[1] || fallbackKeyInsights.concentration,
      ),
      memberPayment: cleanText(
        rawKeyInsights.memberPayment,
        legacyMemberInsights[0] || legacyKeyInsights[2] || legacyBullets[2] || fallbackKeyInsights.memberPayment,
      ),
    },
    settlementSuggestions: cleanList(raw.settlementSuggestions).length > 0
      ? cleanList(raw.settlementSuggestions)
      : buildFallbackSettlement(summary, currency),
    budgetSuggestions: cleanList(raw.budgetSuggestions).length > 0
      ? cleanList(raw.budgetSuggestions)
      : buildFallbackBudget(summary, currency),
    warnings: cleanList(raw.warnings),
    limitedDataWarning: cleanText(raw.limitedDataWarning) || undefined,
  };

  return {
    ...result,
    content: result.content || structured.aiSummary || structured.summary,
    structured,
  };
}

function buildMyInsights({
  currentUserId,
  expenses,
  summary,
  currency,
}: {
  currentUserId?: string;
  expenses?: Expense[];
  summary?: SpendAnalyticsSummary | null;
  currency: string;
}): MyInsights | null {
  if (!currentUserId || !summary || !expenses) {
    return null;
  }

  const myStats = summary.memberStats.find(member => member.uid === currentUserId);
  if (!myStats) {
    return {
      rows: [],
      limitedReason: 'Your member analytics are not available for this month yet.',
    };
  }

  const monthlyExpenses = expenses.filter(expense => (
    expense.groupId === summary.groupId
    && expense.splitType !== 'payment'
    && expense.category !== 'payment'
    && Number.isFinite(expense.amount)
    && expense.amount > 0
    && getMonthKey(expense.createdAt) === summary.monthKey
  ));

  const myCategoryTotals = new Map<string, number>();
  monthlyExpenses.forEach(expense => {
    const myShare = expense.participants.find(participant => participant.uid === currentUserId)?.amount;
    const numericShare = Number(myShare);
    if (!Number.isFinite(numericShare) || numericShare <= 0) return;
    const category = normalizeCategoryLabel(expense.category);
    myCategoryTotals.set(category, (myCategoryTotals.get(category) || 0) + numericShare);
  });

  const topCategory = Array.from(myCategoryTotals.entries())
    .sort((a, b) => b[1] - a[1])[0];
  const largestPaidExpense = monthlyExpenses
    .filter(expense => expense.paidBy.uid === currentUserId)
    .sort((a, b) => b.amount - a.amount)[0];
  const topCreditor = [...summary.memberStats].sort((a, b) => b.net - a.net)[0];
  const topDebtor = [...summary.memberStats].sort((a, b) => a.net - b.net)[0];
  const balanceTone = myStats.net > 0.005 ? 'positive' : myStats.net < -0.005 ? 'negative' : 'neutral';
  let balanceText = 'You are settled for this month.';
  let suggestion = 'Suggested action: keep balances reviewed as new expenses are added.';

  if (myStats.net < -0.005) {
    balanceText = `You currently owe ${formatCurrency(Math.abs(myStats.net), currency)}.`;
    suggestion = topCreditor && topCreditor.uid !== currentUserId
      ? `Suggested action: consider settling ${formatCurrency(Math.abs(myStats.net), currency)} to ${topCreditor.displayName}.`
      : `Suggested action: consider settling ${formatCurrency(Math.abs(myStats.net), currency)} against your largest open balance.`;
  } else if (myStats.net > 0.005) {
    balanceText = `You are owed ${formatCurrency(myStats.net, currency)}.`;
    suggestion = topDebtor && topDebtor.uid !== currentUserId
      ? `Suggested action: ${topDebtor.displayName} may need to settle with you when the group is ready.`
      : 'Suggested action: check who can settle the largest open balance with you.';
  }

  const rows: MyInsights['rows'] = [
    { label: 'You paid', value: formatCurrency(myStats.paid, currency) },
    { label: 'Your share', value: formatCurrency(myStats.owedShare, currency) },
    { label: 'Balance', value: balanceText, tone: balanceTone },
  ];

  if (topCategory) {
    rows.push({
      label: 'Your top category',
      value: `${topCategory[0]} - ${formatCurrency(topCategory[1], currency)}`,
    });
  }

  if (largestPaidExpense) {
    rows.push({
      label: 'Largest paid by you',
      value: `${largestPaidExpense.description || 'Untitled expense'} - ${formatCurrency(largestPaidExpense.amount, currency)}`,
    });
  }

  if (rows.length <= 3 && myStats.paid <= 0 && myStats.owedShare <= 0) {
    return {
      rows,
      limitedReason: 'No personal expense activity is recorded for you in this month yet.',
    };
  }

  return {
    rows,
    suggestion,
  };
}

function InsightPill({
  icon,
  title,
  text,
  styles,
}: {
  icon: string;
  title: string;
  text: string;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.insightPill}>
      <Icon name={icon} size={17} color={styles.tokens.primary} />
      <View style={styles.insightPillCopy}>
        <Text style={styles.insightPillTitle}>{title}</Text>
        <Text style={styles.insightPillText}>{text}</Text>
      </View>
    </View>
  );
}

function getMyInsightsPreview(myInsights: MyInsights | null): string {
  if (!myInsights) return 'Personal breakdown is loading.';
  if (myInsights.limitedReason) return 'Limited personal data this month.';

  const balance = myInsights.rows.find(row => row.label === 'Balance')?.value;
  return balance || 'View your personal breakdown.';
}

function DashboardCard({
  icon,
  preview,
  status,
  styles,
  title,
  onPress,
}: {
  icon: string;
  preview: string;
  status?: string;
  styles: ReturnType<typeof createStyles>;
  title: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity accessibilityRole="button" activeOpacity={0.78} onPress={onPress}>
      <GlassCard style={styles.dashboardCard} padding="none" radius={borderRadius.lg}>
        <View style={styles.dashboardRow}>
          <View style={styles.dashboardIconWrap}>
            <Icon name={icon} size={16} color={styles.tokens.primary} />
          </View>
          <View style={styles.dashboardCardCopy}>
            <View style={styles.dashboardTitleRow}>
              <Text style={styles.dashboardCardTitle} numberOfLines={1}>{title}</Text>
              {status ? <Text style={styles.dashboardStatus} numberOfLines={1}>{status}</Text> : null}
            </View>
            <View style={styles.dashboardDetailRow}>
              <Text style={styles.dashboardPreview} numberOfLines={1} ellipsizeMode="tail">{preview}</Text>
              <Icon name="chevron-down" size={16} color={styles.tokens.textSecondary} />
            </View>
          </View>
        </View>
      </GlassCard>
    </TouchableOpacity>
  );
}

function DetailModal({
  children,
  onClose,
  styles,
  title,
  visible,
}: {
  children: React.ReactNode;
  onClose: () => void;
  styles: ReturnType<typeof createStyles>;
  title: string;
  visible: boolean;
}) {
  const insets = useSafeAreaInsets();
  const sheetInsetStyle = useMemo(
    () => ({ paddingBottom: Math.max(insets.bottom, spacing.lg) }),
    [insets.bottom],
  );

  return (
    <Modal
      animationType="slide"
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <TouchableOpacity
          style={styles.modalDismissArea}
          accessibilityRole="button"
          accessibilityLabel="Close AI detail"
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={[styles.detailSheet, sheetInsetStyle]}>
          <View style={styles.sheetHandle} />
          <View style={styles.detailHeader}>
            <Text style={styles.detailTitle}>{title}</Text>
            <TouchableOpacity
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
            >
              <Icon name="close" size={18} color={styles.tokens.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.detailScroll}
            contentContainerStyle={styles.detailContent}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function AiInsightsSection({
  groupId,
  monthKey,
  hasMonthlyExpenses,
  isSmallDataSet,
  onUpgradePress,
  summary,
  expenses,
  currentUserId,
  groupCurrency = 'INR',
}: AiInsightsSectionProps) {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const {
    isAiEntitled,
    isLoading,
    planLabel,
    statusLabel,
    usageRemaining,
  } = useAiEntitlement();
  const [question, setQuestion] = useState('');
  const [loadingFeature, setLoadingFeature] = useState<AiFeature | null>(null);
  const [result, setResult] = useState<RequestSpendInsightResult | null>(null);
  const [latestUsage, setLatestUsage] = useState<AiUsageSnapshot | null>(null);
  const [error, setError] = useState<FriendlyError | null>(null);
  const [activeDetail, setActiveDetail] = useState<AiDetailPanel | null>(null);
  const [askResponse, setAskResponse] = useState<AskResponse | null>(null);

  const styles = useMemo(() => createStyles(colors, typography), [colors, typography]);
  const trimmedQuestion = question.trim();
  const isQuestionTooLong = question.length > QUESTION_LIMIT;
  const canGenerate = isAiEntitled && hasMonthlyExpenses && loadingFeature === null;
  const canAskQuestion = canGenerate && trimmedQuestion.length > 0 && !isQuestionTooLong;

  const deterministicHealth = useMemo(
    () => (isAiEntitled ? buildGroupHealth(summary) : null),
    [isAiEntitled, summary],
  );
  const myInsights = useMemo(
    () => (isAiEntitled
      ? buildMyInsights({
        currentUserId,
        expenses,
        summary,
        currency: groupCurrency,
      })
      : null),
    [currentUserId, expenses, groupCurrency, isAiEntitled, summary],
  );
  const displayedHealth = result?.structured.groupHealth || deterministicHealth;
  const generatedInsight = result?.structured ?? null;
  const detailTitle = activeDetail === 'health'
    ? 'Group Health Score'
    : activeDetail === 'my'
      ? 'My Insights'
      : activeDetail === 'monthly'
        ? 'Monthly Spending Insights'
        : activeDetail === 'settlement'
          ? 'Settlement Suggestions'
          : activeDetail === 'budget'
            ? 'Budget Suggestions'
            : activeDetail === 'ask'
              ? 'Ask AI'
              : '';
  const askPrompts = [
    'What should we watch this month?',
    'Who should settle first?',
    'Which category needs attention?',
  ];

  const handleGenerate = async (feature: AiFeature, inputQuestion?: string) => {
    if (!isAiEntitled) {
      setError({ message: 'AI access is locked for this account. Upgrade to SplitPro AI to continue.', showUpgrade: true });
      return;
    }

    if (!hasMonthlyExpenses) {
      setError({ message: 'Add an expense this month before generating AI insights.', showUpgrade: false });
      return;
    }

    if (feature === 'group_question' && !inputQuestion?.trim()) {
      setError({ message: 'Ask AI needs a question first.', showUpgrade: false });
      return;
    }

    setLoadingFeature(feature);
    setError(null);

    try {
      const nextResult = await requestSpendInsight({
        groupId,
        feature,
        monthKey,
        question: inputQuestion?.trim(),
      });
      const normalizedResult = normalizeInsightForDisplay({
        fallbackHealth: deterministicHealth,
        result: nextResult,
        summary,
        currency: groupCurrency,
      });

      if (feature === 'group_question') {
        setAskResponse({
          question: inputQuestion?.trim() || trimmedQuestion,
          answer: normalizedResult.content
            || normalizedResult.structured.aiSummary
            || normalizedResult.structured.summary,
          cached: normalizedResult.cached,
        });
      } else {
        setResult(normalizedResult);
      }

      setLatestUsage(nextResult.usage ?? null);
    } catch (nextError) {
      setError(getFriendlyError(nextError));
    } finally {
      setLoadingFeature(null);
    }
  };

  const renderDetailContent = () => {
    switch (activeDetail) {
      case 'health':
        return displayedHealth ? (
          <>
            <View style={styles.detailScoreRow}>
              <View style={styles.scoreBadge}>
                <Text style={styles.scoreValue}>{displayedHealth.score}</Text>
                <Text style={styles.scoreMax}>/100</Text>
              </View>
              <View style={styles.detailScoreCopy}>
                <View style={styles.healthLabelPill}>
                  <Text style={styles.healthLabelText}>{displayedHealth.label}</Text>
                </View>
                <Text style={styles.cardText}>{displayedHealth.explanation}</Text>
              </View>
            </View>
            <View style={styles.detailList}>
              {displayedHealth.tips.map(tip => (
                <View key={tip} style={styles.tipRow}>
                  <Icon name="checkmark-circle-outline" size={16} color={colors.primary} />
                  <Text style={styles.tipText}>{tip}</Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          <Text style={styles.detailEmptyText}>Health score will appear after analysis data loads.</Text>
        );

      case 'my':
        return (
          <>
            {!myInsights ? (
              <View style={styles.limitedDataRow}>
                <Icon name="information-circle-outline" size={16} color={colors.info} />
                <Text style={styles.limitedDataText}>Your personal insights are still loading.</Text>
              </View>
            ) : null}
            {myInsights?.limitedReason ? (
              <View style={styles.limitedDataRow}>
                <Icon name="information-circle-outline" size={16} color={colors.info} />
                <Text style={styles.limitedDataText}>{myInsights.limitedReason}</Text>
              </View>
            ) : null}
            {myInsights?.rows.length ? (
              <View style={styles.myRows}>
                {myInsights.rows.map(row => {
                  const color = row.tone === 'positive'
                    ? colors.owed
                    : row.tone === 'negative'
                      ? colors.owes
                      : colors.textPrimary;
                  return (
                    <View key={row.label} style={styles.myRow}>
                      <Text style={styles.myRowLabel} numberOfLines={1}>{row.label}</Text>
                      <Text style={[styles.myRowValue, { color }]} numberOfLines={2}>{row.value}</Text>
                    </View>
                  );
                })}
              </View>
            ) : null}
            {myInsights?.suggestion ? (
              <View style={styles.suggestionBox}>
                <Icon name="arrow-forward-circle-outline" size={16} color={colors.primary} />
                <Text style={styles.suggestionText}>{myInsights.suggestion}</Text>
              </View>
            ) : null}
          </>
        );

      case 'monthly':
        return generatedInsight ? (
          <>
            <Text style={styles.resultSummary}>{generatedInsight.aiSummary || generatedInsight.summary}</Text>
            {generatedInsight.limitedDataWarning ? (
              <View style={styles.limitedDataRow}>
                <Icon name="information-circle-outline" size={16} color={colors.info} />
                <Text style={styles.limitedDataText}>{generatedInsight.limitedDataWarning}</Text>
              </View>
            ) : null}
            <InsightPill icon="pricetag-outline" title="Category" text={generatedInsight.keyInsights.category} styles={styles} />
            <InsightPill icon="analytics-outline" title="Concentration" text={generatedInsight.keyInsights.concentration} styles={styles} />
            <InsightPill icon="people-outline" title="Member payments" text={generatedInsight.keyInsights.memberPayment} styles={styles} />
          </>
        ) : (
          <View style={styles.detailGenerateState}>
            <Text style={styles.detailEmptyText}>Generate AI insights to view the monthly summary.</Text>
            <Button
              title="Generate AI Insights"
              loading={loadingFeature === 'monthly_summary'}
              disabled={!canGenerate}
              onPress={() => handleGenerate('monthly_summary')}
            />
          </View>
        );

      case 'settlement':
        return generatedInsight ? (
          <CompactListSection
            icon="swap-horizontal-outline"
            title="Settlement Suggestions"
            items={generatedInsight.settlementSuggestions}
            styles={styles}
          />
        ) : (
          <View style={styles.detailGenerateState}>
            <Text style={styles.detailEmptyText}>Generate AI insights to view settlement suggestions.</Text>
            <Button
              title="Generate AI Insights"
              loading={loadingFeature === 'monthly_summary'}
              disabled={!canGenerate}
              onPress={() => handleGenerate('monthly_summary')}
            />
          </View>
        );

      case 'budget':
        return generatedInsight ? (
          <CompactListSection
            icon="wallet-outline"
            title="Budget Suggestions"
            items={generatedInsight.budgetSuggestions}
            styles={styles}
          />
        ) : (
          <View style={styles.detailGenerateState}>
            <Text style={styles.detailEmptyText}>Generate AI insights to view budget suggestions.</Text>
            <Button
              title="Generate AI Insights"
              loading={loadingFeature === 'monthly_summary'}
              disabled={!canGenerate}
              onPress={() => handleGenerate('monthly_summary')}
            />
          </View>
        );

      case 'ask':
        return (
          <>
            <Text style={styles.detailEmptyText}>Ask one focused question about this group's spending.</Text>
            <View style={styles.promptChipRow}>
              {askPrompts.map(prompt => (
                <TouchableOpacity
                  key={prompt}
                  style={styles.promptChip}
                  accessibilityRole="button"
                  onPress={() => setQuestion(prompt)}
                >
                  <Text style={styles.promptChipText}>{prompt}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              value={question}
              onChangeText={value => setQuestion(value.slice(0, QUESTION_LIMIT))}
              editable={loadingFeature === null}
              maxLength={QUESTION_LIMIT}
              multiline
              placeholder="Ask about this month, a category, or settlements..."
              placeholderTextColor={colors.textTertiary}
              style={styles.questionInput}
            />
            <View style={styles.askFooter}>
              <Text style={[styles.characterCount, isQuestionTooLong ? styles.characterCountError : null]}>
                {question.length}/{QUESTION_LIMIT}
              </Text>
              <Button
                title="Ask AI"
                size="sm"
                loading={loadingFeature === 'group_question'}
                disabled={!canAskQuestion}
                onPress={() => handleGenerate('group_question', trimmedQuestion)}
              />
            </View>
            {askResponse ? (
              <View style={styles.askAnswerCard}>
                <View style={styles.askAnswerHeader}>
                  <Text style={styles.askAnswerLabel}>AI response</Text>
                  {askResponse.cached ? <Text style={styles.askAnswerBadge}>Cached</Text> : null}
                </View>
                <Text style={styles.askAnswerQuestion} numberOfLines={2}>{askResponse.question}</Text>
                <Text style={styles.askAnswerText}>{askResponse.answer}</Text>
              </View>
            ) : null}
          </>
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.section}>
      {!isAiEntitled ? (
        <GlassCard style={styles.lockedCard} padding="lg" opacity={0.96}>
          <View style={styles.lockedBadge}>
            <Icon name="lock-closed-outline" size={14} color={colors.primary} />
            <Text style={styles.lockedBadgeText}>Premium AI</Text>
          </View>
          <Text style={styles.lockedTitle}>Unlock AI spend insights</Text>
          <Text style={styles.lockedText}>
            Get group health, settlement suggestions, budget patterns, and personal insights for your month.
          </Text>
          <View style={styles.lockedBenefits}>
            {['Health score', 'My Insights', 'Budget tips'].map(benefit => (
              <View key={benefit} style={styles.lockedBenefitChip}>
                <View style={styles.lockedBenefitDot} />
                <Text style={styles.lockedBenefitText}>{benefit}</Text>
              </View>
            ))}
          </View>
          <Button
            title="Upgrade to SplitPro AI"
            onPress={onUpgradePress}
            size="sm"
            icon={<Icon name="sparkles-outline" size={15} color={theme.dark ? colors.black : colors.white} />}
          />
        </GlassCard>
      ) : (
        <>
          <GlassCard style={styles.aiHeroCard} padding="md" opacity={0.97}>
            <View style={styles.aiHeroTopRow}>
              <View style={styles.aiHeroIcon}>
                <Icon name="sparkles-outline" size={19} color={colors.primary} />
              </View>
              <View style={styles.aiHeroCopy}>
                <Text style={styles.aiHeroTitle}>SplitPro AI</Text>
                <Text style={styles.aiHeroSubtitle}>Smart insights for your group spending.</Text>
              </View>
              <View style={styles.planBadge}>
                {isLoading ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={styles.planText}>{planLabel}</Text>
                )}
              </View>
            </View>

            <View style={styles.aiHeroFooter}>
              <Text style={styles.aiHeroStatus} numberOfLines={1}>
                {result?.cached ? 'Cached insight' : result ? 'Generated insight' : formatRemaining(latestUsage, usageRemaining)}
              </Text>
              <Button
                title={result ? 'Regenerate' : 'Generate AI Insights'}
                size="sm"
                loading={loadingFeature === 'monthly_summary'}
                disabled={!canGenerate}
                onPress={() => handleGenerate('monthly_summary')}
              />
            </View>
          </GlassCard>

          {isSmallDataSet && (
            <GlassCard style={styles.compactNoticeCard}>
              <Icon name="analytics-outline" size={18} color={colors.warning} />
              <Text style={styles.noticeText}>Limited data: insights will stay cautious.</Text>
            </GlassCard>
          )}

          {!hasMonthlyExpenses && (
            <GlassCard style={styles.compactNoticeCard}>
              <Icon name="information-circle-outline" size={18} color={colors.info} />
              <Text style={styles.noticeText}>Add an expense this month before generating AI insights.</Text>
            </GlassCard>
          )}

          {error && (
            <GlassCard style={styles.errorCard}>
              <Icon name="alert-circle-outline" size={20} color={colors.warning} />
              <View style={styles.errorCopy}>
                <Text style={styles.errorText}>{error.message}</Text>
                {error.showUpgrade ? (
                  <Button title="Upgrade to SplitPro AI" size="sm" variant="outline" onPress={onUpgradePress} />
                ) : (
                  <Button
                    title="Retry"
                    size="sm"
                    variant="outline"
                    disabled={!canGenerate}
                    onPress={() => handleGenerate('monthly_summary')}
                  />
                )}
              </View>
            </GlassCard>
          )}

          {loadingFeature !== null && (
            <GlassCard style={styles.loadingCard}>
              <ActivityIndicator color={colors.primary} />
              <View style={styles.loadingCopy}>
                <Text style={styles.loadingTitle}>Generating insight</Text>
                <Text style={styles.loadingText}>Checking patterns without changing balances.</Text>
              </View>
            </GlassCard>
          )}

          <View style={styles.dashboardList}>
            <DashboardCard
              icon="pulse-outline"
              title="Group Health Score"
              status={displayedHealth ? `${displayedHealth.score}/100` : undefined}
              preview={displayedHealth ? `${displayedHealth.label} - View score details` : 'View score details'}
              styles={styles}
              onPress={() => setActiveDetail('health')}
            />
            <DashboardCard
              icon="person-circle-outline"
              title="My Insights"
              status="Me"
              preview={getMyInsightsPreview(myInsights)}
              styles={styles}
              onPress={() => setActiveDetail('my')}
            />
            <DashboardCard
              icon="sparkles-outline"
              title="Monthly Spending Insights"
              status={result?.cached ? 'Cached' : result ? 'Ready' : undefined}
              preview={generatedInsight ? 'View this month\'s AI summary' : 'Generate to view AI summary'}
              styles={styles}
              onPress={() => setActiveDetail('monthly')}
            />
            <DashboardCard
              icon="swap-horizontal-outline"
              title="Settlement Suggestions"
              status={generatedInsight ? `${generatedInsight.settlementSuggestions.length} tips` : undefined}
              preview={generatedInsight ? 'View settlement actions' : 'Generate to view settlement tips'}
              styles={styles}
              onPress={() => setActiveDetail('settlement')}
            />
            <DashboardCard
              icon="wallet-outline"
              title="Budget Suggestions"
              status={generatedInsight ? 'Ready' : undefined}
              preview={generatedInsight ? 'View budget ideas' : 'Generate to view budget suggestions'}
              styles={styles}
              onPress={() => setActiveDetail('budget')}
            />
            <DashboardCard
              icon="chatbubble-ellipses-outline"
              title="Ask AI"
              status="Open"
              preview="Ask about this group's spending"
              styles={styles}
              onPress={() => setActiveDetail('ask')}
            />
          </View>

          <Text style={styles.entitlementNote}>AI access is verified by SplitPro before every request: {statusLabel}.</Text>

          <DetailModal
            visible={activeDetail !== null}
            title={detailTitle}
            styles={styles}
            onClose={() => setActiveDetail(null)}
          >
            {renderDetailContent()}
          </DetailModal>
        </>
      )}
    </View>
  );
}

function CompactListSection({
  icon,
  items,
  styles,
  title,
}: {
  icon: string;
  items: string[];
  styles: ReturnType<typeof createStyles>;
  title: string;
}) {
  if (items.length === 0) return null;

  return (
    <View style={styles.resultSection}>
      <View style={styles.resultSectionHeader}>
        <Icon name={icon} size={17} color={styles.tokens.primary} />
        <Text style={styles.resultSectionTitle}>{title}</Text>
      </View>
      {items.map(item => (
        <View key={item} style={styles.bulletRow}>
          <View style={styles.bulletDot} />
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

const createStyles = (colors: ThemeColors, typography: ThemeTypography) => ({
  ...StyleSheet.create({
  section: {
    gap: spacing.lg,
  },
  aiHeroCard: {
    gap: spacing.sm,
    backgroundColor: colors.surfaceContainer,
    borderColor: colors.borderLight,
  },
  aiHeroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  aiHeroIcon: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
  },
  aiHeroCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  aiHeroTitle: {
    ...typography.heading3,
  },
  aiHeroSubtitle: {
    ...typography.small,
    color: colors.textSecondary,
  },
  aiHeroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  aiHeroStatus: {
    ...typography.small,
    color: colors.textTertiary,
    flex: 1,
    minWidth: 0,
  },
  compactNoticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceContainer,
  },
  dashboardList: {
    gap: spacing.sm,
  },
  dashboardCard: {
    minHeight: 72,
    backgroundColor: colors.surfaceContainer,
    borderColor: colors.borderLight,
  },
  dashboardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  dashboardIconWrap: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    backgroundColor: colors.primaryLight,
  },
  dashboardCardCopy: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  dashboardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dashboardCardTitle: {
    ...typography.captionBold,
    flex: 1,
    minWidth: 0,
  },
  dashboardStatus: {
    ...typography.small,
    color: colors.primary,
    fontWeight: '800',
    maxWidth: 84,
    textAlign: 'right',
  },
  dashboardDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dashboardPreview: {
    ...typography.small,
    flex: 1,
    minWidth: 0,
    color: colors.textSecondary,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  modalDismissArea: {
    flex: 1,
  },
  detailSheet: {
    maxHeight: '82%',
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingTop: spacing.sm,
    backgroundColor: colors.background,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: borderRadius.full,
    marginBottom: spacing.sm,
    backgroundColor: colors.borderStrong,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  detailTitle: {
    ...typography.heading3,
    flex: 1,
    minWidth: 0,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceContainer,
  },
  detailScroll: {
    maxHeight: '100%',
  },
  detailContent: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  detailScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  detailScoreCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.sm,
  },
  detailList: {
    gap: spacing.sm,
  },
  detailEmptyText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  detailGenerateState: {
    gap: spacing.md,
  },
  promptChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  promptChip: {
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceContainer,
  },
  promptChipText: {
    ...typography.small,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  askAnswerCard: {
    gap: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
    backgroundColor: colors.surfaceContainer,
  },
  askAnswerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  askAnswerLabel: {
    ...typography.captionBold,
    color: colors.textPrimary,
  },
  askAnswerBadge: {
    ...typography.small,
    color: colors.primary,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  askAnswerQuestion: {
    ...typography.small,
    color: colors.textTertiary,
  },
  askAnswerText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.lg,
    marginTop: spacing.xs,
  },
  sectionTitle: {
    ...typography.heading3,
  },
  titleCopy: {
    flex: 1,
  },
  sectionSubtitle: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  planBadge: {
    minHeight: 30,
    minWidth: 84,
    borderWidth: 1,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderColor: colors.border,
  },
  planText: {
    ...typography.small,
    textTransform: 'uppercase',
  },
  lockedCard: {
    gap: spacing.md,
    backgroundColor: colors.surfaceContainer,
    borderColor: colors.borderLight,
  },
  lockedBadge: {
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
  lockedBadgeText: {
    ...typography.small,
    color: colors.primary,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  lockedTitle: {
    ...typography.heading3,
  },
  lockedText: {
    ...typography.caption,
  },
  lockedBenefits: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  lockedBenefitChip: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface,
  },
  lockedBenefitDot: {
    width: 5,
    height: 5,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
  },
  lockedBenefitText: {
    ...typography.small,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  healthCard: {
    gap: spacing.md,
    backgroundColor: colors.surfaceContainer,
    borderColor: colors.borderLight,
  },
  healthTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  scoreBadge: {
    width: 74,
    height: 74,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  scoreValue: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '900',
    color: colors.primary,
    includeFontPadding: false,
  },
  scoreMax: {
    ...typography.small,
    color: colors.textSecondary,
    includeFontPadding: false,
  },
  healthCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  healthTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  cardTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  healthLabelPill: {
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    backgroundColor: colors.primaryLight,
  },
  healthLabelText: {
    ...typography.small,
    color: colors.primary,
    fontWeight: '800',
  },
  cardText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  tipList: {
    gap: spacing.sm,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  tipText: {
    ...typography.caption,
    flex: 1,
  },
  myInsightsCard: {
    gap: spacing.md,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  cardSubtitle: {
    ...typography.small,
    marginTop: 2,
    color: colors.textTertiary,
  },
  meBadge: {
    minHeight: 26,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meBadgeText: {
    ...typography.small,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  myRows: {
    gap: spacing.xs,
  },
  myRow: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surfaceContainer,
  },
  myRowLabel: {
    ...typography.caption,
    flex: 1,
    minWidth: 0,
    color: colors.textSecondary,
  },
  myRowValue: {
    ...typography.captionBold,
    maxWidth: '58%',
    textAlign: 'right',
  },
  suggestionBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    backgroundColor: colors.primaryLight,
  },
  suggestionText: {
    ...typography.caption,
    flex: 1,
  },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  noticeText: {
    ...typography.caption,
    flex: 1,
  },
  generateCard: {
    gap: spacing.md,
  },
  generateCopy: {
    gap: spacing.xs,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  errorCopy: {
    flex: 1,
    gap: spacing.md,
  },
  errorText: {
    ...typography.caption,
  },
  loadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  loadingCopy: {
    flex: 1,
  },
  loadingTitle: {
    ...typography.bodyBold,
  },
  loadingText: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  resultCard: {
    gap: spacing.lg,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  resultTitleWrap: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  resultTitle: {
    ...typography.heading3,
    flex: 1,
  },
  cacheBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderColor: colors.border,
  },
  cacheText: {
    ...typography.small,
    textTransform: 'uppercase',
  },
  resultSummary: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  limitedDataRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surfaceContainer,
  },
  limitedDataText: {
    ...typography.caption,
    flex: 1,
  },
  resultSection: {
    gap: spacing.md,
  },
  resultSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  resultSectionTitle: {
    ...typography.bodyBold,
  },
  keyInsightGrid: {
    gap: spacing.sm,
  },
  insightPill: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    backgroundColor: colors.surfaceContainer,
  },
  insightPillCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  insightPillTitle: {
    ...typography.captionBold,
  },
  insightPillText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: borderRadius.full,
    marginTop: 6,
    backgroundColor: colors.primary,
  },
  bulletText: {
    ...typography.caption,
    flex: 1,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  warningText: {
    ...typography.caption,
    color: colors.warning,
    flex: 1,
  },
  askCard: {
    gap: spacing.md,
  },
  askHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  askHeaderCopy: {
    flex: 1,
    minWidth: 0,
  },
  askTitle: {
    ...typography.bodyBold,
  },
  askSubtitle: {
    ...typography.small,
    color: colors.textTertiary,
    marginTop: 2,
  },
  questionInput: {
    ...typography.body,
    minHeight: 86,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    textAlignVertical: 'top',
    backgroundColor: colors.surfaceContainer,
  },
  askFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  characterCount: {
    ...typography.caption,
  },
  characterCountError: {
    color: colors.warning,
  },
  entitlementNote: {
    ...typography.small,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  }),
  tokens: {
    primary: colors.primary,
    textSecondary: colors.textSecondary,
    info: colors.info,
    warning: colors.warning,
  },
});
