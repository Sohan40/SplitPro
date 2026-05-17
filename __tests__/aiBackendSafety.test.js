const { buildSpendContext } = require("../functions/src/ai/buildSpendContext");
const { deterministicFallback, validateAiOutput } = require("../functions/src/ai/validateAiOutput");

describe("AI backend safety helpers", () => {
  it("builds sanitized spend context without ids, emails, or payment expenses", () => {
    const context = buildSpendContext({
      group: {
        id: "g1",
        name: "Trip group",
        members: [
          { uid: "u1", name: "Asha", email: "asha@example.com" },
          { uid: "u2", name: "Ravi", email: "ravi@example.com" },
        ],
      },
      expenses: [
        {
          id: "e1",
          groupId: "g1",
          description: "Dinner with asha@example.com",
          amount: 1200,
          category: "food",
          splitType: "equal",
          paidBy: { uid: "u1", name: "Asha" },
          participants: [
            { uid: "u1", name: "Asha", amount: 600 },
            { uid: "u2", name: "Ravi", amount: 600 },
          ],
          createdAt: Date.UTC(2026, 4, 2),
        },
        {
          id: "e2",
          groupId: "g1",
          description: "Settlement",
          amount: 600,
          category: "payment",
          splitType: "payment",
          paidBy: { uid: "u2", name: "Ravi" },
          participants: [{ uid: "u1", name: "Asha", amount: 600 }],
          createdAt: Date.UTC(2026, 4, 3),
        },
      ],
      monthKey: "2026-05",
    });

    expect(context.totalSpend).toBe(1200);
    expect(context.expenseCount).toBe(1);
    expect(context.memberStats[0]).not.toHaveProperty("uid");
    expect(context.topExpenses[0].title).toContain("[email removed]");
    expect(JSON.stringify(context)).not.toContain("asha@example.com");
  });

  it("validates structured AI output and drops unexpected fields", () => {
    const validation = validateAiOutput(JSON.stringify({
      title: "May summary",
      summary: "Your group spent INR 1200.",
      keyInsights: ["Food was the top category."],
      unusualPatterns: ["Weekend expenses were higher than weekday expenses."],
      memberInsights: ["Asha paid most expenses this month."],
      budgetSuggestions: ["Keep Food under INR 1000 next time."],
      settlementSuggestions: ["Settle the largest balance first."],
      nextActions: ["Review Food expenses before the next trip."],
      warnings: ["Based only on SplitPro data."],
      rawPrompt: "should not be returned",
    }));

    expect(validation.ok).toBe(true);
    expect(validation.value).toEqual({
      title: "May summary",
      summary: "Your group spent INR 1200.",
      keyInsights: ["Food was the top category."],
      unusualPatterns: ["Weekend expenses were higher than weekday expenses."],
      memberInsights: ["Asha paid most expenses this month."],
      budgetSuggestions: ["Keep Food under INR 1000 next time."],
      settlementSuggestions: ["Settle the largest balance first."],
      nextActions: ["Review Food expenses before the next trip."],
      warnings: ["Based only on SplitPro data."],
    });
  });

  it("keeps old cached bullet output readable as key insights", () => {
    const validation = validateAiOutput(JSON.stringify({
      title: "Cached insight",
      summary: "Older cached AI output.",
      bullets: ["A cached bullet still displays."],
    }));

    expect(validation.ok).toBe(true);
    expect(validation.value.keyInsights).toEqual(["A cached bullet still displays."]);
  });

  it("falls back on malformed AI output", () => {
    const validation = validateAiOutput("not json");

    expect(validation.ok).toBe(false);
    expect(validation.value.summary).toContain("couldn't generate a clean summary");
  });

  it("returns a structured limited-data fallback", () => {
    const fallback = deterministicFallback({
      monthKey: "2026-05",
      totalSpend: 1200,
      expenseCount: 1,
      categoryBreakdown: [{ category: "Food", amount: 1200, percentage: 100 }],
      memberStats: [{ displayName: "Asha", paid: 1200 }],
      dataQuality: { limitedData: true },
      settlementHints: ["Settle the largest balance first."],
    });

    expect(fallback.limitedDataWarning).toContain("small number of expenses");
    expect(fallback.keyInsights).toHaveLength(2);
    expect(fallback.settlementSuggestions).toEqual(["Settle the largest balance first."]);
  });
});
