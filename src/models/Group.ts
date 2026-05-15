import type { CurrencyCode } from '../utils/currency';

export interface GroupMember {
  uid: string;
  name: string;
  email: string;
  photoUrl: string | null;
}

export interface Group {
  id: string;
  name: string;
  createdBy: string;
  members: GroupMember[];
  memberIds: string[]; // Flat array of UIDs for Firestore queries
  balances: Record<string, number>; // uid -> net balance (positive = owed, negative = owes)
  currency?: CurrencyCode; // Immutable after creation. Missing old groups fall back to default currency.
  createdAt: number;
  updatedAt: number;
}
