const {
  buildGrantPayload,
  buildRevokePayload,
  parseArgs,
} = require("../functions/scripts/adminTestEntitlementUtils");

describe("admin AI test entitlement scripts", () => {
  it("requires an explicit UID argument", () => {
    expect(() => parseArgs([], "admin:grant-ai-test")).toThrow("Usage:");
  });

  it("rejects unsafe UID values", () => {
    expect(() => parseArgs(["users/bad"], "admin:grant-ai-test")).toThrow("Invalid Firebase Auth UID");
    expect(() => parseArgs(["bad uid"], "admin:grant-ai-test")).toThrow("Invalid Firebase Auth UID");
  });

  it("parses a UID and optional duration", () => {
    expect(parseArgs(["abc_123", "--hours", "2"], "admin:grant-ai-test", { allowHours: true })).toEqual({
      uid: "abc_123",
      hours: 2,
    });
  });

  it("does not accept duration flags for revoke commands", () => {
    expect(() => parseArgs(
      ["abc_123", "--hours", "2"],
      "admin:revoke-ai-test",
    )).toThrow("Usage:");
  });

  it("builds a minimal temporary manual test entitlement payload", () => {
    const now = new Date(Date.UTC(2026, 4, 13, 10, 0, 0));
    const payload = buildGrantPayload(2, now);

    expect(payload.entitlement.ai).toMatchObject({
      active: true,
      plan: "test",
      status: "active",
      provider: "manual_test",
    });
    expect(payload).not.toHaveProperty("isPro");
    expect(payload).not.toHaveProperty("subscriptionStatus");
    expect(payload).not.toHaveProperty("aiUsage");
  });

  it("builds a minimal revoked entitlement payload", () => {
    const payload = buildRevokePayload(new Date(Date.UTC(2026, 4, 13, 10, 0, 0)));

    expect(payload.entitlement.ai).toMatchObject({
      active: false,
      plan: "free",
      status: "revoked",
      provider: "none",
    });
  });
});
