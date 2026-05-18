export type AiFeature =
  | 'monthly_summary'
  | 'budget_suggestion'
  | 'category_insight'
  | 'group_question';

export type AiUsageSnapshot = {
  periodKey: string;
  used: number;
  limit: number;
  remaining?: number;
};

export type AiHealthLabel = 'Excellent' | 'Good' | 'Needs attention' | 'Unbalanced';

export type AiGroupHealth = {
  score: number;
  label: AiHealthLabel;
  explanation: string;
  tips: string[];
};

export type AiKeyInsights = {
  category: string;
  concentration: string;
  memberPayment: string;
};

export type AiInsight = {
  title: string;
  summary: string;
  aiSummary?: string;
  groupHealth: AiGroupHealth;
  keyInsights: AiKeyInsights;
  budgetSuggestions: string[];
  settlementSuggestions: string[];
  warnings?: string[];
  limitedDataWarning?: string;
};

export type RequestSpendInsightParams = {
  groupId: string;
  feature: AiFeature;
  monthKey: string;
  question?: string;
};

export type RequestSpendInsightResult = {
  cached: boolean;
  content: string;
  structured: AiInsight;
  source: string;
  usage?: AiUsageSnapshot;
};

export type AiRequestErrorCode =
  | 'unauthenticated'
  | 'permission-denied'
  | 'failed-precondition'
  | 'resource-exhausted'
  | 'invalid-argument'
  | 'unavailable'
  | 'internal';
