import type { Expense, Category } from '../models/Expense';

export interface CategorySummary {
  category: Category;
  amount: number;
  percentage: number;
}

/**
 * Calculates total spending per category for a set of expenses.
 * Only considers expenses where the specified user was a participant.
 */
export function calculateSpendingByCategory(expenses: Expense[], userId: string): CategorySummary[] {
  const categoryTotals: Record<string, number> = {};
  let totalSpending = 0;

  expenses.forEach(expense => {
    const myShare = expense.participants.find(p => p.uid === userId);
    if (myShare && expense.splitType !== 'payment') {
      const amount = myShare.amount;
      categoryTotals[expense.category] = (categoryTotals[expense.category] || 0) + amount;
      totalSpending += amount;
    }
  });

  if (totalSpending === 0) return [];

  return Object.entries(categoryTotals)
    .map(([category, amount]) => ({
      category: category as Category,
      amount,
      percentage: (amount / totalSpending) * 100,
    }))
    .sort((a, b) => b.amount - a.amount);
}
