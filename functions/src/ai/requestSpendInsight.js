const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
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
const { buildSpendContext } = require("./buildSpendContext");
const { callOpenAi } = require("./openaiClient");
const { buildPrompt } = require("./prompts");
const { deterministicFallback, validateAiOutput } = require("./validateAiOutput");
const { getGroupForMember } = require("../groups/checkGroupMembership");

const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");
const FEATURES = new Set([
  "monthly_summary",
  "budget_suggestion",
  "category_insight",
  "group_question",
]);
const MAX_QUESTION_LENGTH = 300;
const MAX_EXPENSES_PER_REQUEST = 750;

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

  if (snapshot.size > MAX_EXPENSES_PER_REQUEST) {
    throw new HttpsError("resource-exhausted", "This group has too much data for one AI request.");
  }

  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

function getOpenAiKey() {
  try {
    return OPENAI_API_KEY.value() || process.env.OPENAI_API_KEY || "";
  } catch {
    return process.env.OPENAI_API_KEY || "";
  }
}

function responseFromInsight({ insight, cached, source, usage }) {
  return {
    cached,
    content: insight.aiSummary || insight.summary,
    structured: insight,
    source,
    usage,
  };
}

function createRequestSpendInsightFunction(db) {
  return onCall({
    region: "us-central1",
    timeoutSeconds: 60,
    memory: "256MiB",
    enforceAppCheck: process.env.SPLITPRO_ENFORCE_APP_CHECK === "true",
    consumeAppCheckToken: process.env.SPLITPRO_CONSUME_APP_CHECK_TOKEN === "true",
    secrets: [OPENAI_API_KEY],
  }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "Sign in to request AI insights.");
    }

    const input = validateInput(request.data);
    const group = await getGroupForMember(db, input.groupId, uid);
    const { usage } = await readUsageAvailability(db, uid);
    const expenses = await getGroupExpenses(db, input.groupId);
    const context = buildSpendContext({ group, expenses, monthKey: input.monthKey });
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
      if (cached?.structured?.title && cached?.structured?.summary) {
        const cachedValidation = validateAiOutput(JSON.stringify(cached.structured), context);
        const insight = cachedValidation.value;
        return {
          cached: true,
          content: cached.content || insight.aiSummary || insight.summary,
          structured: insight,
          source: cachedValidation.ok ? "cache" : "cache_validation_fallback",
          usage,
        };
      }
    }

    if (context.expenseCount < 3) {
      return responseFromInsight({
        insight: deterministicFallback(context),
        cached: false,
        source: "deterministic_fallback",
        usage,
      });
    }

    const apiKey = getOpenAiKey();
    if (!apiKey) {
      return responseFromInsight({
        insight: deterministicFallback(context),
        cached: false,
        source: "configuration_fallback",
        usage,
      });
    }

    const prompt = buildPrompt({
      type: input.feature,
      context,
      question: input.question,
    });
    const requestId = `splitpro-${cacheId}-${Date.now()}`;

    try {
      const openAiResult = await callOpenAi({ apiKey, prompt, requestId });
      const validation = validateAiOutput(openAiResult.outputText, context);
      const insight = validation.value;
      const source = validation.ok ? "openai" : "validation_fallback";

      if (!validation.ok) {
        return responseFromInsight({
          insight,
          cached: false,
          source,
          usage,
        });
      }

      const updatedUsage = await incrementUsageTransaction(db, uid, {
        groupId: input.groupId,
        feature: input.feature,
        monthKey: input.monthKey,
        cached: false,
      });

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
        content: insight.aiSummary || insight.summary,
        structured: insight,
        model: openAiResult.model,
        tokenUsage: openAiResult.usage || null,
        createdAt: FieldValue.serverTimestamp(),
      });

      return responseFromInsight({
        insight,
        cached: false,
        source,
        usage: updatedUsage,
      });
    } catch (error) {
      if (error instanceof HttpsError) {
        throw error;
      }

      console.warn("AI insight generation failed:", error.message);
      return responseFromInsight({
        insight: deterministicFallback(context),
        cached: false,
        source: "error_fallback",
        usage,
      });
    }
  });
}

module.exports = {
  FEATURES,
  createRequestSpendInsightFunction,
  validateInput,
};
