import type { Expense } from '../models/Expense';

function formatPersonName(uid: string | undefined, name: string | undefined, currentUserId?: string): string {
  if (uid && uid === currentUserId) {
    return 'You';
  }

  return name || 'Someone';
}

export function getSettlementDisplay(expense: Expense, currentUserId?: string): {
  title: string;
  label: string;
  involvesCurrentUser: boolean;
} {
  const recipient = expense.participants[0];
  const payerIsCurrentUser = expense.paidBy.uid === currentUserId;
  const recipientIsCurrentUser = recipient?.uid === currentUserId;
  const payerName = formatPersonName(expense.paidBy.uid, expense.paidBy.name, currentUserId);
  const recipientName = formatPersonName(recipient?.uid, recipient?.name, currentUserId);

  if (payerIsCurrentUser) {
    return {
      title: `You paid ${recipientName}`,
      label: 'You paid',
      involvesCurrentUser: true,
    };
  }

  if (recipientIsCurrentUser) {
    return {
      title: `${payerName} paid you`,
      label: 'You received',
      involvesCurrentUser: true,
    };
  }

  if (recipient) {
    return {
      title: `${payerName} paid ${recipientName}`,
      label: 'Settlement',
      involvesCurrentUser: false,
    };
  }

  return {
    title: `${payerName} recorded a settlement`,
    label: 'Settlement',
    involvesCurrentUser: false,
  };
}
