import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Button from '../../components/Button';
import GlassCard from '../../components/GlassCard';
import { borderRadius, spacing, type ThemeColors, type ThemeTypography } from '../../components/theme';
import { useTheme } from '../../context/ThemeContext';
import { useAiEntitlement } from '../../features/ai/hooks/useAiEntitlement';
import { SPLITPRO_AI_SUBSCRIPTION_PRODUCT_IDS, type SplitProSubscriptionProduct } from '../../features/subscription/products';
import { usePurchaseSubscription } from '../../features/subscription/usePurchaseSubscription';
import { useSubscriptionProducts } from '../../features/subscription/useSubscriptionProducts';

const FEATURES = [
  'AI spend summaries',
  'Category-wise insights',
  'Smart budget suggestions',
  'Ask AI about expenses',
];

type PlanCardProps = {
  product: SplitProSubscriptionProduct;
  isBusy: boolean;
  active: boolean;
  isEntitled: boolean;
  onPress: (product: SplitProSubscriptionProduct) => void;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
};

function PlanCard({ product, isBusy, active, isEntitled, onPress, styles, colors }: PlanCardProps) {
  const unavailable = !product.offerToken;
  const priceText = product.priceText || 'Price unavailable';

  return (
    <GlassCard padding="none" style={[styles.planCard, active && styles.planCardActive]}>
      <View style={styles.planCardContent}>
        <View style={styles.planHeader}>
          <View style={styles.planTitleRow}>
            <Text style={styles.planTitle}>{product.title}</Text>
            {product.badge ? <Text style={styles.planBadge}>{product.badge}</Text> : null}
          </View>
          <Text style={styles.planMeta}>{product.periodLabel}</Text>
        </View>

        <View style={styles.planPriceBlock}>
          <Text style={styles.price}>{priceText}</Text>
          <Text style={styles.planDescription}>{product.description}</Text>
        </View>

        <Button
          title={isEntitled ? 'Unlocked' : unavailable ? 'Unavailable' : 'Choose plan'}
          onPress={() => onPress(product)}
          disabled={isBusy || unavailable || isEntitled}
          loading={isBusy && active}
          style={styles.planButton}
          icon={!isEntitled && !unavailable ? <Icon name="card-outline" size={17} color={colors.white} /> : undefined}
        />
      </View>
    </GlassCard>
  );
}

type SectionTitleProps = {
  title: string;
  subtitle?: string;
  styles: ReturnType<typeof createStyles>;
};

function SectionTitle({ title, subtitle, styles }: SectionTitleProps) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export default function UpgradeScreen() {
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const styles = useMemo(() => createStyles(colors, typography), [colors, typography]);
  const entitlement = useAiEntitlement();
  const subscriptionProducts = useSubscriptionProducts();
  const purchaseFlow = usePurchaseSubscription();

  const productById = useMemo(() => new Map(
    subscriptionProducts.products.map(product => [product.productId, product]),
  ), [subscriptionProducts.products]);

  const orderedProducts = useMemo(() => (
    SPLITPRO_AI_SUBSCRIPTION_PRODUCT_IDS
      .map(productId => productById.get(productId))
      .filter((product): product is SplitProSubscriptionProduct => product !== undefined)
  ), [productById]);

  const showProductUnavailable = !subscriptionProducts.loading
    && subscriptionProducts.products.length === 0
    && subscriptionProducts.error === null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroBadge}>
            <Icon name="sparkles-outline" size={14} color={colors.primary} />
            <Text style={styles.heroBadgeText}>AI Premium</Text>
          </View>
          <Text style={styles.title}>Unlock smarter spending</Text>
          <Text style={styles.subtitle}>Unlock smart spend insights, summaries, and budget suggestions.</Text>
        </View>

        <GlassCard
          padding="none"
          style={entitlement.isAiEntitled ? styles.entitledCard : styles.noticeCard}>
          <View style={styles.noticeContent}>
            <View style={styles.noticeIcon}>
              <Icon
                name={entitlement.isAiEntitled ? 'shield-checkmark-outline' : 'lock-closed-outline'}
                size={20}
                color={entitlement.isAiEntitled ? colors.owed : colors.primary}
              />
            </View>
            <View style={styles.noticeCopy}>
              <Text style={styles.noticeTitle}>
                {entitlement.isAiEntitled ? 'AI access verified' : 'Verification required'}
              </Text>
              <Text style={styles.noticeText}>
                {entitlement.isAiEntitled
                  ? `${entitlement.planLabel} is active from your backend entitlement.`
                  : 'Checkout starts in Google Play. AI unlocks only after SplitPro verifies your purchase.'}
              </Text>
            </View>
          </View>
        </GlassCard>

        <View style={styles.section}>
          <SectionTitle
            title="Choose your plan"
            subtitle="Prices are loaded from Google Play."
            styles={styles}
          />

          {subscriptionProducts.loading ? (
            <GlassCard padding="none" style={styles.stateCard}>
              <View style={styles.centerContent}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.centerTitle}>Loading plans</Text>
                <Text style={styles.centerText}>Fetching current prices from Google Play.</Text>
              </View>
            </GlassCard>
          ) : null}

          {subscriptionProducts.error ? (
            <GlassCard padding="none" style={styles.stateCard}>
              <View style={styles.statusContent}>
                <Icon name="alert-circle-outline" size={22} color={colors.warning} />
                <View style={styles.noticeCopy}>
                  <Text style={styles.noticeTitle}>Could not load plans from Google Play.</Text>
                  <Text style={styles.noticeText}>Check your connection and try again.</Text>
                  <Button
                    title="Retry"
                    variant="secondary"
                    size="sm"
                    onPress={subscriptionProducts.reload}
                    style={styles.inlineButton}
                  />
                </View>
              </View>
            </GlassCard>
          ) : null}

          {showProductUnavailable ? (
            <GlassCard padding="none" style={styles.stateCard}>
              <View style={styles.statusContent}>
                <Icon name="pricetag-outline" size={22} color={colors.warning} />
                <View style={styles.noticeCopy}>
                  <Text style={styles.noticeTitle}>Plans unavailable</Text>
                  <Text style={styles.noticeText}>Subscription products are not available for this build yet.</Text>
                </View>
              </View>
            </GlassCard>
          ) : null}

          {orderedProducts.length > 0 ? (
            <View style={styles.plans}>
              {orderedProducts.map(product => (
                <PlanCard
                  key={product.productId}
                  product={product}
                  isBusy={purchaseFlow.isBusy}
                  active={purchaseFlow.activeProductId === product.productId}
                  isEntitled={entitlement.isAiEntitled}
                  onPress={purchaseFlow.startPurchase}
                  styles={styles}
                  colors={colors}
                />
              ))}
            </View>
          ) : null}

          {subscriptionProducts.missingProductIds.length > 0 && orderedProducts.length > 0 ? (
            <Text style={styles.smallNote}>Some subscription plans are not available yet.</Text>
          ) : null}
        </View>

        <View style={styles.section}>
          <SectionTitle title="Included benefits" styles={styles} />
          <GlassCard padding="none" style={styles.featureCard}>
            <View style={styles.featureGrid}>
              {FEATURES.map(feature => (
                <View key={feature} style={styles.featureRow}>
                  <Icon name="checkmark-circle-outline" size={18} color={colors.owed} />
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
            </View>
          </GlassCard>
        </View>

        {purchaseFlow.message ? (
          <GlassCard padding="none" style={styles.stateCard}>
            <View style={styles.statusContent}>
              <Icon
                name={purchaseFlow.status === 'verification_failed' || purchaseFlow.status === 'error' ? 'alert-circle-outline' : 'time-outline'}
                size={22}
                color={purchaseFlow.status === 'verification_failed' || purchaseFlow.status === 'error' ? colors.warning : colors.primary}
              />
              <View style={styles.noticeCopy}>
                <Text style={styles.noticeTitle}>
                  {purchaseFlow.status === 'verification_failed'
                    ? 'Purchase pending verification'
                    : purchaseFlow.status === 'cancelled'
                      ? 'Purchase cancelled'
                      : purchaseFlow.status === 'verified'
                        ? 'Purchase verified'
                        : 'Purchase status'}
                </Text>
                <Text style={styles.noticeText}>{purchaseFlow.message}</Text>
              </View>
            </View>
          </GlassCard>
        ) : null}

        <View style={styles.actions}>
          <Button
            title="Restore purchase"
            variant="outline"
            onPress={purchaseFlow.restorePurchases}
            loading={purchaseFlow.status === 'restoring'}
            disabled={purchaseFlow.isBusy || !subscriptionProducts.billingReady}
            style={styles.restoreButton}
            icon={<Icon name="refresh-outline" size={17} color={colors.textPrimary} />}
          />
          <Text style={styles.smallNote}>
            Cancel anytime in Google Play. Restore checks purchases, then waits for backend verification.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: ThemeColors, typography: ThemeTypography) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.huge + spacing.xxxl,
    gap: spacing.xl,
  },
  hero: {
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    gap: spacing.sm,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primaryLight,
  },
  heroBadgeText: {
    ...typography.small,
    color: colors.primary,
    fontWeight: '600',
  },
  title: {
    ...typography.heading1,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 320,
  },
  section: {
    gap: spacing.md,
  },
  sectionHeader: {
    gap: spacing.xs,
  },
  sectionTitle: {
    ...typography.heading3,
  },
  sectionSubtitle: {
    ...typography.caption,
  },
  noticeCard: {
    borderColor: colors.borderLight,
  },
  entitledCard: {
    borderColor: colors.owed,
    backgroundColor: colors.owedLight,
  },
  noticeContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.lg,
  },
  noticeIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryLight,
  },
  noticeCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  noticeTitle: {
    ...typography.bodyBold,
  },
  noticeText: {
    ...typography.caption,
  },
  plans: {
    gap: spacing.md,
  },
  planCard: {
    borderColor: colors.borderLight,
  },
  planCardActive: {
    borderColor: colors.primary,
  },
  planCardContent: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  planHeader: {
    gap: spacing.xs,
  },
  planTitleRow: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  planTitle: {
    ...typography.heading3,
  },
  planMeta: {
    ...typography.caption,
  },
  planBadge: {
    ...typography.small,
    color: colors.primary,
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  planPriceBlock: {
    minHeight: 76,
    justifyContent: 'center',
  },
  price: {
    ...typography.amountLarge,
  },
  planDescription: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  planButton: {
    minHeight: 48,
  },
  featureCard: {
    borderColor: colors.borderLight,
  },
  featureGrid: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  featureText: {
    ...typography.caption,
    flex: 1,
  },
  stateCard: {
    borderColor: colors.borderLight,
  },
  centerContent: {
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  centerTitle: {
    ...typography.bodyBold,
  },
  centerText: {
    ...typography.caption,
    textAlign: 'center',
  },
  statusContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.lg,
  },
  inlineButton: {
    alignSelf: 'flex-start',
    marginTop: spacing.sm,
  },
  actions: {
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  restoreButton: {
    minHeight: 48,
  },
  smallNote: {
    ...typography.small,
    textAlign: 'center',
  },
});
