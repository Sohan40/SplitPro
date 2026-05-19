export type NotificationType = 'expense' | 'group_add' | 'general';
export type NotificationSubtype = 'expense_updated';

export interface Notification {
  id: string;
  userId: string; // The user receiving the notification
  title: string;
  body: string;
  type: NotificationType;
  subtype?: NotificationSubtype;
  read: boolean;
  createdAt: number;
  data?: {
    groupId?: string;
    expenseId?: string;
  };
}
