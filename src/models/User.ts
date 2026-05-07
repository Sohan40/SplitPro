export interface User {
  id: string;
  name: string;
  email: string;
  photoUrl: string | null;
  createdAt: number;
  fcmTokens?: string[]; // FCM device tokens for push notifications
}
