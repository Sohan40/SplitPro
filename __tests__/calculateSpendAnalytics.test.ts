import {
  calculateSpendAnalytics,
  getMonthKey,
} from '../src/features/analytics/calculateSpendAnalytics';
import type { Expense } from '../src/models/Expense';
import type { Group } from '../src/models/Group';

const group: Group = {
  id: 'group-1',
  name: 'Trip',
  createdBy: 'u1',
  members: [
    { uid: 'u1', name: 'Sohan', email: 'sohan@example.com', photoUrl: null },
    { uid: 'u2', name: 'Asha', email: 'asha@example.com', photoUrl: null },
    { uid: 'u3', name: 'Dev', email: 'dev@example.com', photoUrl: null },
  ],
  memberIds: ['u1', 'u2', 'u3'],
  balances: {},
  createdAt: 1,
  updatedAt: 1,
};

const expense = (overrides: Partial<Expense>): Expense => ({
  id: 'expense-1',
  groupId: 'group-1',
  description: 'Dinner',
  amount: 300,
  category: 'food',
  paidBy: { uid: 'u1', name: 'Sohan' },
  splitType: 'equal',
  participants: [
    { uid: 'u1', name: 'Sohan', amount: 100 },
    { uid: 'u2', name: 'Asha', amount: 100 },
    { uid: 'u3', name: 'Dev', amount: 100 },
  ],
  createdBy: 'u1',
  createdAt: new Date('2026-05-10T12:00:00Z').getTime(),
  ...overrides,
});

describe('calculateSpendAnalytics', () => {
  it('calculates totals, categories, members, top expenses, and insights', () => {
    const summary = calculateSpendAnalytics({
      group,
      monthKey: '2026-05',
      expenses: [
        expense({ id: 'food-1', amount: 300, category: 'food' }),
        expense({
          id: 'rent-1',
          description: 'Rent',
          amount: 900,
          category: 'rent',
          paidBy: { uid: 'u2', name: 'Asha' },
          participants: [
            { uid: 'u1', name: 'Sohan', amount: 300 },
            { uid: 'u2', name: 'Asha', amount: 300 },
            { uid: 'u3', name: 'Dev', amount: 300 },
          ],
        }),
        expense({
          id: 'settle-1',
          amount: 200,
          category: 'payment',
          splitType: 'payment',
        }),
        expense({
          id: 'old-1',
          amount: 500,
          createdAt: new Date('2026-04-10T12:00:00Z').getTime(),
        }),
      ],
    });

    expect(summary.totalSpend).toBe(1200);
    expect(summary.expenseCount).toBe(2);
    expect(summary.categoryBreakdown).toEqual([
      { category: 'Rent', amount: 900, percentage: 75 },
      { category: 'Food', amount: 300, percentage: 25 },
    ]);
    expect(summary.memberStats.find(member => member.uid === 'u1')).toMatchObject({
      paid: 300,
      owedShare: 400,
      net: -100,
    });
    expect(summary.memberStats.find(member => member.uid === 'u2')).toMatchObject({
      paid: 900,
      owedShare: 400,
      net: 500,
    });
    expect(summary.topExpenses[0]).toMatchObject({
      id: 'rent-1',
      title: 'Rent',
      amount: 900,
      paidByName: 'Asha',
    });
    expect(summary.deterministicInsights.length).toBeGreaterThan(0);
  });

  it('returns a safe empty summary for a month with no expenses', () => {
    const summary = calculateSpendAnalytics({
      group,
      monthKey: '2026-05',
      expenses: [expense({ createdAt: new Date('2026-04-10T12:00:00Z').getTime() })],
    });

    expect(summary.totalSpend).toBe(0);
    expect(summary.expenseCount).toBe(0);
    expect(summary.categoryBreakdown).toEqual([]);
    expect(summary.topExpenses).toEqual([]);
    expect(summary.memberStats).toHaveLength(3);
    expect(summary.deterministicInsights).toEqual([
      'No group spending is recorded for this month yet.',
    ]);
  });

  it('keeps custom categories visible in the breakdown', () => {
    const summary = calculateSpendAnalytics({
      group,
      monthKey: '2026-05',
      expenses: [
        expense({ id: 'fuel-1', amount: 250, category: 'fuel' as any }),
        expense({ id: 'home-1', amount: 150, category: 'home_supplies' as any }),
      ],
    });

    expect(summary.categoryBreakdown).toEqual([
      { category: 'Fuel', amount: 250, percentage: 63 },
      { category: 'Home Supplies', amount: 150, percentage: 38 },
    ]);
  });

  it('formats month keys from timestamps', () => {
    expect(getMonthKey(new Date('2026-05-01T00:00:00Z').getTime())).toBe('2026-05');
  });
});
