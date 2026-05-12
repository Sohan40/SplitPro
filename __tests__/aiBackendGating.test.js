const { buildAiInsightCacheId, normalizeQuestion } = require("../functions/src/ai/cacheAiInsight");
const { getEntitlementResult } = require("../functions/src/ai/checkAiEntitlement");
const { normalizeUsage } = require("../functions/src/ai/checkAndIncrementUsage");
const { validateInput } = require("../functions/src/ai/requestSpendInsight");

describe("AI backend gating helpers", () => {
  it("allows active manual test entitlement only in emulator or test mode", () => {
    const userData = {
      entitlement: {
        ai: {
          active: true,
          plan: "test",
          status: "active",
          provider: "manual_test",
          expiresAt: null,
        },
      },
    };

    expect(getEntitlementResult(userData, Date.UTC(2026, 4, 1), {
      FUNCTIONS_EMULATOR: "true",
    }).allowed).toBe(true);
    expect(getEntitlementResult(userData, Date.UTC(2026, 4, 1), {}).allowed).toBe(false);
  });

  it("rejects expired entitlement", () => {
    const userData = {
      entitlement: {
        ai: {
          active: true,
          plan: "ai_monthly",
          status: "active",
          provider: "google_play",
          expiresAt: { seconds: Date.UTC(2026, 3, 1) / 1000 },
        },
      },
    };

    expect(getEntitlementResult(userData, Date.UTC(2026, 4, 1)).allowed).toBe(false);
  });

  it("resets stale usage and preserves the stronger limit", () => {
    const usage = normalizeUsage(
      {
        periodKey: "2026-04",
        used: 29,
        limit: 40,
      },
      {
        allowed: true,
        limit: 30,
      },
      new Date(Date.UTC(2026, 4, 8)),
    );

    expect(usage).toMatchObject({
      periodKey: "2026-05",
      used: 0,
      limit: 40,
      remaining: 40,
    });
  });

  it("normalizes question text for deterministic cache keys", () => {
    const first = buildAiInsightCacheId({
      groupId: "g1",
      feature: "group_question",
      monthKey: "2026-05",
      question: "  Who paid MOST?  ",
      latestExpenseUpdatedAt: 123,
    });
    const second = buildAiInsightCacheId({
      groupId: "g1",
      feature: "group_question",
      monthKey: "2026-05",
      question: "who paid most?",
      latestExpenseUpdatedAt: 123,
    });

    expect(normalizeQuestion("  Who paid MOST?  ")).toBe("who paid most?");
    expect(first).toBe(second);
  });

  it("validates request input without accepting unknown features", () => {
    expect(validateInput({
      groupId: "g1",
      feature: "monthly_summary",
      monthKey: "2026-05",
    })).toMatchObject({
      groupId: "g1",
      feature: "monthly_summary",
      monthKey: "2026-05",
    });

    expect(() => validateInput({
      groupId: "g1",
      feature: "openai_summary",
    })).toThrow("A valid AI feature is required.");
  });
});
