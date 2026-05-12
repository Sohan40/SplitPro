const { HttpsError } = require("firebase-functions/v2/https");
const { getEntitlementResult } = require("./checkAiEntitlement");

function getPeriodKey(date = new Date()) {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}`;
}

function getNextMonthStartMs(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1).getTime();
}

function normalizeUsage(existingUsage, entitlement, now = new Date()) {
  const periodKey = getPeriodKey(now);
  const existingLimit = Number(existingUsage?.limit);
  const limit = Number.isFinite(existingLimit) && existingLimit > 0
    ? Math.max(existingLimit, entitlement.limit)
    : entitlement.limit;
  const used = existingUsage?.periodKey === periodKey
    ? Number(existingUsage.used || 0)
    : 0;

  return {
    periodKey,
    used,
    limit,
    remaining: Math.max(limit - used, 0),
    resetAt: getNextMonthStartMs(now),
  };
}

function assertUsageAvailable(usage) {
  if (usage.used >= usage.limit) {
    throw new HttpsError("resource-exhausted", "Monthly AI usage limit reached.");
  }
}

async function readUsageAvailability(db, uid, now = new Date()) {
  const userRef = db.collection("users").doc(uid);
  const userDoc = await userRef.get();
  if (!userDoc.exists) {
    throw new HttpsError("failed-precondition", "User profile is required for AI insights.");
  }

  const userData = userDoc.data();
  const entitlement = getEntitlementResult(userData, now.getTime());
  if (!entitlement.allowed) {
    throw new HttpsError("failed-precondition", "AI entitlement is not active.");
  }

  const usage = normalizeUsage(userData.aiUsage, entitlement, now);
  assertUsageAvailable(usage);

  if (userData.aiUsage?.periodKey !== usage.periodKey || userData.aiUsage?.limit !== usage.limit) {
    await userRef.set({
      aiUsage: {
        periodKey: usage.periodKey,
        used: usage.used,
        limit: usage.limit,
        resetAt: usage.resetAt,
        updatedAt: now.getTime(),
      },
    }, { merge: true });
  }

  return { userData, entitlement, usage };
}

async function incrementUsageTransaction(db, uid, metadata, now = new Date()) {
  const userRef = db.collection("users").doc(uid);
  const nowMs = now.getTime();

  const usage = await db.runTransaction(async (transaction) => {
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists) {
      throw new HttpsError("failed-precondition", "User profile is required for AI insights.");
    }

    const userData = userDoc.data();
    const entitlement = getEntitlementResult(userData, nowMs);
    if (!entitlement.allowed) {
      throw new HttpsError("failed-precondition", "AI entitlement is not active.");
    }

    const current = normalizeUsage(userData.aiUsage, entitlement, now);
    assertUsageAvailable(current);

    const nextUsage = {
      periodKey: current.periodKey,
      used: current.used + 1,
      limit: current.limit,
      resetAt: current.resetAt,
      updatedAt: nowMs,
    };

    transaction.set(userRef, { aiUsage: nextUsage }, { merge: true });
    return {
      periodKey: nextUsage.periodKey,
      used: nextUsage.used,
      limit: nextUsage.limit,
      remaining: Math.max(nextUsage.limit - nextUsage.used, 0),
    };
  });

  await db.collection("aiUsageEvents").add({
    uid,
    groupId: metadata.groupId,
    feature: metadata.feature,
    monthKey: metadata.monthKey,
    cached: metadata.cached === true,
    periodKey: usage.periodKey,
    createdAt: nowMs,
  });

  return usage;
}

module.exports = {
  assertUsageAvailable,
  getNextMonthStartMs,
  getPeriodKey,
  incrementUsageTransaction,
  normalizeUsage,
  readUsageAvailability,
};
