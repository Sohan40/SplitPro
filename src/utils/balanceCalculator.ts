import type { Group } from '../models/Group';

export interface UserSummary {
  totalBalance: number;
  youOwe: number;
  youAreOwed: number;
}

/**
 * Calculates the total balance summary for a user across all their groups.
 */
export function calculateUserSummary(groups: Group[], userId: string): UserSummary {
  let youOwe = 0;
  let youAreOwed = 0;

  groups.forEach(group => {
    const balance = group.balances?.[userId] || 0;
    if (balance < 0) {
      youOwe += Math.abs(balance);
    } else if (balance > 0) {
      youAreOwed += balance;
    }
  });

  return {
    totalBalance: youAreOwed - youOwe,
    youOwe,
    youAreOwed,
  };
}

/**
 * Formats a balance for display (e.g., "+₹1,234.56" or "-₹1,234.56")
 */
export function formatBalance(amount: number): string {
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount).toFixed(2);
  const sign = isNegative ? '-' : (amount > 0 ? '+' : '');
  return `${sign}₹${absAmount}`;
}
