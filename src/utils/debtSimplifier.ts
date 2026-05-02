export interface Debt {
  from: string;
  to: string;
  amount: number;
}

/**
 * Simplifies the debts within a group to minimize the number of transactions.
 * uses a greedy approach: match the person who owes the most with the person who is owed the most.
 */
export function simplifyDebts(balances: Record<string, number>): Debt[] {
  const simplifiedDebts: Debt[] = [];

  // Create two lists: people who owe (negatives) and people who are owed (positives)
  let debtors = Object.entries(balances)
    .filter(([_, balance]) => balance < -0.01)
    .map(([uid, balance]) => ({ uid, amount: Math.abs(balance) }))
    .sort((a, b) => b.amount - a.amount);

  let creditors = Object.entries(balances)
    .filter(([_, balance]) => balance > 0.01)
    .map(([uid, balance]) => ({ uid, amount: balance }))
    .sort((a, b) => b.amount - a.amount);

  while (debtors.length > 0 && creditors.length > 0) {
    const debtor = debtors[0];
    const creditor = creditors[0];

    const settleAmount = Math.min(debtor.amount, creditor.amount);

    simplifiedDebts.push({
      from: debtor.uid,
      to: creditor.uid,
      amount: Math.round(settleAmount * 100) / 100,
    });

    debtor.amount -= settleAmount;
    creditor.amount -= settleAmount;

    if (debtor.amount < 0.01) {
      debtors.shift();
    }
    if (creditor.amount < 0.01) {
      creditors.shift();
    }
  }

  return simplifiedDebts;
}
