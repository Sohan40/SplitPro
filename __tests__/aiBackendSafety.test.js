const { buildSpendContext } = require("../functions/src/ai/buildSpendContext");
const { validateAiOutput } = require("../functions/src/ai/validateAiOutput");

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
      bullets: ["Food was the top category."],
      warnings: ["Based only on SplitPro data."],
      rawPrompt: "should not be returned",
    }));

    expect(validation.ok).toBe(true);
    expect(validation.value).toEqual({
      title: "May summary",
      summary: "Your group spent INR 1200.",
      bullets: ["Food was the top category."],
      warnings: ["Based only on SplitPro data."],
    });
  });

  it("falls back on malformed AI output", () => {
    const validation = validateAiOutput("not json");

    expect(validation.ok).toBe(false);
    expect(validation.value.summary).toContain("couldn't generate a clean summary");
  });
});
