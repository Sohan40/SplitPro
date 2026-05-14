import type { ProductSubscription } from 'react-native-iap';

export const SPLITPRO_AI_MONTHLY_PRODUCT_ID = 'splitpro_ai_monthly';
export const SPLITPRO_AI_YEARLY_PRODUCT_ID = 'splitpro_ai_yearly';

export const SPLITPRO_AI_SUBSCRIPTION_PRODUCT_IDS = [
  SPLITPRO_AI_MONTHLY_PRODUCT_ID,
  SPLITPRO_AI_YEARLY_PRODUCT_ID,
] as const;

export type SplitProAiProductId = typeof SPLITPRO_AI_SUBSCRIPTION_PRODUCT_IDS[number];
export type SplitProAiPlanId = 'ai_monthly' | 'ai_yearly';

export type SplitProSubscriptionProduct = {
  productId: SplitProAiProductId;
  planId: SplitProAiPlanId;
  title: string;
  periodLabel: string;
  badge?: string;
  priceText: string;
  description: string;
  offerToken: string | null;
  product: ProductSubscription;
};

const PLAN_COPY: Record<SplitProAiProductId, Omit<SplitProSubscriptionProduct, 'priceText' | 'offerToken' | 'product'>> = {
  [SPLITPRO_AI_MONTHLY_PRODUCT_ID]: {
    productId: SPLITPRO_AI_MONTHLY_PRODUCT_ID,
    planId: 'ai_monthly',
    title: 'Monthly',
    periodLabel: 'Flexible monthly access',
    description: 'AI summaries and group Q&A with monthly renewal.',
  },
  [SPLITPRO_AI_YEARLY_PRODUCT_ID]: {
    productId: SPLITPRO_AI_YEARLY_PRODUCT_ID,
    planId: 'ai_yearly',
    title: 'Yearly',
    periodLabel: 'Best for regular groups',
    badge: 'Best value',
    description: 'A full year of AI insights for active expense groups.',
  },
};

export function isSplitProAiProductId(productId: string): productId is SplitProAiProductId {
  return SPLITPRO_AI_SUBSCRIPTION_PRODUCT_IDS.includes(productId as SplitProAiProductId);
}

export function getPlanIdForProduct(productId: SplitProAiProductId): SplitProAiPlanId {
  return PLAN_COPY[productId].planId;
}

function getOfferToken(product: ProductSubscription): string | null {
  if (product.platform !== 'android') {
    return null;
  }

  return product.subscriptionOffers?.[0]?.offerTokenAndroid
    ?? product.subscriptionOfferDetailsAndroid?.[0]?.offerToken
    ?? null;
}

export function toSplitProSubscriptionProduct(product: ProductSubscription): SplitProSubscriptionProduct | null {
  if (!isSplitProAiProductId(product.id)) {
    return null;
  }

  return {
    ...PLAN_COPY[product.id],
    priceText: product.displayPrice || 'Price unavailable',
    offerToken: getOfferToken(product),
    product,
  };
}
