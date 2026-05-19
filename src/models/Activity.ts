export type GroupActivityType = 'expense_updated';

export interface ExpenseUpdateActivity {
  id: string;
  type: GroupActivityType;
  groupId: string;
  expenseId: string;
  actorUid: string;
  actorName: string;
  expenseTitle: string;
  changedFields: string[];
  changedFieldKeys?: string[];
  changedFieldsHash?: string;
  previousSummary?: {
    amount: number;
    category: string;
    paidByName: string;
    splitType: string;
    participantCount: number;
  };
  newSummary?: {
    amount: number;
    category: string;
    paidByName: string;
    splitType: string;
    participantCount: number;
  };
  createdAt: number;
  involvedMemberIds: string[];
  demo?: boolean;
}

export type GroupActivity = ExpenseUpdateActivity;
