const crypto = require("crypto");

const MEANINGFUL_CHANGE_DEFINITIONS = [
  { key: "amount", label: "Amount" },
  { key: "description", label: "Description" },
  { key: "category", label: "Category" },
  { key: "paidBy", label: "Payer" },
  { key: "splitType", label: "Split type" },
  { key: "participants", label: "Split" },
];

function toMillis(value) {
  if (!value) return null;
  if (typeof value === "number") return value;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  return null;
}

function toMoneyCents(value) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return 0;
  return Math.round(numberValue * 100);
}

function sanitizeIdPart(value) {
  return String(value || "")
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120) || "item";
}

function normalizeDescription(value) {
  return String(value || "").trim();
}

function normalizeCategory(value) {
  return String(value || "others").trim().toLowerCase() || "others";
}

function normalizePaidByUid(expense) {
  return String(expense?.paidBy?.uid || "");
}

function normalizeParticipants(participants) {
  if (!Array.isArray(participants)) return [];

  return participants
    .filter(participant => participant?.uid)
    .map(participant => ({
      uid: String(participant.uid),
      amountCents: toMoneyCents(participant.amount),
    }))
    .sort((a, b) => a.uid.localeCompare(b.uid));
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function valuesEqual(a, b) {
  return stableStringify(a) === stableStringify(b);
}

function detectMeaningfulExpenseChanges(before, after) {
  const comparisons = {
    amount: [toMoneyCents(before?.amount), toMoneyCents(after?.amount)],
    description: [normalizeDescription(before?.description), normalizeDescription(after?.description)],
    category: [normalizeCategory(before?.category), normalizeCategory(after?.category)],
    paidBy: [normalizePaidByUid(before), normalizePaidByUid(after)],
    splitType: [String(before?.splitType || ""), String(after?.splitType || "")],
    participants: [normalizeParticipants(before?.participants), normalizeParticipants(after?.participants)],
  };

  return MEANINGFUL_CHANGE_DEFINITIONS
    .filter(({ key }) => !valuesEqual(comparisons[key][0], comparisons[key][1]))
    .map(({ key, label }) => ({ key, label }));
}

function hashChangedFields(changedFields) {
  return crypto
    .createHash("sha256")
    .update(changedFields.map(field => field.key).sort().join("|"))
    .digest("hex")
    .slice(0, 12);
}

function buildCompactExpenseSummary(expense) {
  return {
    amount: Number.isFinite(Number(expense?.amount))
      ? Math.round(Number(expense.amount) * 100) / 100
      : 0,
    category: normalizeCategory(expense?.category),
    paidByName: String(expense?.paidBy?.name || "Someone"),
    splitType: String(expense?.splitType || "equal"),
    participantCount: Array.isArray(expense?.participants) ? expense.participants.length : 0,
  };
}

function collectInvolvedMemberIds(before, after, groupMemberIds, actorUid) {
  const groupMemberSet = new Set(groupMemberIds || []);
  const ids = new Set();

  [before, after].forEach(expense => {
    if (expense?.paidBy?.uid) ids.add(String(expense.paidBy.uid));
    if (Array.isArray(expense?.participants)) {
      expense.participants.forEach(participant => {
        if (participant?.uid) ids.add(String(participant.uid));
      });
    }
  });

  return [...ids]
    .filter(uid => uid !== actorUid)
    .filter(uid => groupMemberSet.has(uid))
    .sort();
}

function getActorName(actorUid, group, afterExpense) {
  const member = Array.isArray(group?.members)
    ? group.members.find(item => item?.uid === actorUid)
    : null;
  if (member?.name) return member.name;
  if (afterExpense?.paidBy?.uid === actorUid && afterExpense?.paidBy?.name) return afterExpense.paidBy.name;
  return "Someone";
}

function getExpenseTitle(expense) {
  const title = normalizeDescription(expense?.description);
  return title || "an expense";
}

function formatChangedFieldsForDetail(changedFields) {
  const labels = changedFields.map(field => field.label);
  if (labels.length === 0) return "Expense updated";
  if (labels.length === 1) return `${labels[0]} changed`;
  if (labels.length === 2) return `${labels[0]} and ${labels[1]} changed`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]} changed`;
}

function buildNotificationBody(actorName, expenseTitle, groupName, changedFields) {
  const keys = new Set(changedFields.map(field => field.key));
  if (keys.size === 1 && keys.has("amount")) {
    return `${actorName} changed the amount for ${expenseTitle}.`;
  }
  if (keys.size === 1 && keys.has("participants")) {
    return `${actorName} updated the split for ${expenseTitle}.`;
  }
  if (keys.size === 1 && keys.has("category")) {
    return `${actorName} changed the category for ${expenseTitle}.`;
  }
  return `${actorName} updated ${expenseTitle} in ${groupName || "a group"}.`;
}

function makeExpenseUpdateIds(expenseId, updateVersion, changedFields) {
  const fieldHash = hashChangedFields(changedFields);
  const baseId = [
    "expense_updated",
    sanitizeIdPart(expenseId),
    sanitizeIdPart(updateVersion),
    fieldHash,
  ].join("_");

  return {
    activityId: baseId,
    notificationIdForUser: uid => `${baseId}_${sanitizeIdPart(uid)}`,
    fieldHash,
  };
}

async function handleExpenseUpdateActivity({ db, event }) {
  const before = event.data?.before?.data();
  const after = event.data?.after?.data();
  const expenseId = event.params.expenseId;

  if (!before || !after) return;
  if (before.groupId !== after.groupId) return;

  const changedFields = detectMeaningfulExpenseChanges(before, after);
  if (changedFields.length === 0) return;

  const actorUid = String(after.updatedBy || "");
  if (!actorUid) return;

  const groupDoc = await db.collection("groups").doc(after.groupId).get();
  if (!groupDoc.exists) return;

  const group = groupDoc.data();
  const groupMemberIds = Array.isArray(group.memberIds) ? group.memberIds.map(String) : [];
  if (!groupMemberIds.includes(actorUid)) return;

  const updateVersion = toMillis(after.updatedAt) || Date.parse(event.time) || Date.now();
  const { activityId, notificationIdForUser, fieldHash } = makeExpenseUpdateIds(
    expenseId,
    updateVersion,
    changedFields,
  );
  const actorName = getActorName(actorUid, group, after);
  const expenseTitle = getExpenseTitle(after);
  const involvedMemberIds = collectInvolvedMemberIds(before, after, groupMemberIds, actorUid);
  const createdAt = updateVersion;
  const batch = db.batch();

  const activityRef = db
    .collection("groups")
    .doc(after.groupId)
    .collection("activity")
    .doc(activityId);

  batch.set(activityRef, {
    id: activityId,
    type: "expense_updated",
    groupId: after.groupId,
    expenseId,
    actorUid,
    actorName,
    expenseTitle,
    changedFields: changedFields.map(field => field.label),
    changedFieldKeys: changedFields.map(field => field.key),
    changedFieldsHash: fieldHash,
    previousSummary: buildCompactExpenseSummary(before),
    newSummary: buildCompactExpenseSummary(after),
    createdAt,
    involvedMemberIds,
    demo: false,
  });

  involvedMemberIds.forEach(userId => {
    const notificationId = notificationIdForUser(userId);
    const notificationRef = db.collection("notifications").doc(notificationId);
    batch.set(notificationRef, {
      id: notificationId,
      userId,
      title: "Expense updated",
      body: buildNotificationBody(actorName, expenseTitle, group.name, changedFields),
      type: "expense",
      subtype: "expense_updated",
      read: false,
      createdAt,
      data: {
        groupId: after.groupId,
        expenseId,
      },
    });
  });

  await batch.commit();
}

function createHandleExpenseUpdateFunction(db, onDocumentUpdated) {
  return onDocumentUpdated("expenses/{expenseId}", async event => {
    await handleExpenseUpdateActivity({ db, event });
  });
}

module.exports = {
  buildCompactExpenseSummary,
  buildNotificationBody,
  collectInvolvedMemberIds,
  createHandleExpenseUpdateFunction,
  detectMeaningfulExpenseChanges,
  formatChangedFieldsForDetail,
  handleExpenseUpdateActivity,
  hashChangedFields,
  makeExpenseUpdateIds,
  normalizeParticipants,
};
