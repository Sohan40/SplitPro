const ACTIVE_STATUSES = new Set(["active", "grace_period"]);
const DEFAULT_PLAN_LIMITS = {
  ai_monthly: 30,
  ai_yearly: 50,
  test: 20,
};

function toMillis(value) {
  if (!value) return null;
  if (typeof value === "number") return value;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  return null;
}

function manualTestEntitlementAllowed(env = process.env) {
  return env.FUNCTIONS_EMULATOR === "true"
    || env.NODE_ENV === "test"
    || env.SPLITPRO_ALLOW_MANUAL_TEST_ENTITLEMENT === "true";
}

function getEntitlementResult(userData, nowMs = Date.now(), env = process.env) {
  const ai = userData?.entitlement?.ai;
  if (!ai || ai.active !== true || !ACTIVE_STATUSES.has(ai.status)) {
    return {
      allowed: false,
      reason: "inactive",
      plan: "free",
      limit: 0,
    };
  }

  if (ai.provider === "manual_test" && !manualTestEntitlementAllowed(env)) {
    return {
      allowed: false,
      reason: "manual-test-disabled",
      plan: ai.plan || "test",
      limit: 0,
    };
  }

  const expiresAtMs = toMillis(ai.expiresAt);
  if (expiresAtMs !== null && expiresAtMs <= nowMs) {
    return {
      allowed: false,
      reason: "expired",
      plan: ai.plan || "free",
      limit: 0,
    };
  }

  const plan = ai.plan || "test";
  return {
    allowed: true,
    reason: "active",
    plan,
    limit: DEFAULT_PLAN_LIMITS[plan] || DEFAULT_PLAN_LIMITS.test,
  };
}

module.exports = {
  DEFAULT_PLAN_LIMITS,
  getEntitlementResult,
  manualTestEntitlementAllowed,
  toMillis,
};
