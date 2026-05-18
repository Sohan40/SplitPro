import type { Expense } from '../../models/Expense';
import type { Group, GroupMember } from '../../models/Group';

export type SpendAnalyticsSummary = {
  groupId: string;
  monthKey: string;
  totalSpend: number;
  expenseCount: number;
  categoryBreakdown: Array<{
    category: string;
    amount: number;
    percentage: number;
  }>;
  memberStats: Array<{
    uid: string;
    displayName: string;
    paid: number;
    owedShare: number;
    net: number;
  }>;
  monthlyTrend: Array<{
    monthKey: string;
    amount: number;
  }>;
  topExpenses: Array<{
    id: string;
    title: string;
    amount: number;
    category: string;
    paidByName: string;
    date: string;
  }>;
  deterministicInsights: string[];
};

type MemberAccumulator = {
  uid: string;
  displayName: string;
  paid: number;
  owedShare: number;
};

const CATEGORY_LABELS: Record<string, string> = {
  food: 'Food',
  groceries: 'Groceries',
  rent: 'Rent',
  utilities: 'Utilities',
  transport: 'Travel',
  travel: 'Travel',
  shopping: 'Shopping',
  entertainment: 'Entertainment',
  health: 'Health',
  others: 'Other',
  other: 'Other',
  payment: 'Other',
};

function formatCustomCategory(category: string): string {
  return category
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ') || 'Other';
}

export function formatCurrency(amount: number, currency = 'INR'): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function getMonthKey(timestamp: number): string {
  const date = new Date(timestamp);
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}`;
}

export function getCurrentMonthKey(date = new Date()): string {
  return getMonthKey(date.getTime());
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeCategory(category?: string): string {
  const rawCategory = String(category || '').trim();
  if (!rawCategory) return 'Other';
  return CATEGORY_LABELS[rawCategory.toLowerCase()] || formatCustomCategory(rawCategory);
}

function isSpendExpense(expense: Expense): boolean {
  return expense.splitType !== 'payment'
    && expense.category !== 'payment'
    && Number.isFinite(expense.amount)
    && expense.amount > 0;
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function getOrCreateMember(
  members: Map<string, MemberAccumulator>,
  uid: string,
  fallbackName: string,
): MemberAccumulator {
  const existing = members.get(uid);
  if (existing) return existing;

  const member = {
    uid,
    displayName: fallbackName || 'Unknown member',
    paid: 0,
    owedShare: 0,
  };
  members.set(uid, member);
  return member;
}

function buildMemberMap(group: Group): Map<string, MemberAccumulator> {
  const map = new Map<string, MemberAccumulator>();
  group.members.forEach((member: GroupMember) => {
    map.set(member.uid, {
      uid: member.uid,
      displayName: member.name || member.email || 'Unknown member',
      paid: 0,
      owedShare: 0,
    });
  });
  return map;
}

function buildMonthlyTrend(expenses: Expense[], selectedMonthKey: string) {
  const totals = new Map<string, number>();

  expenses.forEach(expense => {
    const monthKey = getMonthKey(expense.createdAt);
    totals.set(monthKey, (totals.get(monthKey) || 0) + expense.amount);
  });

  if (!totals.has(selectedMonthKey)) {
    totals.set(selectedMonthKey, 0);
  }

  return Array.from(totals.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([monthKey, amount]) => ({
      monthKey,
      amount: roundMoney(amount),
    }));
}

function buildInsights(summary: Omit<SpendAnalyticsSummary, 'deterministicInsights'>, currency = 'INR'): string[] {
  if (summary.expenseCount === 0) {
    return ['No group spending is recorded for this month yet.'];
  }

  const insights = [
    `This month has ${summary.expenseCount} expenses totaling ${formatCurrency(summary.totalSpend, currency)}.`,
  ];

  const topCategory = summary.categoryBreakdown[0];
  if (topCategory) {
    insights.push(`${topCategory.category} is the highest spending category this month.`);
    if (topCategory.percentage >= 30) {
      insights.push(`${topCategory.category} expenses are ${topCategory.percentage}% of this month's group spend.`);
    }
  }

  const topPayer = [...summary.memberStats].sort((a, b) => b.paid - a.paid)[0];
  if (topPayer && topPayer.paid > 0) {
    insights.push(`${topPayer.displayName} paid the most in this group this month.`);
  }

  const netReceiver = [...summary.memberStats].sort((a, b) => b.net - a.net)[0];
  if (netReceiver && netReceiver.net > 0) {
    insights.push(`${netReceiver.displayName} is net positive by ${formatCurrency(netReceiver.net, currency)}.`);
  }

  return insights.slice(0, 4);
}

export function calculateSpendAnalytics(params: {
  group: Group;
  expenses: Expense[];
  monthKey?: string;
  currency?: string;
}): SpendAnalyticsSummary {
  const { group, expenses, monthKey = getCurrentMonthKey(), currency = 'INR' } = params;
  const groupExpenses = expenses
    .filter(expense => expense.groupId === group.id)
    .filter(isSpendExpense);
  const selectedExpenses = groupExpenses.filter(expense => getMonthKey(expense.createdAt) === monthKey);
  const totalSpend = roundMoney(selectedExpenses.reduce((sum, expense) => sum + expense.amount, 0));

  const categoryTotals = new Map<string, number>();
  const memberMap = buildMemberMap(group);

  selectedExpenses.forEach(expense => {
    const category = normalizeCategory(expense.category);
    categoryTotals.set(category, (categoryTotals.get(category) || 0) + expense.amount);

    const payer = getOrCreateMember(
      memberMap,
      expense.paidBy.uid,
      expense.paidBy.name || 'Unknown payer',
    );
    payer.paid += expense.amount;

    expense.participants.forEach(participant => {
      const member = getOrCreateMember(
        memberMap,
        participant.uid,
        participant.name || 'Unknown member',
      );
      member.owedShare += Number.isFinite(participant.amount) ? participant.amount : 0;
    });
  });

  const categoryBreakdown = Array.from(categoryTotals.entries())
    .map(([category, amount]) => ({
      category,
      amount: roundMoney(amount),
      percentage: totalSpend > 0 ? Math.round((amount / totalSpend) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const memberStats = Array.from(memberMap.values())
    .map(member => ({
      uid: member.uid,
      displayName: member.displayName,
      paid: roundMoney(member.paid),
      owedShare: roundMoney(member.owedShare),
      net: roundMoney(member.paid - member.owedShare),
    }))
    .sort((a, b) => b.paid - a.paid || a.displayName.localeCompare(b.displayName));

  const topExpenses = [...selectedExpenses]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
    .map(expense => ({
      id: expense.id,
      title: expense.description || 'Untitled expense',
      amount: roundMoney(expense.amount),
      category: normalizeCategory(expense.category),
      paidByName: expense.paidBy.name || 'Unknown payer',
      date: formatDate(expense.createdAt),
    }));

  const summaryWithoutInsights = {
    groupId: group.id,
    monthKey,
    totalSpend,
    expenseCount: selectedExpenses.length,
    categoryBreakdown,
    memberStats,
    monthlyTrend: buildMonthlyTrend(groupExpenses, monthKey),
    topExpenses,
  };

  return {
    ...summaryWithoutInsights,
    deterministicInsights: buildInsights(summaryWithoutInsights, currency),
  };
}
