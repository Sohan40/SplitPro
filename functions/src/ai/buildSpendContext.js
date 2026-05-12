const CATEGORY_LABELS = {
  food: "Food",
  groceries: "Groceries",
  rent: "Rent",
  utilities: "Utilities",
  transport: "Travel",
  travel: "Travel",
  shopping: "Shopping",
  entertainment: "Entertainment",
  health: "Health",
  others: "Other",
  other: "Other",
  payment: "Other",
};

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function getMonthKey(timestamp) {
  const date = new Date(timestamp);
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}`;
}

function sanitizeText(value, fallback, maxLength = 80) {
  const text = String(value || fallback || "")
    .replace(/[^\S\r\n]+/g, " ")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email removed]")
    .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, "[phone removed]")
    .trim();

  if (!text) return fallback;
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

function normalizeCategory(category) {
  if (!category) return "Other";
  return CATEGORY_LABELS[String(category).toLowerCase()] || "Other";
}

function isSpendExpense(expense, groupId) {
  return expense.groupId === groupId
    && expense.splitType !== "payment"
    && expense.category !== "payment"
    && Number.isFinite(Number(expense.amount))
    && Number(expense.amount) > 0;
}

function getOrCreateMember(members, uid, fallbackName) {
  const safeUid = String(uid || "unknown");
  const existing = members.get(safeUid);
  if (existing) return existing;

  const member = {
    displayName: sanitizeText(fallbackName, "Unknown member", 48),
    paid: 0,
    owedShare: 0,
  };
  members.set(safeUid, member);
  return member;
}

function buildMemberMap(group) {
  const members = new Map();
  (group.members || []).forEach((member) => {
    const uid = String(member.uid || "");
    if (!uid) return;
    members.set(uid, {
      displayName: sanitizeText(member.name, "Unknown member", 48),
      paid: 0,
      owedShare: 0,
    });
  });
  return members;
}

function buildMonthlyTrend(expenses, selectedMonthKey) {
  const totals = new Map();

  expenses.forEach((expense) => {
    const monthKey = getMonthKey(Number(expense.createdAt));
    totals.set(monthKey, (totals.get(monthKey) || 0) + Number(expense.amount));
  });

  if (!totals.has(selectedMonthKey)) {
    totals.set(selectedMonthKey, 0);
  }

  return Array.from(totals.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([monthKey, amount]) => ({ monthKey, amount: roundMoney(amount) }));
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function buildSpendContext({ group, expenses, monthKey }) {
  const groupExpenses = expenses.filter((expense) => isSpendExpense(expense, group.id));
  const selectedExpenses = groupExpenses.filter((expense) => (
    getMonthKey(Number(expense.createdAt)) === monthKey
  ));

  const totalSpend = roundMoney(
    selectedExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0),
  );
  const categoryTotals = new Map();
  const memberMap = buildMemberMap(group);

  selectedExpenses.forEach((expense) => {
    const amount = Number(expense.amount);
    const category = normalizeCategory(expense.category);
    categoryTotals.set(category, (categoryTotals.get(category) || 0) + amount);

    const payer = getOrCreateMember(memberMap, expense.paidBy?.uid, expense.paidBy?.name);
    payer.paid += amount;

    (expense.participants || []).forEach((participant) => {
      const member = getOrCreateMember(memberMap, participant.uid, participant.name);
      const share = Number(participant.amount);
      member.owedShare += Number.isFinite(share) ? share : 0;
    });
  });

  const categoryBreakdown = Array.from(categoryTotals.entries())
    .map(([category, amount]) => ({
      category,
      amount: roundMoney(amount),
      percentage: totalSpend > 0 ? Math.round((amount / totalSpend) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);

  const memberStats = Array.from(memberMap.values())
    .map((member) => ({
      displayName: member.displayName,
      paid: roundMoney(member.paid),
      owedShare: roundMoney(member.owedShare),
      net: roundMoney(member.paid - member.owedShare),
    }))
    .sort((a, b) => b.paid - a.paid || a.displayName.localeCompare(b.displayName))
    .slice(0, 20);

  const topExpenses = [...selectedExpenses]
    .sort((a, b) => Number(b.amount) - Number(a.amount))
    .slice(0, 8)
    .map((expense) => ({
      title: sanitizeText(expense.description, "Untitled expense", 80),
      amount: roundMoney(expense.amount),
      category: normalizeCategory(expense.category),
      paidByName: sanitizeText(expense.paidBy?.name, "Unknown payer", 48),
      date: formatDate(Number(expense.createdAt)),
    }));

  return {
    groupName: sanitizeText(group.name, undefined, 64),
    monthKey,
    currency: "INR",
    totalSpend,
    expenseCount: selectedExpenses.length,
    categoryBreakdown,
    memberStats,
    monthlyTrend: buildMonthlyTrend(groupExpenses, monthKey),
    topExpenses,
  };
}

module.exports = {
  buildSpendContext,
  getMonthKey,
  sanitizeText,
};
