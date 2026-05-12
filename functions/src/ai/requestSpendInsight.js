const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { FieldValue } = require("firebase-admin/firestore");
const {
  buildAiInsightCacheId,
  getAiInsightCacheRef,
  getLatestExpenseUpdatedAt,
  normalizeQuestion,
} = require("./cacheAiInsight");
const {
  incrementUsageTransaction,
  readUsageAvailability,
} = require("./checkAndIncrementUsage");
const { getGroupForMember } = require("../groups/checkGroupMembership");

const FEATURES = new Set([
  "monthly_summary",
  "budget_suggestion",
  "category_insight",
  "group_question",
]);
const MOCK_CONTENT = "This is a mock AI insight. Your AI entitlement and usage gate are working.";
const MAX_QUESTION_LENGTH = 300;

function getCurrentMonthKey(date = new Date()) {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}`;
}

function validateInput(data) {
  const groupId = typeof data?.groupId === "string" ? data.groupId.trim() : "";
  const feature = typeof data?.feature === "string" ? data.feature.trim() : "";
  const monthKey = typeof data?.monthKey === "string" && data.monthKey.trim()
    ? data.monthKey.trim()
    : getCurrentMonthKey();
  const question = typeof data?.question === "string"
    ? normalizeQuestion(data.question)
    : "";

  if (!groupId || groupId.length > 128) {
    throw new HttpsError("invalid-argument", "A valid groupId is required.");
  }

  if (!FEATURES.has(feature)) {
    throw new HttpsError("invalid-argument", "A valid AI feature is required.");
  }

  if (!/^\d{4}-\d{2}$/u.test(monthKey)) {
    throw new HttpsError("invalid-argument", "monthKey must use YYYY-MM format.");
  }

  if (typeof data?.question === "string" && data.question.length > MAX_QUESTION_LENGTH) {
    throw new HttpsError("invalid-argument", "Question is too long.");
  }

  if (feature === "group_question" && !question) {
    throw new HttpsError("invalid-argument", "Question is required for this feature.");
  }

  return {
    groupId,
    feature,
    monthKey,
    question,
  };
}

async function getGroupExpenses(db, groupId) {
  const snapshot = await db
    .collection("expenses")
    .where("groupId", "==", groupId)
    .get();

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

function buildMockStructured(input, latestExpenseUpdatedAt) {
  return {
    feature: input.feature,
    monthKey: input.monthKey,
    latestExpenseUpdatedAt,
    mock: true,
  };
}

function createRequestSpendInsightFunction(db) {
  return onCall({
    region: "us-central1",
    timeoutSeconds: 30,
    memory: "256MiB",
    enforceAppCheck: process.env.SPLITPRO_ENFORCE_APP_CHECK === "true",
    consumeAppCheckToken: process.env.SPLITPRO_CONSUME_APP_CHECK_TOKEN === "true",
  }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "Sign in to request AI insights.");
    }

    const input = validateInput(request.data);
    await getGroupForMember(db, input.groupId, uid);
    const { usage } = await readUsageAvailability(db, uid);

    const expenses = await getGroupExpenses(db, input.groupId);
    const latestExpenseUpdatedAt = getLatestExpenseUpdatedAt(expenses);
    const cacheId = buildAiInsightCacheId({
      groupId: input.groupId,
      feature: input.feature,
      monthKey: input.monthKey,
      question: input.question,
      latestExpenseUpdatedAt,
    });
    const cacheRef = getAiInsightCacheRef(db, input.groupId, cacheId);
    const cachedDoc = await cacheRef.get();

    if (cachedDoc.exists) {
      const cached = cachedDoc.data();
      return {
        cached: true,
        content: cached.content || MOCK_CONTENT,
        structured: cached.structured || undefined,
        usage,
      };
    }

    const structured = buildMockStructured(input, latestExpenseUpdatedAt);
    await cacheRef.set({
      feature: input.feature,
      monthKey: input.monthKey,
      questionHash: buildAiInsightCacheId({
        groupId: input.groupId,
        feature: input.feature,
        monthKey: input.monthKey,
        question: input.question,
        latestExpenseUpdatedAt: 0,
      }),
      latestExpenseUpdatedAt,
      content: MOCK_CONTENT,
      structured,
      mock: true,
      createdAt: FieldValue.serverTimestamp(),
    });

    const updatedUsage = await incrementUsageTransaction(db, uid, {
      groupId: input.groupId,
      feature: input.feature,
      monthKey: input.monthKey,
      cached: false,
    });

    return {
      cached: false,
      content: MOCK_CONTENT,
      structured,
      usage: updatedUsage,
    };
  });
}

module.exports = {
  FEATURES,
  MOCK_CONTENT,
  createRequestSpendInsightFunction,
  validateInput,
};
