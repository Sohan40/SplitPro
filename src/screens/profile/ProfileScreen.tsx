import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Avatar from '../../components/Avatar';
import Button from '../../components/Button';
import { borderRadius, spacing, type ThemeColors, type ThemeTypography } from '../../components/theme';
import { useAuth } from '../../context/AuthContext';
import { useCurrency } from '../../context/CurrencyContext';
import { useTheme } from '../../context/ThemeContext';
import { useAiEntitlement } from '../../features/ai/hooks/useAiEntitlement';
import type { AiEntitlement, UserAiUsage } from '../../models/User';
import type { ProfileScreenProps } from '../../navigation/types';
import { groupService } from '../../services/groupService';
import { userService } from '../../services/userService';
import { warnUnlessPermissionDeniedAfterSignOut } from '../../services/firestoreErrorUtils';
import { calculateUserSummary } from '../../utils/balanceCalculator';
import { AuthBackground } from '../auth/AuthScreenPrimitives';

type SummaryState = {
  totalBalance: number;
  youOwe: number;
  youAreOwed: number;
};

function toMillis(value: AiEntitlement['expiresAt'] | UserAiUsage['resetAt'] | undefined | null): number | null {
  if (!value) return null;
  if (typeof value === 'number') return value;
  if (typeof value.toMillis === 'function') return value.toMillis();
  return null;
}

function formatDate(value: AiEntitlement['expiresAt'] | UserAiUsage['resetAt'] | undefined | null): string | null {
  const millis = toMillis(value);
  if (!millis) return null;

  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(millis));
}

function getProviderLabel(provider?: AiEntitlement['provider']): string {
  switch (provider) {
    case 'google_play':
      return 'Google Play';
    case 'manual_test':
      return 'Test entitlement';
    default:
      return 'Backend entitlement';
  }
}

function getStatusLabel(status: string): string {
  return status
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function ProfileScreen({ navigation }: ProfileScreenProps) {
  const { user } = useAuth();
  const { formatAmount } = useCurrency();
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const styles = useMemo(() => createStyles(colors, typography), [colors, typography]);
  const entitlement = useAiEntitlement();
  const [summary, setSummary] = useState<SummaryState>({
    totalBalance: 0,
    youOwe: 0,
    youAreOwed: 0,
  });
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [newName, setNewName] = useState(user?.name || '');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (!user) return;

    let isActive = true;

    const fetchSummary = async () => {
      try {
        const groups = await groupService.getUserGroups(user.id);
        if (!isActive) return;

        const data = calculateUserSummary(groups, user.id);
        setSummary(data);
      } catch (error) {
        warnUnlessPermissionDeniedAfterSignOut('Failed to load profile summary:', error);
      }
    };

    fetchSummary();

    return () => {
      isActive = false;
    };
  }, [user]);

  const openEditModal = () => {
    setNewName(user?.name || '');
    setIsEditModalVisible(true);
  };

  const handleUpdateName = async () => {
    if (!user || !newName.trim()) return;

    try {
      setUpdating(true);
      await userService.updateUserName(user.id, newName.trim());
      setIsEditModalVisible(false);
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error: any) {
      console.error(error);
      Alert.alert('Error', error.message || 'Failed to update profile');
    } finally {
      setUpdating(false);
    }
  };

  const netBalanceColor = summary.totalBalance >= 0 ? colors.primary : colors.owes;
  const aiEntitlement = user?.entitlement?.ai;
  const accessUntil = formatDate(aiEntitlement?.expiresAt);
  const usageResetAt = formatDate(user?.aiUsage?.resetAt);
  const primaryForeground = colors.black;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <AuthBackground>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.identityPanel}>
            <View style={styles.avatarFrame}>
              <Avatar name={user?.name || 'User'} size={86} />
            </View>

            <View style={styles.nameRow}>
              <Text style={styles.userName} numberOfLines={1}>
                {user?.name || 'User'}
              </Text>
              <TouchableOpacity activeOpacity={0.8} onPress={openEditModal} style={styles.editNameButton}>
                <Icon name="pencil" size={15} color={colors.primary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.userEmail} numberOfLines={1}>
              {user?.email || 'No email address'}
            </Text>
          </View>

          {/* My QR Code */}
          <TouchableOpacity
            style={styles.qrCodeButton}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('MyQrCode')}
          >
            <View style={[styles.qrCodeIcon, { backgroundColor: colors.primaryLight }]}>
              <Icon name="qr-code-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.qrCodeCopy}>
              <Text style={styles.qrCodeTitle}>My QR Code</Text>
              <Text style={styles.qrCodeSubtitle}>Let others scan to add you to groups</Text>
            </View>
            <Icon name="chevron-forward" size={18} color={colors.textTertiary} />
          </TouchableOpacity>

          <View style={styles.balanceHero}>
            <View>
              <Text style={styles.balanceLabel}>Total Balance</Text>
              <Text style={[styles.balanceAmount, { color: netBalanceColor }]}>
                {formatAmount(summary.totalBalance)}
              </Text>
            </View>
            <View style={[styles.balanceIcon, { backgroundColor: colors.primaryLight }]}>
              <Icon name="wallet-outline" size={24} color={colors.primary} />
            </View>
          </View>

          <View style={styles.summaryRow}>
            <View style={[styles.summaryTile, styles.summaryTileLeft]}>
              <View style={[styles.tileIcon, { backgroundColor: colors.owedLight }]}>
                <Icon name="trending-up-outline" size={18} color={colors.owed} />
              </View>
              <Text style={styles.tileLabel}>You are owed</Text>
              <Text style={[styles.tileAmount, { color: colors.owed }]}>
                {formatAmount(summary.youAreOwed)}
              </Text>
            </View>

            <View style={styles.summaryTile}>
              <View style={[styles.tileIcon, { backgroundColor: colors.owesLight }]}>
                <Icon name="trending-down-outline" size={18} color={colors.owes} />
              </View>
              <Text style={styles.tileLabel}>You owe</Text>
              <Text style={[styles.tileAmount, { color: colors.owes }]}>
                {formatAmount(summary.youOwe)}
              </Text>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Subscription</Text>
          </View>

          <View
            style={[
              styles.subscriptionCard,
              entitlement.isAiEntitled && {
                backgroundColor: colors.owedLight,
                borderColor: colors.owed,
              },
            ]}>
            <View style={styles.subscriptionHeader}>
              <View
                style={[
                  styles.subscriptionIcon,
                  { backgroundColor: entitlement.isAiEntitled ? colors.owedLight : colors.primaryLight },
                ]}>
                <Icon
                  name={entitlement.isAiEntitled ? 'shield-checkmark-outline' : 'sparkles-outline'}
                  size={22}
                  color={entitlement.isAiEntitled ? colors.owed : colors.primary}
                />
              </View>
              <View style={styles.subscriptionCopy}>
                <Text style={styles.subscriptionTitle}>
                  {entitlement.isAiEntitled ? 'SplitPro AI active' : 'Upgrade to SplitPro AI'}
                </Text>
                <Text style={styles.subscriptionText}>
                  {entitlement.isAiEntitled
                    ? 'Your AI access is verified by backend entitlement.'
                    : 'Unlock AI spend summaries, budget suggestions, and expense insights.'}
                </Text>
              </View>
            </View>

            {entitlement.isLoading ? (
              <Text style={styles.subscriptionMeta}>Checking subscription...</Text>
            ) : entitlement.isAiEntitled ? (
              <View style={styles.subscriptionDetails}>
                <SubscriptionDetail label="Plan" styles={styles} value={entitlement.planLabel} />
                <SubscriptionDetail
                  label="Status"
                  styles={styles}
                  value={getStatusLabel(entitlement.statusLabel)}
                />
                <SubscriptionDetail
                  label="Provider"
                  styles={styles}
                  value={getProviderLabel(aiEntitlement?.provider)}
                />
                {accessUntil ? (
                  <SubscriptionDetail label="Access until" styles={styles} value={accessUntil} />
                ) : null}
                {entitlement.usageLimit !== null && entitlement.usageUsed !== null ? (
                  <SubscriptionDetail
                    label="AI credits"
                    styles={styles}
                    value={`${entitlement.usageUsed}/${entitlement.usageLimit} used`}
                  />
                ) : null}
                {usageResetAt ? (
                  <SubscriptionDetail label="Credits reset" styles={styles} value={usageResetAt} />
                ) : null}
              </View>
            ) : (
              <Button
                icon={<Icon name="sparkles-outline" size={17} color={primaryForeground} />}
                onPress={() => navigation.navigate('UpgradeAi')}
                size="md"
                style={styles.upgradeButton}
                title="Upgrade"
              />
            )}
          </View>

          <Text style={styles.version}>SplitPro v1.0.0</Text>
        </ScrollView>
      </AuthBackground>

      <Modal
        animationType="fade"
        onRequestClose={() => setIsEditModalVisible(false)}
        transparent
        visible={isEditModalVisible}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Update Profile</Text>
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => setIsEditModalVisible(false)}
                style={styles.modalClose}>
                <Icon name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Display Name</Text>
            <TextInput
              autoFocus
              onChangeText={setNewName}
              placeholder="Your name"
              placeholderTextColor={colors.textTertiary}
              selectionColor={colors.primary}
              style={styles.input}
              value={newName}
            />

            <Button
              disabled={updating}
              loading={updating}
              onPress={handleUpdateName}
              title={updating ? 'Updating...' : 'Save Changes'}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

type SubscriptionDetailProps = {
  label: string;
  value: string;
  styles: ReturnType<typeof createStyles>;
};

function SubscriptionDetail({ label, value, styles }: SubscriptionDetailProps) {
  return (
    <View style={styles.subscriptionDetailRow}>
      <Text style={styles.subscriptionDetailLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.subscriptionDetailValue}>
        {value}
      </Text>
    </View>
  );
}

const createStyles = (colors: ThemeColors, typography: ThemeTypography) => StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingBottom: spacing.huge,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },
  identityPanel: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    paddingTop: spacing.sm,
  },
  avatarFrame: {
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderColor: colors.borderLight,
    borderRadius: 54,
    borderWidth: 1,
    height: 108,
    justifyContent: 'center',
    width: 108,
  },
  nameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.md,
    maxWidth: '100%',
  },
  userName: {
    ...typography.heading1,
    flexShrink: 1,
    textAlign: 'center',
  },
  editNameButton: {
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderColor: colors.borderLight,
    borderRadius: 15,
    borderWidth: 1,
    height: 30,
    justifyContent: 'center',
    marginLeft: spacing.sm,
    width: 30,
  },
  userEmail: {
    ...typography.caption,
    marginTop: 2,
    maxWidth: '100%',
    textAlign: 'center',
  },
  qrCodeButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceContainer,
    borderColor: colors.borderLight,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: spacing.md,
    padding: spacing.lg,
  },
  qrCodeIcon: {
    alignItems: 'center',
    borderRadius: 16,
    height: 40,
    justifyContent: 'center',
    marginRight: spacing.md,
    width: 40,
  },
  qrCodeCopy: {
    flex: 1,
  },
  qrCodeTitle: {
    ...typography.bodyBold,
  },
  qrCodeSubtitle: {
    ...typography.caption,
    marginTop: 2,
  },
  balanceHero: {
    alignItems: 'center',
    backgroundColor: colors.surfaceContainer,
    borderColor: colors.borderLight,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    minHeight: 108,
    padding: spacing.xl,
  },
  balanceLabel: {
    ...typography.captionBold,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  balanceAmount: {
    ...typography.amountLarge,
  },
  balanceIcon: {
    alignItems: 'center',
    borderRadius: 22,
    height: 48,
    justifyContent: 'center',
    marginLeft: spacing.md,
    width: 48,
  },
  summaryRow: {
    flexDirection: 'row',
    marginBottom: spacing.xxl,
  },
  summaryTile: {
    backgroundColor: colors.surfaceContainer,
    borderColor: colors.borderLight,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    flex: 1,
    minHeight: 126,
    padding: spacing.lg,
  },
  summaryTileLeft: {
    marginRight: spacing.md,
  },
  tileIcon: {
    alignItems: 'center',
    borderRadius: 16,
    height: 34,
    justifyContent: 'center',
    marginBottom: spacing.md,
    width: 34,
  },
  tileLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  tileAmount: {
    ...typography.bodyBold,
    fontSize: 17,
  },
  sectionHeader: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.heading3,
  },
  subscriptionCard: {
    backgroundColor: colors.surfaceContainer,
    borderColor: colors.borderLight,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginBottom: spacing.xxl,
    padding: spacing.lg,
  },
  subscriptionHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
  },
  subscriptionIcon: {
    alignItems: 'center',
    borderRadius: 20,
    height: 42,
    justifyContent: 'center',
    marginRight: spacing.md,
    width: 42,
  },
  subscriptionCopy: {
    flex: 1,
  },
  subscriptionTitle: {
    ...typography.bodyBold,
  },
  subscriptionText: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
  subscriptionMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.lg,
  },
  subscriptionDetails: {
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  subscriptionDetailRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  subscriptionDetailLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    flex: 1,
  },
  subscriptionDetailValue: {
    ...typography.captionBold,
    color: colors.textPrimary,
    flex: 1,
    marginLeft: spacing.md,
    textAlign: 'right',
  },
  upgradeButton: {
    marginTop: spacing.lg,
  },
  version: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: spacing.xxxl,
    textAlign: 'center',
  },
  modalOverlay: {
    backgroundColor: colors.overlay,
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalContent: {
    backgroundColor: colors.surfaceContainer,
    borderColor: colors.borderLight,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: spacing.xl,
    width: '100%',
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    ...typography.heading3,
  },
  modalClose: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  modalLabel: {
    ...typography.captionBold,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  input: {
    ...typography.body,
    backgroundColor: colors.surfaceContainerHigh,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.xl,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: 0,
  },
});
