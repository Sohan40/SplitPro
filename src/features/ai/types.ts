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

export type AiInsight = {
  title: string;
  summary: string;
  keyInsights: string[];
  unusualPatterns: string[];
  memberInsights: string[];
  budgetSuggestions: string[];
  settlementSuggestions: string[];
  nextActions: string[];
  bullets?: string[];
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
