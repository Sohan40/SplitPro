import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Button from '../../../components/Button';
import GlassCard from '../../../components/GlassCard';
import { borderRadius, spacing, type ThemeColors, type ThemeTypography } from '../../../components/theme';
import { useTheme } from '../../../context/ThemeContext';
import { useAiEntitlement } from '../hooks/useAiEntitlement';
import {
  AiInsightRequestError,
  requestSpendInsight,
} from '../services/requestSpendInsight';
import type {
  AiFeature,
  AiInsight,
  AiRequestErrorCode,
  AiUsageSnapshot,
  RequestSpendInsightResult,
} from '../types';
import AiInsightCard from './AiInsightCard';
import LockedAiCard from './LockedAiCard';

type AiInsightsSectionProps = {
  groupId: string;
  monthKey: string;
  hasMonthlyExpenses: boolean;
  isSmallDataSet: boolean;
  onUpgradePress: () => void;
};

type AiAction = {
  feature: AiFeature;
  title: string;
  description: string;
  icon: string;
};

type FriendlyError = {
  message: string;
  showUpgrade: boolean;
};

type InsightListKey =
  | 'keyInsights'
  | 'unusualPatterns'
  | 'memberInsights'
  | 'budgetSuggestions'
  | 'settlementSuggestions'
  | 'nextActions';

type InsightResultSection = {
  key: InsightListKey;
  title: string;
  icon: string;
};

const QUESTION_LIMIT = 300;

const RESULT_SECTIONS: InsightResultSection[] = [
  { key: 'keyInsights', title: 'Key insights', icon: 'sparkles-outline' },
  { key: 'unusualPatterns', title: 'Spending patterns', icon: 'pulse-outline' },
  { key: 'memberInsights', title: 'Member insights', icon: 'people-outline' },
  { key: 'budgetSuggestions', title: 'Suggestions', icon: 'bulb-outline' },
  { key: 'settlementSuggestions', title: 'Settlement tips', icon: 'swap-horizontal-outline' },
  { key: 'nextActions', title: 'Next actions', icon: 'checkmark-done-outline' },
];

const AI_ACTIONS: AiAction[] = [
  {
    feature: 'monthly_summary',
    title: 'AI Monthly Summary',
    description: 'Find patterns, changes, and next actions.',
    icon: 'calendar-outline',
  },
  {
    feature: 'budget_suggestion',
    title: 'Budget Suggestions',
    description: 'Get practical targets for similar groups.',
    icon: 'bulb-outline',
  },
  {
    feature: 'category_insight',
    title: 'Category Based Insights',
    description: 'See categories and patterns to watch.',
    icon: 'pricetag-outline',
  },
];

const LOCKED_ACTIONS: AiAction[] = [
  ...AI_ACTIONS,
  {
    feature: 'group_question',
    title: 'Ask AI about this group',
    description: 'Ask a focused question about the month.',
    icon: 'chatbubble-ellipses-outline',
  },
];

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

function getInsightItems(insight: AiInsight, key: InsightListKey): string[] {
  if (key === 'keyInsights' && (insight.keyInsights?.length ?? 0) === 0 && insight.bullets?.length) {
    return insight.bullets;
  }

  return insight[key] || [];
}

export default function AiInsightsSection({
  groupId,
  monthKey,
  hasMonthlyExpenses,
  isSmallDataSet,
  onUpgradePress,
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

  const styles = useMemo(() => createStyles(colors, typography), [colors, typography]);
  const trimmedQuestion = question.trim();
  const isQuestionTooLong = question.length > QUESTION_LIMIT;
  const isAiActionDisabled = !hasMonthlyExpenses || loadingFeature !== null;
  const canAskQuestion = hasMonthlyExpenses && trimmedQuestion.length > 0 && !isQuestionTooLong;

  const handleGenerate = async (feature: AiFeature, inputQuestion?: string) => {
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
      setResult(nextResult);
      setLatestUsage(nextResult.usage ?? null);
    } catch (nextError) {
      setError(getFriendlyError(nextError));
    } finally {
      setLoadingFeature(null);
    }
  };

  return (
    <View style={styles.section}>
      <View style={styles.titleRow}>
        <View style={styles.titleCopy}>
          <Text style={styles.sectionTitle}>AI Insights</Text>
          <Text style={styles.sectionSubtitle}>
            {isAiEntitled ? formatRemaining(latestUsage, usageRemaining) : 'Unlock summaries, budgets, and smart group answers.'}
          </Text>
        </View>
        <View style={styles.planBadge}>
          {isLoading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <>
              <Icon
                name={isAiEntitled ? 'sparkles-outline' : 'lock-closed-outline'}
                size={14}
                color={isAiEntitled ? colors.primary : colors.textSecondary}
              />
              <Text style={styles.planText}>{isAiEntitled ? planLabel : 'Locked'}</Text>
            </>
          )}
        </View>
      </View>

      {!isAiEntitled ? (
        <View style={styles.cardGrid}>
          {LOCKED_ACTIONS.map(action => (
            <View key={action.feature} style={styles.gridItem}>
              <LockedAiCard
                title={action.title}
                description={action.description}
                icon={action.icon}
                onUpgradePress={onUpgradePress}
              />
            </View>
          ))}
        </View>
      ) : (
        <>
          <View style={styles.unlockedBadge}>
            <Icon name="checkmark-circle-outline" size={18} color={colors.primary} />
            <Text style={styles.unlockedText}>AI enabled by backend entitlement: {statusLabel}</Text>
          </View>

          {!hasMonthlyExpenses && (
            <GlassCard style={styles.noticeCard}>
              <Icon name="information-circle-outline" size={20} color={colors.info} />
              <Text style={styles.noticeText}>Add an expense this month before generating AI insights.</Text>
            </GlassCard>
          )}

          {isSmallDataSet && (
            <GlassCard style={styles.noticeCard}>
              <Icon name="analytics-outline" size={20} color={colors.warning} />
              <Text style={styles.noticeText}>
                Small data set: SplitPro will show a cautious limited-data insight until more expenses are added.
              </Text>
            </GlassCard>
          )}

          <View style={styles.cardGrid}>
            {AI_ACTIONS.map(action => (
              <View key={action.feature} style={styles.gridItem}>
                <AiInsightCard
                  title={action.title}
                  description={action.description}
                  icon={action.icon}
                  loading={loadingFeature === action.feature}
                  disabled={isAiActionDisabled}
                  onPress={() => handleGenerate(action.feature)}
                />
              </View>
            ))}
          </View>

          <GlassCard style={styles.askCard}>
            <View style={styles.askHeader}>
              <Icon name="chatbubble-ellipses-outline" size={20} color={colors.primary} />
              <Text style={styles.askTitle}>Ask AI about this group</Text>
            </View>
            <TextInput
              value={question}
              onChangeText={value => setQuestion(value.slice(0, QUESTION_LIMIT))}
              editable={loadingFeature === null}
              maxLength={QUESTION_LIMIT}
              multiline
              placeholder="Ask about this month, a category, or group spending..."
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
                disabled={loadingFeature !== null || !canAskQuestion}
                onPress={() => handleGenerate('group_question', trimmedQuestion)}
              />
            </View>
          </GlassCard>

          {!result && !error && loadingFeature === null && hasMonthlyExpenses && (
            <GlassCard style={styles.emptyResultCard}>
              <Icon name="sparkles-outline" size={20} color={colors.primary} />
              <Text style={styles.emptyResultText}>
                Choose an insight type above to generate a structured AI analysis.
              </Text>
            </GlassCard>
          )}

          {error && (
            <GlassCard style={styles.errorCard}>
              <Icon name="alert-circle-outline" size={20} color={colors.warning} />
              <View style={styles.errorCopy}>
                <Text style={styles.errorText}>{error.message}</Text>
                {error.showUpgrade && (
                  <Button title="Upgrade to SplitPro AI" size="sm" variant="outline" onPress={onUpgradePress} />
                )}
              </View>
            </GlassCard>
          )}

          {loadingFeature !== null && (
            <GlassCard style={styles.loadingCard}>
              <ActivityIndicator color={colors.primary} />
              <View style={styles.loadingCopy}>
                <Text style={styles.loadingTitle}>Generating insight</Text>
                <Text style={styles.loadingText}>
                  SplitPro is checking patterns in this group without changing your balances.
                </Text>
              </View>
            </GlassCard>
          )}

          {result && (
            <GlassCard style={styles.resultCard}>
              <View style={styles.resultHeader}>
                <Text style={styles.resultTitle}>{result.structured.title}</Text>
                {result.cached && (
                  <View style={styles.cacheBadge}>
                    <Icon name="flash-outline" size={13} color={colors.textSecondary} />
                    <Text style={styles.cacheText}>Cached</Text>
                  </View>
                )}
              </View>
              <Text style={styles.resultSummary}>{result.structured.summary}</Text>

              {result.structured.limitedDataWarning && (
                <View style={styles.limitedDataRow}>
                  <Icon name="information-circle-outline" size={16} color={colors.info} />
                  <Text style={styles.limitedDataText}>{result.structured.limitedDataWarning}</Text>
                </View>
              )}

              {RESULT_SECTIONS.map(section => {
                const items = getInsightItems(result.structured, section.key);
                if (items.length === 0) return null;

                return (
                  <View key={section.key} style={styles.resultSection}>
                    <View style={styles.resultSectionHeader}>
                      <Icon name={section.icon} size={17} color={colors.primary} />
                      <Text style={styles.resultSectionTitle}>{section.title}</Text>
                    </View>
                    {items.map(item => (
                      <View key={item} style={styles.bulletRow}>
                        <View style={styles.bulletDot} />
                        <Text style={styles.bulletText}>{item}</Text>
                      </View>
                    ))}
                  </View>
                );
              })}

              {result.structured.warnings?.map(warning => (
                <View key={warning} style={styles.warningRow}>
                  <Icon name="warning-outline" size={16} color={colors.warning} />
                  <Text style={styles.warningText}>{warning}</Text>
                </View>
              ))}
            </GlassCard>
          )}
        </>
      )}
    </View>
  );
}

const createStyles = (colors: ThemeColors, typography: ThemeTypography) => StyleSheet.create({
  section: {
    gap: spacing.xl,
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
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
  },
  gridItem: {
    flexBasis: '46%',
    flexGrow: 1,
    minWidth: 172,
  },
  unlockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.primaryLight,
  },
  unlockedText: {
    ...typography.captionBold,
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
  askCard: {
    gap: spacing.lg,
  },
  askHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  askTitle: {
    ...typography.bodyBold,
  },
  questionInput: {
    ...typography.body,
    minHeight: 108,
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
  emptyResultCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  emptyResultText: {
    ...typography.caption,
    flex: 1,
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
  resultCard: {
    gap: spacing.lg,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
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
    ...typography.body,
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
    paddingTop: spacing.md,
  },
  resultSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  resultSectionTitle: {
    ...typography.bodyBold,
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
});
