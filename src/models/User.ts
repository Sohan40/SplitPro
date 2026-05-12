import type { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

type FirestoreDateValue = number | FirebaseFirestoreTypes.Timestamp;

export type AiEntitlementPlan = 'free' | 'ai_monthly' | 'ai_yearly' | 'test';

export type AiEntitlementStatus =
  | 'inactive'
  | 'active'
  | 'expired'
  | 'cancelled'
  | 'grace_period'
  | 'on_hold'
  | 'revoked';

export type AiEntitlementProvider = 'none' | 'google_play' | 'manual_test';

export interface AiEntitlement {
  active: boolean;
  plan: AiEntitlementPlan;
  status: AiEntitlementStatus;
  provider: AiEntitlementProvider;
  expiresAt: FirebaseFirestoreTypes.Timestamp | null;
  updatedAt: FirestoreDateValue;
}

export interface UserEntitlement {
  ai: AiEntitlement;
}

export interface UserAiUsage {
  periodKey: string;
  used: number;
  limit: number;
  resetAt: FirestoreDateValue;
  updatedAt: FirestoreDateValue;
}

export interface User {
  id: string;
  name: string;
  email: string;
  photoUrl: string | null;
  createdAt: FirestoreDateValue;
  updatedAt?: FirestoreDateValue;
  fcmTokens?: string[]; // FCM device tokens for push notifications

  // Server-owned entitlement and usage fields. Mobile code may read these
  // values but must never write them.
  entitlement?: UserEntitlement;
  aiUsage?: UserAiUsage;

  // Server-owned compatibility fields for older premium checks, if present.
  isPro?: boolean;
  plan?: string;
  subscriptionStatus?: string;
}
