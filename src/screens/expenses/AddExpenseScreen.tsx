import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  Keyboard,
  Animated,
} from 'react-native';
import { colors, typography, spacing, borderRadius } from '../../components/theme';
import { useAuth } from '../../context/AuthContext';
import { groupService } from '../../services/groupService';
import { expenseService } from '../../services/expenseService';
import { notificationService } from '../../services/notificationService';
import type { Group } from '../../models/Group';
import type {
  Expense,
  Category,
  SplitType,
  ExpenseParticipant,
} from '../../models/Expense';
import type { AddExpenseScreenProps } from '../../navigation/types';
import {
  calculateEqualSplit,
  calculateCustomSplit,
  calculatePercentageSplit,
  calculateSharesSplit,
} from '../../utils/splitCalculator';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Avatar from '../../components/Avatar';
import CategoryIcon from '../../components/CategoryIcon';
import Icon from 'react-native-vector-icons/Ionicons';

type MemberInputState = {
  included: boolean;
  customAmount: string;
  percent: string;
  shares: string;
};

const defaultMemberInput: MemberInputState = {
  included: false,
  customAmount: '',
  percent: '0',
  shares: '0',
};

const formatCurrency = (value: number) => `\u20B9${value.toFixed(2)}`;

export default function AddExpenseScreen({
  route,
  navigation,
}: AddExpenseScreenProps) {
  const { groupId, groupName, expenseId } = route.params;
  const { user } = useAuth();
  const scrollViewRef = useRef<ScrollView>(null);
  const keyboardAnim = useRef(new Animated.Value(0)).current;

  const [group, setGroup] = useState<Group | null>(null);
  const [oldExpense, setOldExpense] = useState<Expense | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // -------------------------------------------------------------------------
  // Keyboard handling – animate the bottom padding so the Save button stays
  // visible when the keyboard appears.
  // -------------------------------------------------------------------------
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      Animated.timing(keyboardAnim, {
        toValue: e.endCoordinates.height * 0.85,
        duration: 250,
        useNativeDriver: false,
      }).start();
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      Animated.timing(keyboardAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start();
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [keyboardAnim]);

  // -------------------------------------------------------------------------
  // Form state
  // -------------------------------------------------------------------------
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Category>('others');
  const [splitType, setSplitType] = useState<SplitType>('equal');
  const [paidByUid, setPaidByUid] = useState<string>('');

  const [memberInputs, setMemberInputs] = useState<
    Record<string, MemberInputState>
  >({});

  // -------------------------------------------------------------------------
  // Load group + (optional) expense data
  // -------------------------------------------------------------------------
  useEffect(() => {
    const fetchData = async () => {
      try {
        const groupData = await groupService.getGroup(groupId);
        setGroup(groupData);

        if (groupData && user) {
          const initialInputs: Record<string, MemberInputState> = {};

          if (expenseId) {
            const exp = await expenseService.getExpense(expenseId);
            if (exp) {
              setOldExpense(exp);
              setDescription(exp.description);
              setAmount(exp.amount.toString());
              setCategory(exp.category);
              setSplitType(exp.splitType);
              setPaidByUid(exp.paidBy.uid);

              groupData.members.forEach((member) => {
                const participant = exp.participants.find(
                  (p) => p.uid === member.uid
                );
                initialInputs[member.uid] = {
                  included: !!participant,
                  customAmount: participant
                    ? participant.amount.toString()
                    : '',
                  percent: participant
                    ? ((participant.amount / exp.amount) * 100).toFixed(2)
                    : '0',
                  shares: participant ? '1' : '0',
                };
              });
            }
          } else {
            setPaidByUid(user.id);
            groupData.members.forEach((member) => {
              initialInputs[member.uid] = {
                included: true,
                customAmount: '',
                percent: (100 / groupData.members.length).toFixed(2),
                shares: '1',
              };
            });
          }

          setMemberInputs(initialInputs);
        }
      } catch (error) {
        console.error(error);
        Alert.alert('Error', 'Failed to load details.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [groupId, expenseId, user]);

  // -------------------------------------------------------------------------
  // Helpers to update member input state
  // -------------------------------------------------------------------------
  const updateMemberInput = (
    uid: string,
    field: keyof MemberInputState,
    value: boolean | string
  ) => {
    setMemberInputs((prev) => ({
      ...prev,
      [uid]: {
        ...(prev[uid] || {}),
        [field]: value as never,
      },
    }));
  };

  const toggleIncluded = (uid: string) => {
    updateMemberInput(uid, 'included', !memberInputs[uid]?.included);
  };

  const adjustShares = (uid: string, delta: number) => {
    const currentShares = parseInt(memberInputs[uid]?.shares || '0', 10);
    const nextShares = Math.max(0, currentShares + delta);
    updateMemberInput(uid, 'shares', String(nextShares));
  };

  // -------------------------------------------------------------------------
  // Build participants based on the selected split type
  // -------------------------------------------------------------------------
  const buildParticipants = (numAmount: number): ExpenseParticipant[] => {
    if (!group) return [];

    const includedMembers = group.members.filter(
      (member) => memberInputs[member.uid]?.included
    );

    switch (splitType) {
      case 'equal':
        return calculateEqualSplit(numAmount, includedMembers);
      case 'custom':
        return calculateCustomSplit(
          numAmount,
          includedMembers.map((member) => ({
            uid: member.uid,
            name: member.name,
            amount: parseFloat(memberInputs[member.uid]?.customAmount) || 0,
          }))
        );
      case 'percentage':
        return calculatePercentageSplit(
          numAmount,
          includedMembers.map((member) => ({
            uid: member.uid,
            name: member.name,
            percent: parseFloat(memberInputs[member.uid]?.percent) || 0,
          }))
        );
      case 'shares':
        return calculateSharesSplit(
          numAmount,
          includedMembers.map((member) => ({
            uid: member.uid,
            name: member.name,
            shares: parseFloat(memberInputs[member.uid]?.shares) || 0,
          }))
        );
      default:
        return [];
    }
  };

  // -------------------------------------------------------------------------
  // Build a preview map (uid -> amount) for the UI
  // -------------------------------------------------------------------------
  const buildPreviewMap = (): Record<string, number> => {
    if (!group) return {};

    const preview: Record<string, number> = {};
    const numAmount = parseFloat(amount);

    group.members.forEach((member) => {
      preview[member.uid] = 0;
    });

    if (Number.isNaN(numAmount) || numAmount <= 0) {
      return preview;
    }

    try {
      const participants = buildParticipants(numAmount);
      participants.forEach((p) => {
        preview[p.uid] = p.amount;
      });
    } catch {
      // Fallback for custom/percentage when calculation throws
      const includedMembers = group.members.filter(
        (member) => memberInputs[member.uid]?.included
      );

      if (splitType === 'custom') {
        includedMembers.forEach((member) => {
          preview[member.uid] =
            parseFloat(memberInputs[member.uid]?.customAmount) || 0;
        });
      } else if (splitType === 'percentage') {
        includedMembers.forEach((member) => {
          const percent = parseFloat(memberInputs[member.uid]?.percent) || 0;
          preview[member.uid] = Math.round(numAmount * (percent / 100) * 100) / 100;
        });
      }
    }

    return preview;
  };

  // -------------------------------------------------------------------------
  // Save handler – creates or updates the expense and updates balances
  // -------------------------------------------------------------------------
  const handleSave = async () => {
    if (!group || !user) return;

    const numAmount = parseFloat(amount);
    if (!description.trim() || Number.isNaN(numAmount) || numAmount <= 0) {
      Alert.alert(
        'Invalid Input',
        'Please enter a valid description and amount.'
      );
      return;
    }

    const includedMembers = group.members.filter(
      (member) => memberInputs[member.uid]?.included
    );
    if (includedMembers.length === 0) {
      Alert.alert(
        'Select Participants',
        'Please include at least one participant for this expense.'
      );
      return;
    }

    try {
      setSaving(true);
      const participants = buildParticipants(numAmount);
      const paidByMember = group.members.find((m) => m.uid === paidByUid);
      if (!paidByMember) throw new Error('Payer not found');

      const expenseData: Omit<Expense, 'id'> = {
        groupId,
        description: description.trim(),
        amount: numAmount,
        category,
        splitType,
        paidBy: { uid: paidByMember.uid, name: paidByMember.name },
        participants,
        createdBy: oldExpense ? oldExpense.createdBy : user.id,
        createdAt: oldExpense ? oldExpense.createdAt : Date.now(),
        ...(oldExpense
          ? {
              updatedBy: user.id,
              updatedAt: Date.now(),
            }
          : {}),
      };

      // ---------------------------------------------------------------
      // Update balances – first revert old expense (if any), then apply new
      // ---------------------------------------------------------------
      const newBalances = { ...group.balances };

      if (oldExpense) {
        // Revert old payer contribution
        newBalances[oldExpense.paidBy.uid] =
          (newBalances[oldExpense.paidBy.uid] || 0) - oldExpense.amount;
        // Revert old participants
        oldExpense.participants.forEach((p) => {
          newBalances[p.uid] = (newBalances[p.uid] || 0) + p.amount;
        });
      }

      // Apply new expense
      newBalances[paidByUid] = (newBalances[paidByUid] || 0) + numAmount;
      participants.forEach((p) => {
        newBalances[p.uid] = (newBalances[p.uid] || 0) - p.amount;
      });

      // ---------------------------------------------------------------
      // Persist expense + notifications
      // ---------------------------------------------------------------
      if (expenseId) {
        await expenseService.updateExpense(expenseId, expenseData);
      } else {
        await expenseService.addExpense(expenseData);

        const otherMemberIds = group.memberIds.filter((id) => id !== user.id);
        if (otherMemberIds.length > 0) {
          // Fire-and-forget: writing to Firestore triggers a Cloud Function
          // that sends push notifications to all recipients' devices.
          notificationService.createNotificationsForUsers(
            otherMemberIds,
            {
              title: 'New Expense',
              body: `${user.name} added "${description}" to ${groupName}`,
              type: 'expense',
              data: { groupId, expenseId: expenseId || '' },
            }
          ).catch((err: any) => console.warn('Notification creation failed:', err));
        }
      }

      await groupService.updateGroup(groupId, { balances: newBalances });
      navigation.goBack();
    } catch (error: any) {
      console.error(error);
      Alert.alert(
        'Failed to save expense',
        error.message || 'An error occurred.'
      );
    } finally {
      setSaving(false);
    }
  };

  // -------------------------------------------------------------------------
  // Render loading state
  // -------------------------------------------------------------------------
  if (loading || !group || Object.keys(memberInputs).length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  // -------------------------------------------------------------------------
  // UI
  // -------------------------------------------------------------------------
  const previewMap = buildPreviewMap();
  const categoryList: Category[] = [
    'food',
    'groceries',
    'transport',
    'rent',
    'utilities',
    'entertainment',
    'others',
  ];
  const splitTypes: { key: SplitType; label: string }[] = [
    { key: 'equal', label: '=' },
    { key: 'custom', label: '₹' },
    { key: 'percentage', label: '%' },
    { key: 'shares', label: 'Shares' },
  ];

  return (
    <Animated.View style={[styles.container, { paddingBottom: keyboardAnim }]}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Description & Amount */}
        <Card style={styles.section} padding="lg">
          <TextInput
            style={styles.descInput}
            placeholder="What was this for?"
            placeholderTextColor={colors.textTertiary}
            value={description}
            onChangeText={setDescription}
          />
          <View style={styles.amountContainer}>
            <Text style={styles.currencySymbol}>{'\u20B9'}</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="0.00"
              placeholderTextColor={colors.textTertiary}
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
            />
          </View>
        </Card>

        {/* Category selector */}
        <Text style={styles.sectionTitle}>Category</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryScroll}
        >
          {categoryList.map((cat) => (
            <TouchableOpacity
              key={cat}
              onPress={() => setCategory(cat)}
              style={[
                styles.categoryWrapper,
                category === cat && styles.categorySelected,
              ]}
            >
              <CategoryIcon category={cat} size={32} />
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Paid‑by selector */}
        <Text style={styles.sectionTitle}>Paid By</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.payerScroll}
        >
          {group.members.map((member) => (
            <TouchableOpacity
              key={member.uid}
              onPress={() => setPaidByUid(member.uid)}
              style={[
                styles.payerCard,
                paidByUid === member.uid && styles.payerSelected,
              ]}
            >
              <View
                style={[
                  styles.avatarBorder,
                  paidByUid === member.uid && styles.avatarBorderSelected,
                ]}
              >
                <Avatar name={member.name} size={50} />
                {paidByUid === member.uid && (
                  <View style={styles.payerCheckmark}>
                    <Icon
                      name="checkmark-circle"
                      size={20}
                      color={colors.primary}
                    />
                  </View>
                )}
              </View>
              <Text
                style={[
                  styles.payerName,
                  paidByUid === member.uid && styles.payerNameSelected,
                ]}
                numberOfLines={1}
              >
                {member.uid === user?.id ? 'You' : member.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Split type selector */}
        <Text style={styles.sectionTitle}>Split Options</Text>
        <View style={styles.splitOptionsRow}>
          {splitTypes.map((type) => (
            <TouchableOpacity
              key={type.key}
              onPress={() => setSplitType(type.key)}
              style={[
                styles.splitOption,
                splitType === type.key && styles.splitOptionSelected,
              ]}
            >
              <Text
                style={[
                  styles.splitOptionText,
                  splitType === type.key && styles.splitOptionTextSelected,
                ]}
              >
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Participants list */}
        <Card style={styles.participantsCard}>
          {group.members.map((member) => {
            const input = memberInputs[member.uid] || defaultMemberInput;
            const shares = parseInt(input?.shares || '0', 10);
            const isIncluded = input?.included;
            const previewAmount = previewMap[member.uid] || 0;

            return (
              <View key={member.uid} style={styles.participantRow}>
                {/* Checkbox */}
                <TouchableOpacity
                  onPress={() => toggleIncluded(member.uid)}
                  style={[
                    styles.checkbox,
                    isIncluded && styles.checkboxChecked,
                  ]}
                >
                  {isIncluded && (
                    <Text style={styles.checkmark}>{'\u2713'}</Text>
                  )}
                </TouchableOpacity>

                {/* Avatar & name */}
                <View style={styles.participantInfo}>
                  <Avatar name={member.name} size={32} />
                  <View style={styles.participantMeta}>
                    <Text
                      style={styles.participantName}
                      numberOfLines={1}
                    >
                      {member.name}
                    </Text>
                    <Text
                      style={[
                        styles.previewText,
                        !isIncluded && styles.previewTextMuted,
                      ]}
                    >
                      Split: {formatCurrency(previewAmount)}
                    </Text>
                  </View>
                </View>

                {/* Input controls based on split type */}
                <View style={styles.participantControls}>
                  {splitType === 'custom' && (
                    <TextInput
                      style={[
                        styles.numInput,
                        !isIncluded && styles.inputDisabled,
                      ]}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      value={input.customAmount}
                      onChangeText={(value) =>
                        updateMemberInput(member.uid, 'customAmount', value)
                      }
                      editable={isIncluded}
                    />
                  )}

                  {splitType === 'percentage' && (
                    <View style={styles.inputWithSuffix}>
                      <TextInput
                        style={[
                          styles.numInput,
                          styles.numInputWithSuffix,
                          !isIncluded && styles.inputDisabled,
                        ]}
                        keyboardType="decimal-pad"
                        placeholder="0"
                        value={input.percent}
                        onChangeText={(value) =>
                          updateMemberInput(member.uid, 'percent', value)
                        }
                        editable={isIncluded}
                      />
                      <Text style={styles.suffix}>%</Text>
                    </View>
                  )}

                  {splitType === 'shares' && (
                    <View style={styles.shareStepper}>
                      <TouchableOpacity
                        style={[
                          styles.shareButton,
                          (!isIncluded || shares === 0) &&
                            styles.shareButtonDisabled,
                        ]}
                        onPress={() => adjustShares(member.uid, -1)}
                        disabled={!isIncluded || shares === 0}
                      >
                        <Icon
                          name="remove"
                          size={18}
                          color={
                            !isIncluded || shares === 0
                              ? colors.textTertiary
                              : colors.primary
                          }
                        />
                      </TouchableOpacity>
                      <View
                        style={[
                          styles.shareValue,
                          !isIncluded && styles.inputDisabled,
                        ]}
                      >
                        <Text style={styles.shareValueText}>{shares}</Text>
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.shareButton,
                          !isIncluded && styles.shareButtonDisabled,
                        ]}
                        onPress={() => adjustShares(member.uid, 1)}
                        disabled={!isIncluded}
                      >
                        <Icon
                          name="add"
                          size={18}
                          color={isIncluded ? colors.primary : colors.textTertiary}
                        />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </Card>
      </ScrollView>

      {/* Save button – sticks to the bottom */}
      <View style={styles.footer}>
        <Button
          title="Save Expense"
          onPress={handleSave}
          size="lg"
          loading={saving}
        />
      </View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Styles – refined for a cleaner, more spaced‑out aesthetic
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollView: { flex: 1 },
  content: { padding: spacing.xl, paddingBottom: spacing.xl },
  section: { marginBottom: spacing.xl },
  descInput: {
    fontSize: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    color: colors.textPrimary,
  },
  amountContainer: { flexDirection: 'row', alignItems: 'center' },
  currencySymbol: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.primary,
    marginRight: spacing.sm,
  },
  amountInput: {
    flex: 1,
    fontSize: 36,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  sectionTitle: {
    ...typography.bodyBold,
    marginBottom: spacing.md,
    color: colors.textSecondary,
  },
  categoryScroll: { flexDirection: 'row', marginBottom: spacing.xl },
  categoryWrapper: {
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginRight: spacing.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  categorySelected: { borderColor: colors.primary },
  payerScroll: { flexDirection: 'row', marginBottom: spacing.xl },
  payerCard: {
    alignItems: 'center',
    marginRight: spacing.lg,
    width: 64,
  },
  payerSelected: {},
  avatarBorder: {
    padding: 2,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarBorderSelected: { borderColor: colors.primary },
  payerCheckmark: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: colors.surface,
    borderRadius: 10,
  },
  payerName: {
    ...typography.small,
    marginTop: spacing.xs,
    textAlign: 'center',
    color: colors.textSecondary,
  },
  payerNameSelected: { color: colors.primary, fontWeight: 'bold' },
  splitOptionsRow: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: 4,
  },
  splitOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  splitOptionSelected: { backgroundColor: colors.primary },
  splitOptionText: {
    ...typography.bodyBold,
    color: colors.textSecondary,
  },
  splitOptionTextSelected: { color: colors.white },
  participantsCard: { padding: spacing.md, marginBottom: spacing.xxxl },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  participantInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.xs,
  },
  participantMeta: { marginLeft: spacing.sm, flex: 1 },
  participantName: { ...typography.body, fontSize: 13 },
  previewText: {
    ...typography.small,
    color: colors.primary,
    marginTop: 2,
    fontSize: 11,
  },
  previewTextMuted: { color: colors.textTertiary },
  participantControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.xs,
    flexShrink: 0,
    maxWidth: 120,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkmark: { color: colors.white, fontWeight: 'bold' },
  numInput: {
    flex: 1,
    height: 40,
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    textAlign: 'right',
    paddingHorizontal: spacing.sm,
    color: colors.textPrimary,
  },
  numInputWithSuffix: { paddingRight: 24 },
  inputDisabled: { opacity: 0.5 },
  inputWithSuffix: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  suffix: {
    position: 'absolute',
    right: spacing.sm,
    color: colors.textSecondary,
    fontWeight: 'bold',
  },
  shareStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.xs,
    flex: 1,
  },
  shareButton: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareButtonDisabled: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.borderLight,
  },
  shareValue: {
    minWidth: 32,
    height: 28,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  shareValueText: { ...typography.bodyBold },
  footer: {
    padding: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
