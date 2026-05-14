import { Platform } from 'react-native';
import firebaseApp from '@react-native-firebase/app';
import type { Purchase } from 'react-native-iap';
import { auth } from '../../services/firebase';
import {
  getPlanIdForProduct,
  isSplitProAiProductId,
  type SplitProAiPlanId,
  type SplitProAiProductId,
} from './products';

export type VerifyGooglePlayPurchaseInput = {
  productId: SplitProAiProductId;
  purchaseToken: string;
  packageName?: string | null;
  transactionId?: string | null;
  transactionDate?: number | null;
  purchaseState?: string | null;
  isAutoRenewing?: boolean | null;
  isAcknowledged?: boolean | null;
  platform: 'android';
};

export type VerifyGooglePlayPurchaseOutput = {
  success: boolean;
  entitlementActive: boolean;
  plan: SplitProAiPlanId;
  expiresAt?: string;
};

export class PurchaseVerificationUnavailableError extends Error {
  constructor() {
    super('Purchase verification is temporarily unavailable.');
    this.name = 'PurchaseVerificationUnavailableError';
  }
}

export function buildGooglePlayPurchasePayload(purchase: Purchase): VerifyGooglePlayPurchaseInput {
  if (Platform.OS !== 'android') {
    throw new Error('Google Play purchase verification is only available on Android.');
  }

  if (!isSplitProAiProductId(purchase.productId)) {
    throw new Error('This purchase does not match a SplitPro AI subscription product.');
  }

  if (!purchase.purchaseToken) {
    throw new Error('Google Play did not return a purchase token.');
  }

  return {
    productId: purchase.productId,
    purchaseToken: purchase.purchaseToken,
    packageName: 'packageNameAndroid' in purchase ? purchase.packageNameAndroid : null,
    transactionId: purchase.transactionId ?? purchase.id ?? null,
    transactionDate: purchase.transactionDate ?? null,
    purchaseState: purchase.purchaseState ?? null,
    isAutoRenewing: purchase.isAutoRenewing ?? null,
    isAcknowledged: 'isAcknowledgedAndroid' in purchase ? purchase.isAcknowledgedAndroid : null,
    platform: 'android',
  };
}

export async function verifyPurchaseWithBackend(
  input: VerifyGooglePlayPurchaseInput,
): Promise<VerifyGooglePlayPurchaseOutput> {
  if (!input.productId || !input.purchaseToken) {
    throw new Error('Purchase verification requires a product ID and purchase token.');
  }

  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Sign in before verifying a purchase.');
  }

  const projectId = firebaseApp.app().options.projectId;
  if (!projectId) {
    throw new PurchaseVerificationUnavailableError();
  }

  const idToken = await currentUser.getIdToken();
  const response = await fetch(`https://us-central1-${projectId}.cloudfunctions.net/verifyGooglePlayPurchase`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      data: {
        productId: input.productId,
        purchaseToken: input.purchaseToken,
        platform: 'android',
      },
    }),
  });

  const body = await response.json().catch(() => null);
  if (!response.ok || body.error) {
    throw new PurchaseVerificationUnavailableError();
  }

  if (!body?.result) {
    throw new PurchaseVerificationUnavailableError();
  }

  return body.result as VerifyGooglePlayPurchaseOutput;
}

export function getExpectedPlanForVerification(input: VerifyGooglePlayPurchaseInput): SplitProAiPlanId {
  return getPlanIdForProduct(input.productId);
}
