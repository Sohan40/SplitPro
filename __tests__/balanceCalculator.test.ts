import { calculateUserSummary, hasOutstandingBalances } from '../src/utils/balanceCalculator';
import type { Group } from '../src/models/Group';

const buildGroup = (id: string, balance: number): Group => ({
  id,
  name: `Group ${id}`,
  createdBy: 'owner-1',
  members: [],
  memberIds: ['user-1'],
  balances: { 'user-1': balance },
  createdAt: 1,
  updatedAt: 1,
});

describe('balanceCalculator', () => {
  it('computes the summary totals for a user across groups', () => {
    const groups = [buildGroup('a', -125.5), buildGroup('b', 40), buildGroup('c', 10.25)];

    expect(calculateUserSummary(groups, 'user-1')).toEqual({
      totalBalance: -75.25,
      youOwe: 125.5,
      youAreOwed: 50.25,
    });
  });

  it('flags unsettled balances only when they are materially non-zero', () => {
    expect(hasOutstandingBalances([buildGroup('a', 0), buildGroup('b', 0.009)], 'user-1')).toBe(false);
    expect(hasOutstandingBalances([buildGroup('a', -0.02)], 'user-1')).toBe(true);
    expect(hasOutstandingBalances([buildGroup('a', 1.5)], 'user-1')).toBe(true);
  });
});
