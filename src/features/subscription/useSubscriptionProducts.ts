import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import {
  endConnection,
  fetchProducts,
  initConnection,
  type ProductSubscription,
} from 'react-native-iap';
import {
  SPLITPRO_AI_SUBSCRIPTION_PRODUCT_IDS,
  toSplitProSubscriptionProduct,
  type SplitProAiProductId,
  type SplitProSubscriptionProduct,
} from './products';

type SubscriptionProductsState = {
  products: SplitProSubscriptionProduct[];
  loading: boolean;
  error: string | null;
  billingReady: boolean;
  missingProductIds: SplitProAiProductId[];
  reload: () => Promise<void>;
};

function normalizeError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Unable to load Google Play subscriptions right now.';
}

export function useSubscriptionProducts(): SubscriptionProductsState {
  const [products, setProducts] = useState<SplitProSubscriptionProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [billingReady, setBillingReady] = useState(false);

  const loadProducts = useCallback(async () => {
    if (Platform.OS !== 'android') {
      setProducts([]);
      setError('Google Play subscriptions are available only on Android.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await initConnection();
      setBillingReady(true);
      const result = await fetchProducts({
        skus: [...SPLITPRO_AI_SUBSCRIPTION_PRODUCT_IDS],
        type: 'subs',
      });
      const subscriptionProducts = (result ?? [])
        .map(product => toSplitProSubscriptionProduct(product as ProductSubscription))
        .filter((product): product is SplitProSubscriptionProduct => product !== null);

      setProducts(subscriptionProducts);
    } catch (loadError) {
      setProducts([]);
      setBillingReady(false);
      setError(normalizeError(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      await loadProducts();
      if (!isMounted) {
        return;
      }
    };

    load();

    return () => {
      isMounted = false;
      endConnection().catch(() => undefined);
    };
  }, [loadProducts]);

  const missingProductIds = useMemo(() => (
    SPLITPRO_AI_SUBSCRIPTION_PRODUCT_IDS.filter(
      productId => !products.some(product => product.productId === productId),
    )
  ), [products]);

  return {
    products,
    loading,
    error,
    billingReady,
    missingProductIds,
    reload: loadProducts,
  };
}
