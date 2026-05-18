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
  education: "Education",
  subscriptions: "Subscriptions",
  gifts: "Gifts",
  pets: "Pets",
  fitness: "Fitness",
  sports: "Sports",
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

function buildWeekendPattern(expenses) {
  const stats = {
    weekdayAmount: 0,
    weekdayCount: 0,
    weekendAmount: 0,
    weekendCount: 0,
  };

  expenses.forEach((expense) => {
    const day = new Date(Number(expense.createdAt)).getDay();
    const isWeekend = day === 0 || day === 6;
    if (isWeekend) {
      stats.weekendAmount += Number(expense.amount);
      stats.weekendCount += 1;
    } else {
      stats.weekdayAmount += Number(expense.amount);
      stats.weekdayCount += 1;
    }
  });

  const weekdayAverage = stats.weekdayCount
    ? stats.weekdayAmount / stats.weekdayCount
    : 0;
  const weekendAverage = stats.weekendCount
    ? stats.weekendAmount / stats.weekendCount
    : 0;

  return {
    weekdayAverage: roundMoney(weekdayAverage),
    weekendAverage: roundMoney(weekendAverage),
    weekendShare: roundMoney(stats.weekdayAmount + stats.weekendAmount > 0
      ? (stats.weekendAmount / (stats.weekdayAmount + stats.weekendAmount)) * 100
      : 0),
  };
}

function buildSettlementHints(group) {
  const balances = group.balances || {};
  const memberNames = new Map((group.members || []).map((member) => [
    String(member.uid || ""),
    sanitizeText(member.name, "Unknown member", 48),
  ]));
  const debtors = Object.entries(balances)
    .filter(([, balance]) => Number(balance) < -0.01)
    .sort((a, b) => Number(a[1]) - Number(b[1]));
  const creditors = Object.entries(balances)
    .filter(([, balance]) => Number(balance) > 0.01)
    .sort((a, b) => Number(b[1]) - Number(a[1]));
  const topDebtor = debtors[0];
  const topCreditor = creditors[0];

  if (!topDebtor || !topCreditor) {
    return [];
  }

  const amount = Math.min(Math.abs(Number(topDebtor[1])), Number(topCreditor[1]));
  return [
    `${memberNames.get(topDebtor[0]) || "One member"} could prioritize settling about INR ${roundMoney(amount)} with ${memberNames.get(topCreditor[0]) || "another member"}.`,
  ];
}

function getHealthLabel(score) {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Needs attention";
  return "Unbalanced";
}

function buildGroupHealth({ totalSpend, expenseCount, categoryBreakdown, memberStats }) {
  let score = 100;
  const tips = [];
  const totalAbsNet = memberStats.reduce((sum, member) => sum + Math.abs(Number(member.net || 0)), 0);
  const topCategoryShare = Number(categoryBreakdown[0]?.percentage || 0);
  const topPaid = Math.max(...memberStats.map((member) => Number(member.paid || 0)), 0);
  const topPayerShare = totalSpend > 0 ? Math.round((topPaid / totalSpend) * 100) : 0;
  const activeMembers = memberStats.filter((member) => (
    Number(member.paid || 0) > 0 || Number(member.owedShare || 0) > 0
  )).length;
  const participationShare = memberStats.length > 0
    ? Math.round((activeMembers / memberStats.length) * 100)
    : 0;
  const settlementLoad = totalSpend > 0
    ? Math.round((totalAbsNet / (totalSpend * 2)) * 100)
    : 0;

  if (settlementLoad > 35) {
    score -= 20;
    tips.push("Consider settling the largest open balances before adding many more expenses.");
  } else if (settlementLoad > 18) {
    score -= 10;
    tips.push("A quick settlement round could keep balances easier to manage.");
  }

  if (topPayerShare > 70) {
    score -= 15;
    tips.push("Try rotating who pays so one person does not carry most expenses.");
  } else if (topPayerShare > 50) {
    score -= 8;
    tips.push("One member is paying a lot, so settling sooner may help the group feel balanced.");
  }

  if (topCategoryShare >= 60) {
    score -= 15;
    tips.push(`Review ${categoryBreakdown[0]?.category || "the top category"} because it makes up most of this month's spend.`);
  } else if (topCategoryShare >= 40) {
    score -= 8;
    tips.push(`Keep an eye on ${categoryBreakdown[0]?.category || "the top category"} next month.`);
  }

  if (participationShare < 50 && memberStats.length > 1) {
    score -= 10;
    tips.push("Some members have little activity this month; check whether all shared expenses were recorded.");
  } else if (participationShare < 75 && memberStats.length > 2) {
    score -= 5;
  }

  if (expenseCount < 3) {
    score -= 15;
    tips.push("Add a few more expenses before treating these patterns as reliable.");
  } else if (expenseCount < 6) {
    score -= 8;
    tips.push("More expense entries will make the monthly pattern clearer.");
  }

  const boundedScore = Math.max(35, Math.min(100, Math.round(score)));
  const defaultTips = [
    "Keep categories clean so future insights are easier to understand.",
    "Settle balances regularly so the group stays simple.",
    "Use this as a SplitPro app insight, not financial advice.",
  ];

  return {
    score: boundedScore,
    label: getHealthLabel(boundedScore),
    explanation: "SplitPro's app score looks at settlement cleanliness, payment spread, category concentration, member participation, and tracking volume. It is not financial advice.",
    tips: [...tips, ...defaultTips].slice(0, 3),
  };
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

  const topPayer = memberStats.find((member) => member.paid > 0);
  const topCategory = categoryBreakdown[0];
  const groupHealth = buildGroupHealth({
    totalSpend,
    expenseCount: selectedExpenses.length,
    categoryBreakdown,
    memberStats,
  });
  const monthlyTrend = buildMonthlyTrend(groupExpenses, monthKey);
  const selectedTrendIndex = monthlyTrend.findIndex((item) => item.monthKey === monthKey);
  const previousTrend = selectedTrendIndex > 0 ? monthlyTrend[selectedTrendIndex - 1] : null;
  const currentTrend = monthlyTrend.find((item) => item.monthKey === monthKey) || null;
  const trendChange = previousTrend && currentTrend
    ? roundMoney(currentTrend.amount - previousTrend.amount)
    : null;

  const topExpenses = [...selectedExpenses]
    .sort((a, b) => Number(b.amount) - Number(a.amount))
    .slice(0, 8)
    .map((expense) => ({
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
    dataQuality: {
      limitedData: selectedExpenses.length < 3,
      reason: selectedExpenses.length < 3
        ? "Fewer than three expenses are available for the selected month."
        : "Enough expense data is available for directional patterns.",
    },
    categoryBreakdown,
    memberStats,
    groupHealth,
    monthlyTrend,
    trendSummary: {
      previousMonthSpend: previousTrend ? previousTrend.amount : null,
      selectedMonthSpend: currentTrend ? currentTrend.amount : totalSpend,
      monthOverMonthChange: trendChange,
    },
    concentration: {
      topCategory: topCategory ? {
        category: topCategory.category,
        percentage: topCategory.percentage,
      } : null,
      topPayer: topPayer ? {
        displayName: topPayer.displayName,
        paidShare: totalSpend > 0 ? Math.round((topPayer.paid / totalSpend) * 100) : 0,
      } : null,
    },
    weekendPattern: buildWeekendPattern(selectedExpenses),
    settlementHints: buildSettlementHints(group),
    topExpenses,
  };
}

module.exports = {
  buildSpendContext,
  getMonthKey,
  sanitizeText,
};
