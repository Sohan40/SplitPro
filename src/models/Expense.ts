export type SplitType = 'equal' | 'custom' | 'percentage' | 'shares' | 'payment';

export type Category =
  | 'rent'
  | 'groceries'
  | 'utilities'
  | 'food'
  | 'transport'
  | 'entertainment'
  | 'others'
  | 'payment';

export const CATEGORIES: { key: Category; label: string; icon: string }[] = [
  { key: 'food', label: 'Food & Drink', icon: 'restaurant' },
  { key: 'groceries', label: 'Groceries', icon: 'cart' },
  { key: 'rent', label: 'Rent', icon: 'home' },
  { key: 'utilities', label: 'Utilities', icon: 'flash' },
  { key: 'transport', label: 'Transport', icon: 'car' },
  { key: 'entertainment', label: 'Entertainment', icon: 'film' },
  { key: 'payment', label: 'Payment', icon: 'cash' },
  { key: 'others', label: 'Others', icon: 'ellipsis-horizontal' },
];

export interface ExpenseParticipant {
  uid: string;
  name: string;
  amount: number; // Resolved amount this person owes
}

export interface Expense {
  id: string;
  groupId: string;
  description: string;
  amount: number;
  category: Category;
  paidBy: { uid: string; name: string };
  splitType: SplitType;
  participants: ExpenseParticipant[];
  createdBy: string;
  createdAt: number;
  updatedBy?: string;
  updatedAt?: number;
}
