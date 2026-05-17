import type { Expense } from '../src/models/Expense';
import { getSettlementDisplay } from '../src/utils/expenseDisplay';

const settlement: Expense = {
  id: 'payment-1',
  groupId: 'group-1',
  description: 'Payment',
  amount: 500,
  category: 'payment',
  splitType: 'payment',
  paidBy: { uid: 'sohan', name: 'Sohan' },
  participants: [{ uid: 'ravi', name: 'Ravi', amount: 500 }],
  createdBy: 'sohan',
  createdAt: 1710000000000,
};

describe('expense display helpers', () => {
  it('shows payer perspective for settlements', () => {
    expect(getSettlementDisplay(settlement, 'sohan')).toEqual({
      title: 'You paid Ravi',
      label: 'You paid',
      involvesCurrentUser: true,
    });
  });

  it('shows recipient perspective for settlements', () => {
    expect(getSettlementDisplay(settlement, 'ravi')).toEqual({
      title: 'Sohan paid you',
      label: 'You received',
      involvesCurrentUser: true,
    });
  });

  it('does not say paid you for unrelated members', () => {
    expect(getSettlementDisplay(settlement, 'new-member')).toEqual({
      title: 'Sohan paid Ravi',
      label: 'Settlement',
      involvesCurrentUser: false,
    });
  });
});
