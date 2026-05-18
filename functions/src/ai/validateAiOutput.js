const HEALTH_LABELS = new Set(["Excellent", "Good", "Needs attention", "Unbalanced"]);
const MAX_RAW_OUTPUT_LENGTH = 12000;

const DEFAULT_GROUP_HEALTH = {
  score: 60,
  label: "Needs attention",
  explanation: "This is a SplitPro app insight based on group expense patterns, not financial advice.",
  tips: [
    "Add a few more expenses for a clearer pattern.",
    "Settle balances regularly so the group stays easy to manage.",
  ],
};

const FALLBACK_RESPONSE = {
  title: "Expense insight unavailable",
  summary: "I analyzed your expenses, but could not generate a clean structured insight. Please try again.",
  aiSummary: "I analyzed your expenses, but could not generate a clean structured insight. Please try again.",
  groupHealth: DEFAULT_GROUP_HEALTH,
  keyInsights: {
    category: "There is not enough reliable category detail to call out a strong pattern yet.",
    concentration: "Spending concentration could not be evaluated from the available data.",
    memberPayment: "Payment balance could not be evaluated from the available data.",
  },
  settlementSuggestions: [
    "Review current balances in SplitPro before settling.",
  ],
  budgetSuggestions: [
    "Consider using the current month total as a suggested reference for the next similar group month.",
  ],
  warnings: [],
};

function trimText(value, maxLength) {
  if (typeof value !== "string") return "";
  const clean = value
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return clean.length > maxLength ? clean.slice(0, maxLength).trim() : clean;
}

function stripCodeFence(text) {
  return text
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/u, "")
    .trim();
}

function parseJsonOutput(rawText) {
  if (typeof rawText !== "string" || rawText.length > MAX_RAW_OUTPUT_LENGTH) return null;
  const clean = stripCodeFence(rawText);

  try {
    return JSON.parse(clean);
  } catch {
    const match = clean.match(/\{[\s\S]*\}/u);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function sanitizeList(value, maxItems, maxLength) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => trimText(item, maxLength))
    .filter(Boolean)
    .filter((item) => !item.includes("|---"))
    .slice(0, maxItems);
}

function getHealthLabel(score) {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Needs attention";
  return "Unbalanced";
}

function normalizeGroupHealth(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const rawScore = Number(value.score);
  if (!Number.isFinite(rawScore)) {
    return null;
  }

  const score = Math.max(0, Math.min(100, Math.round(rawScore)));
  const label = HEALTH_LABELS.has(value.label) ? value.label : getHealthLabel(score);
  const explanation = trimText(value.explanation, 220);
  const tips = sanitizeList(value.tips, 3, 150);

  if (!explanation || tips.length < 2) {
    return null;
  }

  return {
    score,
    label,
    explanation,
    tips,
  };
}

function normalizeKeyInsights(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const keyInsights = {
    category: trimText(value.category, 220),
    concentration: trimText(value.concentration, 220),
    memberPayment: trimText(value.memberPayment, 220),
  };

  return keyInsights.category && keyInsights.concentration && keyInsights.memberPayment
    ? keyInsights
    : null;
}

function ensureCautiousBudgetText(value) {
  const text = trimText(value, 220);
  if (!text) return "";

  if (/\b(consider|suggested|based on current group data|could|may|might)\b/iu.test(text)) {
    return text;
  }

  return `Consider this as a suggested pattern based on current group data: ${text}`;
}

function normalizeInsightShape(value) {
  const title = trimText(value.title, 80);
  const aiSummary = trimText(value.aiSummary || value.summary, 420);
  const groupHealth = normalizeGroupHealth(value.groupHealth);
  const keyInsights = normalizeKeyInsights(value.keyInsights);
  const settlementSuggestions = sanitizeList(value.settlementSuggestions, 4, 220);
  const budgetSuggestions = sanitizeList(value.budgetSuggestions, 4, 220)
    .map(ensureCautiousBudgetText)
    .filter(Boolean);
  const warnings = sanitizeList(value.warnings, 3, 180);
  const limitedDataWarning = trimText(value.limitedDataWarning, 220);

  return {
    title,
    summary: aiSummary,
    aiSummary,
    groupHealth,
    keyInsights,
    settlementSuggestions,
    budgetSuggestions,
    warnings,
    limitedDataWarning,
  };
}

function deriveGroupHealth(context) {
  return context?.groupHealth || DEFAULT_GROUP_HEALTH;
}

function deterministicFallback(context) {
  const groupHealth = deriveGroupHealth(context);

  if (!context || context.expenseCount === 0) {
    return {
      title: "Not enough spending data yet",
      summary: "There is not enough spending data for this month to generate a useful AI insight.",
      aiSummary: "There is not enough spending data for this month to generate a useful AI insight.",
      groupHealth,
      keyInsights: {
        category: "No clear category pattern is available yet.",
        concentration: "Spending concentration needs more group expenses before it becomes meaningful.",
        memberPayment: "Member payment balance needs more expense data before it can be interpreted.",
      },
      settlementSuggestions: [
        "No specific settlement suggestion is available yet. Review balances after adding shared expenses.",
      ],
      budgetSuggestions: [
        "Consider adding a few more expenses before using this month as a suggested budget reference.",
      ],
      warnings: [],
      limitedDataWarning: "Limited data is available for this month.",
    };
  }

  const topCategory = context.categoryBreakdown?.[0];
  const topPayer = context.concentration?.topPayer || context.memberStats?.find((member) => member.paid > 0);
  const settlementHint = context.settlementHints?.[0];
  const topCategoryName = topCategory?.category || context.concentration?.topCategory?.category || "the top category";
  const topCategoryShare = topCategory?.percentage ?? context.concentration?.topCategory?.percentage ?? 0;

  return {
    title: "SplitPro AI insight",
    summary: `This group recorded ${context.expenseCount} expenses totaling INR ${context.totalSpend} in ${context.monthKey}.`,
    aiSummary: `This group recorded ${context.expenseCount} expenses totaling INR ${context.totalSpend} in ${context.monthKey}. The notes below use SplitPro's calculated patterns, not financial advice.`,
    groupHealth,
    keyInsights: {
      category: `${topCategoryName} is the biggest visible category${topCategoryShare ? ` at about ${topCategoryShare}% of monthly spend` : ""}.`,
      concentration: topCategoryShare >= 40
        ? `Spending is concentrated in ${topCategoryName}, so consider reviewing that category first.`
        : "Spending is not heavily concentrated in one category based on current group data.",
      memberPayment: topPayer
        ? `${topPayer.displayName} paid the most this month, which may make settlements feel easier if handled soon.`
        : "No single payer pattern is strong enough to highlight yet.",
    },
    settlementSuggestions: [
      settlementHint || "No urgent settlement priority is visible. Review current balances before recording a payment.",
    ],
    budgetSuggestions: [
      `Consider using INR ${context.totalSpend} as a suggested reference for a similar group month.`,
      topCategoryName === "Other"
        ? "Consider recategorizing large Other expenses so next month's budget suggestions are clearer."
        : `Based on current group data, consider watching ${topCategoryName} next month.`,
    ],
    warnings: [
      "These are SplitPro app insights based only on group expense data, not financial advice.",
    ],
    limitedDataWarning: context.dataQuality?.limitedData
      ? "This is based on a small number of expenses, so treat it as a starter insight."
      : undefined,
  };
}

function validateAiOutput(rawText, fallbackContext) {
  const fallback = deterministicFallback(fallbackContext);
  const parsed = parseJsonOutput(rawText);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, value: fallback };
  }

  const insight = normalizeInsightShape(parsed);

  if (
    !insight.title ||
    !insight.aiSummary ||
    !insight.groupHealth ||
    !insight.keyInsights ||
    insight.settlementSuggestions.length === 0 ||
    insight.budgetSuggestions.length === 0
  ) {
    return { ok: false, value: fallback };
  }

  if (fallbackContext?.groupHealth) {
    insight.groupHealth = fallbackContext.groupHealth;
  }

  Object.keys(insight).forEach((key) => {
    if (insight[key] === "" || insight[key] === undefined) {
      delete insight[key];
    }
  });

  return {
    ok: true,
    value: insight,
  };
}

module.exports = {
  FALLBACK_RESPONSE,
  deterministicFallback,
  validateAiOutput,
};
