const FALLBACK_RESPONSE = {
  title: "Expense insight unavailable",
  summary: "I analyzed your expenses, but couldn't generate a clean summary. Please try again.",
  keyInsights: [
    "Your balances and expense totals are still calculated by SplitPro, not by AI.",
  ],
  unusualPatterns: [],
  memberInsights: [],
  budgetSuggestions: [],
  settlementSuggestions: [],
  nextActions: [
    "Try generating the insight again in a moment.",
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
  if (typeof rawText !== "string") return null;
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

function normalizeInsightShape(value) {
  return {
    title: trimText(value.title, 80),
    summary: trimText(value.summary, 600),
    keyInsights: sanitizeList(value.keyInsights || value.bullets, 6, 240),
    unusualPatterns: sanitizeList(value.unusualPatterns, 5, 240),
    memberInsights: sanitizeList(value.memberInsights, 5, 240),
    budgetSuggestions: sanitizeList(value.budgetSuggestions, 5, 240),
    settlementSuggestions: sanitizeList(value.settlementSuggestions, 5, 240),
    nextActions: sanitizeList(value.nextActions, 5, 220),
    warnings: sanitizeList(value.warnings, 3, 180),
    limitedDataWarning: trimText(value.limitedDataWarning, 220),
  };
}

function validateAiOutput(rawText) {
  const parsed = parseJsonOutput(rawText);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, value: FALLBACK_RESPONSE };
  }

  const insight = normalizeInsightShape(parsed);

  if (!insight.title || !insight.summary || insight.keyInsights.length === 0) {
    return { ok: false, value: FALLBACK_RESPONSE };
  }

  if (insight.nextActions.length === 0) {
    insight.nextActions = ["Review the largest categories before adding more shared expenses."];
  }

  Object.keys(insight).forEach((key) => {
    if (insight[key] === "") {
      delete insight[key];
    }
  });

  return {
    ok: true,
    value: insight,
  };
}

function deterministicFallback(context) {
  if (!context || context.expenseCount === 0) {
    return {
      title: "No spending data yet",
      summary: "There is not enough spending data for this month to generate an AI insight.",
      keyInsights: [
        "Add a few group expenses first, then try again.",
      ],
      unusualPatterns: [],
      memberInsights: [],
      budgetSuggestions: [],
      settlementSuggestions: [],
      nextActions: [
        "Add at least two shared expenses for a more useful analysis.",
      ],
      warnings: [],
      limitedDataWarning: "Limited data is available for this month.",
    };
  }

  const topCategory = context.categoryBreakdown?.[0]?.category || "the top category";
  const topPayer = context.memberStats?.find((member) => member.paid > 0);
  const settlementHint = context.settlementHints?.[0];

  return {
    title: "Basic expense summary",
    summary: `This group recorded ${context.expenseCount} expenses totaling INR ${context.totalSpend} in ${context.monthKey}.`,
    keyInsights: [
      `${topCategory} is currently the largest visible category.`,
      "AI insight generation was skipped or unavailable, so this fallback uses deterministic SplitPro totals only.",
    ],
    unusualPatterns: context.dataQuality?.limitedData
      ? ["There are too few expenses to call out reliable unusual patterns."]
      : [],
    memberInsights: topPayer
      ? [`${topPayer.displayName} has paid the most in this month's visible expenses.`]
      : [],
    budgetSuggestions: [
      "Use the current total as a reference point for the next similar trip or month.",
    ],
    settlementSuggestions: settlementHint ? [settlementHint] : [],
    nextActions: [
      "Review the largest expenses and settle balances from the group screen.",
    ],
    warnings: [],
    limitedDataWarning: context.dataQuality?.limitedData
      ? "This is based on a small number of expenses, so treat it as a starter insight."
      : undefined,
  };
}

module.exports = {
  FALLBACK_RESPONSE,
  deterministicFallback,
  validateAiOutput,
};
