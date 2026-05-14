import { useMemo } from 'react';
import { useAuth } from '../../../context/AuthContext';
import type { AiEntitlement, UserAiUsage } from '../../../models/User';

type AiEntitlementState = {
  isAiEntitled: boolean;
  isLoading: boolean;
  planLabel: string;
  statusLabel: string;
  usageRemaining: number | null;
  usageLimit: number | null;
  usageUsed: number | null;
};

function toMillis(value: AiEntitlement['expiresAt']): number | null {
  if (!value) return null;
  if (typeof value === 'number') return value;
  if (typeof value.toMillis === 'function') return value.toMillis();
  return null;
}

function getPlanLabel(entitlement?: AiEntitlement): string {
  switch (entitlement?.plan) {
    case 'ai_monthly':
      return 'AI Monthly';
    case 'ai_yearly':
      return 'AI Yearly';
    case 'test':
      return 'Test AI';
    default:
      return 'Free';
  }
}

function getUsageRemaining(usage?: UserAiUsage): number | null {
  if (!usage || typeof usage.limit !== 'number' || typeof usage.used !== 'number') {
    return null;
  }

  return Math.max(usage.limit - usage.used, 0);
}

export function useAiEntitlement(): AiEntitlementState {
  const { user, loading } = useAuth();

  return useMemo(() => {
    const aiEntitlement = user?.entitlement?.ai;
    const expiresAtMs = toMillis(aiEntitlement?.expiresAt ?? null);
    const statusAllowsAccess = aiEntitlement?.status === 'active'
      || aiEntitlement?.status === 'grace_period'
      || aiEntitlement?.status === 'active_until_expiry';
    const isExpired = expiresAtMs !== null && expiresAtMs <= Date.now();
    const isAiEntitled = aiEntitlement?.active === true && statusAllowsAccess && !isExpired;
    const usageRemaining = getUsageRemaining(user?.aiUsage);

    return {
      isAiEntitled,
      isLoading: loading,
      planLabel: getPlanLabel(aiEntitlement),
      statusLabel: aiEntitlement?.status || 'inactive',
      usageRemaining,
      usageLimit: user?.aiUsage?.limit ?? null,
      usageUsed: user?.aiUsage?.used ?? null,
    };
  }, [loading, user]);
}
