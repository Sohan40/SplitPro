const crypto = require("crypto");

function normalizeQuestion(question) {
  return String(question || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .slice(0, 300);
}

function hashValue(value) {
  return crypto
    .createHash("sha256")
    .update(String(value))
    .digest("hex")
    .slice(0, 32);
}

function getLatestExpenseUpdatedAt(expenses) {
  return expenses.reduce((latest, expense) => {
    const updatedAt = Number(expense.updatedAt || expense.createdAt || 0);
    return Math.max(latest, Number.isFinite(updatedAt) ? updatedAt : 0);
  }, 0);
}

function buildAiInsightCacheId({ groupId, feature, monthKey, question, latestExpenseUpdatedAt }) {
  return hashValue([
    groupId,
    feature,
    monthKey,
    normalizeQuestion(question),
    latestExpenseUpdatedAt || 0,
  ].join("|"));
}

function getAiInsightCacheRef(db, groupId, cacheId) {
  return db
    .collection("groups")
    .doc(groupId)
    .collection("aiInsights")
    .doc(cacheId);
}

module.exports = {
  buildAiInsightCacheId,
  getAiInsightCacheRef,
  getLatestExpenseUpdatedAt,
  normalizeQuestion,
};
