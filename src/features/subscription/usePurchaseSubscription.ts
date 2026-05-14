import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import {
  ErrorCode,
  finishTransaction,
  getAvailablePurchases,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  restorePurchases as restoreStorePurchases,
  type Purchase,
  type PurchaseError,
} from 'react-native-iap';
import { isSplitProAiProductId, type SplitProSubscriptionProduct } from './products';
import {
  PurchaseVerificationUnavailableError,
  buildGooglePlayPurchasePayload,
  getExpectedPlanForVerification,
  verifyPurchaseWithBackend,
} from './verifyPurchase';

export type PurchaseFlowStatus =
  | 'idle'
  | 'purchase_in_progress'
  | 'pending'
  | 'verifying'
  | 'verified'
  | 'verification_failed'
  | 'cancelled'
  | 'restoring'
  | 'error';

type PurchaseFlowState = {
  status: PurchaseFlowStatus;
  message: string | null;
  activeProductId: string | null;
};

type PurchaseSubscriptionActions = PurchaseFlowState & {
  isBusy: boolean;
  startPurchase: (product: SplitProSubscriptionProduct) => Promise<void>;
  restorePurchases: () => Promise<void>;
  resetPurchaseMessage: () => void;
};

const DEFAULT_STATE: PurchaseFlowState = {
  status: 'idle',
  message: null,
  activeProductId: null,
};

function messageForPurchaseError(error: PurchaseError): string {
  switch (error.code) {
    case ErrorCode.UserCancelled:
      return 'Purchase cancelled.';
    case ErrorCode.BillingUnavailable:
    case ErrorCode.IapNotAvailable:
      return 'Google Play Billing is not available on this device.';
    case ErrorCode.ItemUnavailable:
    case ErrorCode.SkuNotFound:
    case ErrorCode.SkuOfferMismatch:
      return 'This subscription plan is not available in Google Play yet.';
    case ErrorCode.NetworkError:
    case ErrorCode.ServiceDisconnected:
    case ErrorCode.ServiceTimeout:
      return 'Google Play could not be reached. Check your connection and try again.';
    case ErrorCode.AlreadyOwned:
      return 'Google Play says this subscription is already owned. Use restore to verify it.';
    case ErrorCode.Pending:
    case ErrorCode.DeferredPayment:
      return 'Purchase is pending. Access will update after Google Play and the backend confirm it.';
    default:
      return error.message || 'Purchase failed. Please try again.';
  }
}

function isVerificationUnavailable(error: unknown): error is PurchaseVerificationUnavailableError {
  return error instanceof PurchaseVerificationUnavailableError;
}

export function usePurchaseSubscription(): PurchaseSubscriptionActions {
  const [state, setState] = useState<PurchaseFlowState>(DEFAULT_STATE);

  const processPurchase = useCallback(async (purchase: Purchase) => {
    if (!isSplitProAiProductId(purchase.productId)) {
      return;
    }

    setState({
      status: purchase.purchaseState === 'pending' ? 'pending' : 'verifying',
      message: purchase.purchaseState === 'pending'
        ? 'Purchase is pending. Access will update after Google Play and the backend confirm it.'
        : 'Verifying purchase with SplitPro...',
      activeProductId: purchase.productId,
    });

    if (purchase.purchaseState === 'pending') {
      return;
    }

    try {
      const payload = buildGooglePlayPurchasePayload(purchase);
      const result = await verifyPurchaseWithBackend(payload);

      if (result.success && result.entitlementActive) {
        await finishTransaction({ purchase, isConsumable: false });
        setState({
          status: 'verified',
          message: `${getExpectedPlanForVerification(payload)} verified. AI access will refresh from your account entitlement.`,
          activeProductId: purchase.productId,
        });
        return;
      }

      setState({
        status: 'verification_failed',
        message: 'Purchase was received, but backend entitlement is not active yet.',
        activeProductId: purchase.productId,
      });
    } catch (verificationError) {
      setState({
        status: 'verification_failed',
        message: isVerificationUnavailable(verificationError)
          ? verificationError.message
          : verificationError instanceof Error
            ? verificationError.message
            : 'Purchase verification failed. AI access was not unlocked.',
        activeProductId: purchase.productId,
      });
    }
  }, []);

  useEffect(() => {
    const updateSubscription = purchaseUpdatedListener(purchase => {
      processPurchase(purchase).catch(error => {
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Unable to process this purchase.',
          activeProductId: purchase.productId,
        });
      });
    });

    const errorSubscription = purchaseErrorListener(error => {
      const isCancelled = error.code === ErrorCode.UserCancelled;
      setState({
        status: isCancelled ? 'cancelled' : 'error',
        message: messageForPurchaseError(error),
        activeProductId: null,
      });
    });

    return () => {
      updateSubscription.remove();
      errorSubscription.remove();
    };
  }, [processPurchase]);

  const startPurchase = useCallback(async (product: SplitProSubscriptionProduct) => {
    if (Platform.OS !== 'android') {
      setState({
        status: 'error',
        message: 'Google Play checkout is available only on Android.',
        activeProductId: product.productId,
      });
      return;
    }

    if (!product.offerToken) {
      setState({
        status: 'error',
        message: 'Google Play did not return a purchase offer for this plan.',
        activeProductId: product.productId,
      });
      return;
    }

    setState({
      status: 'purchase_in_progress',
      message: 'Opening Google Play checkout...',
      activeProductId: product.productId,
    });

    try {
      await requestPurchase({
        type: 'subs',
        request: {
          google: {
            skus: [product.productId],
            subscriptionOffers: [{
              sku: product.productId,
              offerToken: product.offerToken,
            }],
          },
        },
      });
    } catch (purchaseError) {
      setState({
        status: 'error',
        message: purchaseError instanceof Error
          ? purchaseError.message
          : 'Unable to start Google Play checkout.',
        activeProductId: product.productId,
      });
    }
  }, []);

  const restorePurchases = useCallback(async () => {
    if (Platform.OS !== 'android') {
      setState({
        status: 'error',
        message: 'Google Play restore is available only on Android.',
        activeProductId: null,
      });
      return;
    }

    setState({
      status: 'restoring',
      message: 'Checking Google Play for previous purchases...',
      activeProductId: null,
    });

    try {
      await restoreStorePurchases();
      const purchases = await getAvailablePurchases({ includeSuspendedAndroid: false });
      const splitProPurchases = purchases.filter(purchase => isSplitProAiProductId(purchase.productId));

      if (splitProPurchases.length === 0) {
        setState({
          status: 'idle',
          message: 'No active SplitPro AI purchase was found for this Google Play account.',
          activeProductId: null,
        });
        return;
      }

      await processPurchase(splitProPurchases[0]);
    } catch (restoreError) {
      setState({
        status: 'error',
        message: restoreError instanceof Error
          ? restoreError.message
          : 'Unable to restore purchases right now.',
        activeProductId: null,
      });
    }
  }, [processPurchase]);

  const resetPurchaseMessage = useCallback(() => {
    setState(DEFAULT_STATE);
  }, []);

  return {
    ...state,
    isBusy: state.status === 'purchase_in_progress' || state.status === 'verifying' || state.status === 'restoring',
    startPurchase,
    restorePurchases,
    resetPurchaseMessage,
  };
}
