const FALLBACK_RESPONSE = {
  title: "Expense insight unavailable",
  summary: "I analyzed your expenses, but couldn't generate a clean summary. Please try again.",
  bullets: [
    "Your balances and expense totals are still calculated by SplitPro, not by AI.",
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

function validateAiOutput(rawText) {
  const parsed = parseJsonOutput(rawText);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, value: FALLBACK_RESPONSE };
  }

  const title = trimText(parsed.title, 80);
  const summary = trimText(parsed.summary, 500);
  const bullets = sanitizeList(parsed.bullets, 6, 220);
  const warnings = sanitizeList(parsed.warnings, 3, 180);

  if (!title || !summary || bullets.length === 0) {
    return { ok: false, value: FALLBACK_RESPONSE };
  }

  return {
    ok: true,
    value: {
      title,
      summary,
      bullets,
      warnings,
    },
  };
}

function deterministicFallback(context) {
  if (!context || context.expenseCount === 0) {
    return {
      title: "No spending data yet",
      summary: "There is not enough spending data for this month to generate an AI insight.",
      bullets: [
        "Add a few group expenses first, then try again.",
      ],
      warnings: [],
    };
  }

  const topCategory = context.categoryBreakdown?.[0]?.category || "the top category";
  return {
    title: "Basic expense summary",
    summary: `This group recorded ${context.expenseCount} expenses totaling INR ${context.totalSpend} in ${context.monthKey}.`,
    bullets: [
      `${topCategory} is currently the largest visible category.`,
      "AI insight generation was skipped or unavailable, so this fallback uses deterministic SplitPro totals only.",
    ],
    warnings: [],
  };
}

module.exports = {
  FALLBACK_RESPONSE,
  deterministicFallback,
  validateAiOutput,
};
