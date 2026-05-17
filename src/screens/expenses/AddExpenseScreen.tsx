import React, { useRef, useState, useEffect, useMemo } from 'react';
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
import { spacing, borderRadius, type ThemeColors, type ThemeTypography } from '../../components/theme';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useCurrency } from '../../context/CurrencyContext';
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
import { getCurrencySymbol } from '../../utils/currency';
import {
  calculateEqualSplit,
  calculateCustomSplit,
  calculatePercentageSplit,
  calculateSharesSplit,
} from '../../utils/splitCalculator';
import Button from '../../components/Button';

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

const CATEGORY_OPTIONS: Array<{ key: Exclude<Category, 'payment'>; label: string }> = [
  { key: 'food', label: 'Food' },
  { key: 'groceries', label: 'Groceries' },
  { key: 'transport', label: 'Transport' },
  { key: 'rent', label: 'Rent' },
  { key: 'utilities', label: 'Utilities' },
  { key: 'entertainment', label: 'Entertainment' },
  { key: 'shopping', label: 'Shopping' },
  { key: 'health', label: 'Health' },
  { key: 'travel', label: 'Travel' },
  { key: 'education', label: 'Education' },
  { key: 'subscriptions', label: 'Subscriptions' },
  { key: 'gifts', label: 'Gifts' },
  { key: 'pets', label: 'Pets' },
  { key: 'fitness', label: 'Fitness' },
  { key: 'sports', label: 'Sports' },
  { key: 'others', label: 'Others' },
];

export default function AddExpenseScreen({
  route,
  navigation,
}: AddExpenseScreenProps) {
  const { groupId, groupName, expenseId } = route.params;
  const { user } = useAuth();
  const { currency, formatAmount } = useCurrency();
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const primaryForeground = theme.dark ? colors.black : colors.white;
  const styles = useMemo(
    () => createStyles(colors, typography, primaryForeground),
    [colors, typography, primaryForeground],
  );
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
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [paidByDropdownOpen, setPaidByDropdownOpen] = useState(false);
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

  const setAllParticipantsIncluded = (included: boolean) => {
    setCategoryDropdownOpen(false);
    setPaidByDropdownOpen(false);
    setMemberInputs((prev) => {
      if (!group) return prev;

      return group.members.reduce<Record<string, MemberInputState>>((next, member) => {
        const current = prev[member.uid] || defaultMemberInput;
        next[member.uid] = {
          ...current,
          included,
        };
        return next;
      }, {});
    });
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
        const newExpenseId = await expenseService.addExpense(expenseData);

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
              data: { groupId, expenseId: newExpenseId },
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
  const activeCurrency = group.currency || currency;
  const activeCurrencySymbol = getCurrencySymbol(activeCurrency);
  const selectedCategoryOption =
    CATEGORY_OPTIONS.find(option => option.key === category) || CATEGORY_OPTIONS[CATEGORY_OPTIONS.length - 1];

  const includedCount = group.members.filter(member => memberInputs[member.uid]?.included).length;
  const allMembersIncluded = includedCount === group.members.length;
  const selectedPayer = group.members.find(member => member.uid === paidByUid) || group.members[0];
  const splitTypes: { key: SplitType; label: string; helper: string }[] = [
    { key: 'equal', label: 'Equal', helper: '=' },
    { key: 'custom', label: 'Exact', helper: activeCurrencySymbol },
    { key: 'percentage', label: 'Percent', helper: '%' },
    { key: 'shares', label: 'Shares', helper: '1x' },
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
        {/* ── Description ── */}
        <Text style={styles.sectionLabel}>DESCRIPTION</Text>
        <View style={styles.inputRow}>
          <View style={styles.inputIconBox}>
            <Icon name="document-text-outline" size={19} color={colors.textTertiary} />
          </View>
          <TextInput
            style={styles.inputField}
            placeholder="What was this for?"
            placeholderTextColor={colors.textTertiary}
            value={description}
            onChangeText={setDescription}
            onFocus={() => {
              setCategoryDropdownOpen(false);
              setPaidByDropdownOpen(false);
            }}
          />
        </View>

        {/* ── Amount ── */}
        <Text style={styles.sectionLabel}>AMOUNT</Text>
        <View style={styles.amountRow}>
          <Text style={styles.amountSymbol}>{activeCurrencySymbol}</Text>
          <TextInput
            style={styles.amountInput}
            placeholder="0.00"
            placeholderTextColor={colors.textTertiary}
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
            onFocus={() => {
              setCategoryDropdownOpen(false);
              setPaidByDropdownOpen(false);
            }}
          />
        </View>

        {/* ── Category ── */}
        <Text style={styles.sectionLabel}>CATEGORY</Text>
        <TouchableOpacity
          activeOpacity={0.78}
          onPress={() => {
            setCategoryDropdownOpen(v => {
              if (!v) setCategorySearchQuery('');
              return !v;
            });
            setPaidByDropdownOpen(false);
          }}
          style={styles.inputRow}
        >
          <CategoryIcon category={selectedCategoryOption.key} size={32} />
          <View style={styles.payerCopy}>
            <Text style={styles.payerName} numberOfLines={1}>
              {selectedCategoryOption.label}
            </Text>
          </View>
          <Icon
            name={categoryDropdownOpen ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.textTertiary}
          />
        </TouchableOpacity>

        {categoryDropdownOpen ? (
          <View style={styles.dropdownMenu}>
            <View style={styles.dropdownSearchContainer}>
              <Icon name="search" size={16} color={colors.textTertiary} style={styles.dropdownSearchIcon} />
              <TextInput
                style={styles.dropdownSearchInput}
                placeholder="Search category..."
                placeholderTextColor={colors.textTertiary}
                value={categorySearchQuery}
                onChangeText={setCategorySearchQuery}
              />
            </View>
            <ScrollView style={styles.dropdownScroll} nestedScrollEnabled={true} keyboardShouldPersistTaps="handled">
              {CATEGORY_OPTIONS.filter(opt => opt.label.toLowerCase().includes(categorySearchQuery.toLowerCase())).map((option, index, arr) => {
                const isSelected = category === option.key;
                const isLast = index === arr.length - 1;
                return (
                  <TouchableOpacity
                    activeOpacity={0.75}
                    key={option.key}
                    onPress={() => {
                      setCategory(option.key);
                      setCategoryDropdownOpen(false);
                    }}
                    style={[
                      styles.dropdownItem,
                      !isLast && styles.dropdownDivider,
                      isSelected && styles.dropdownItemSelected,
                    ]}
                  >
                    <CategoryIcon category={option.key} size={28} />
                    <Text
                      style={[
                        styles.dropdownItemText,
                        isSelected && styles.dropdownItemTextSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {option.label}
                    </Text>
                    {isSelected ? (
                      <Icon name="checkmark-circle" size={18} color={colors.primary} />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {/* ── Paid by ── */}
        <Text style={styles.sectionLabel}>PAID BY</Text>
        <TouchableOpacity
          activeOpacity={0.78}
          onPress={() => {
            setPaidByDropdownOpen(v => !v);
            setCategoryDropdownOpen(false);
          }}
          style={styles.inputRow}
        >
          <Avatar name={selectedPayer?.name || 'User'} size={32} />
          <View style={styles.payerCopy}>
            <Text style={styles.payerName} numberOfLines={1}>
              {selectedPayer?.uid === user?.id ? 'You' : selectedPayer?.name || 'Select payer'}
            </Text>
          </View>
          <Icon
            name={paidByDropdownOpen ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.textTertiary}
          />
        </TouchableOpacity>

        {paidByDropdownOpen ? (
          <View style={styles.dropdownMenu}>
            {group.members.map((member, index) => {
              const isSelected = paidByUid === member.uid;
              const isLast = index === group.members.length - 1;
              return (
                <TouchableOpacity
                  activeOpacity={0.75}
                  key={member.uid}
                  onPress={() => {
                    setPaidByUid(member.uid);
                    setPaidByDropdownOpen(false);
                  }}
                  style={[
                    styles.dropdownItem,
                    !isLast && styles.dropdownDivider,
                    isSelected && styles.dropdownItemSelected,
                  ]}
                >
                  <Avatar name={member.name} size={28} />
                  <Text
                    style={[
                      styles.dropdownItemText,
                      isSelected && styles.dropdownItemTextSelected,
                    ]}
                    numberOfLines={1}
                  >
                    {member.uid === user?.id ? 'You' : member.name}
                  </Text>
                  {isSelected ? (
                    <Icon name="checkmark-circle" size={18} color={colors.primary} />
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}

        {/* ── Split method ── */}
        <Text style={[styles.sectionLabel, { marginTop: spacing.xl }]}>SPLIT METHOD</Text>
        <View style={styles.splitRow}>
          {splitTypes.map((type) => {
            const isSelected = splitType === type.key;
            return (
              <TouchableOpacity
                activeOpacity={0.78}
                key={type.key}
                onPress={() => {
                  setSplitType(type.key);
                  setCategoryDropdownOpen(false);
                  setPaidByDropdownOpen(false);
                }}
                style={[styles.splitChip, isSelected && styles.splitChipSelected]}
              >
                <Text style={[styles.splitChipHelper, isSelected && styles.splitChipHelperSelected]}>
                  {type.helper}
                </Text>
                <Text style={[styles.splitChipText, isSelected && styles.splitChipTextSelected]}>
                  {type.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Participants ── */}
        <View style={styles.participantsHeader}>
          <Text style={styles.sectionLabel}>SPLIT WITH</Text>
          <View style={styles.participantActions}>
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{includedCount}</Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.78}
              onPress={() => setAllParticipantsIncluded(!allMembersIncluded)}
              style={styles.selectAllPill}
            >
              <Text style={styles.selectAllPillText}>
                {allMembersIncluded ? 'Deselect all' : 'Select all'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {group.members.map((member, index) => {
          const input = memberInputs[member.uid] || defaultMemberInput;
          const shares = parseInt(input?.shares || '0', 10);
          const isIncluded = input?.included;
          const previewAmount = previewMap[member.uid] || 0;
          const isLast = index === group.members.length - 1;

          return (
            <View key={member.uid} style={[styles.memberRow, isLast && styles.memberRowLast]}>
              <TouchableOpacity
                activeOpacity={0.78}
                onPress={() => {
                  toggleIncluded(member.uid);
                  setCategoryDropdownOpen(false);
                  setPaidByDropdownOpen(false);
                }}
                style={[styles.checkbox, isIncluded && styles.checkboxChecked]}
              >
                {isIncluded ? <Icon name="checkmark" size={14} color={primaryForeground} /> : null}
              </TouchableOpacity>

              <View style={styles.memberInfo}>
                <Avatar name={member.name} size={32} />
                <View style={styles.memberMeta}>
                  <Text style={styles.memberName} numberOfLines={1}>
                    {member.uid === user?.id ? 'You' : member.name}
                  </Text>
                  <Text style={[styles.memberPreview, !isIncluded && styles.memberPreviewMuted]}>
                    {formatAmount(previewAmount, { currency: activeCurrency })}
                  </Text>
                </View>
              </View>

              <View style={styles.memberControls}>
                {splitType === 'equal' && (
                  <View style={[styles.controlPill, !isIncluded && styles.controlDisabled]}>
                    <Text style={styles.controlPillText}>Equal</Text>
                  </View>
                )}
                {splitType === 'custom' && (
                  <TextInput
                    style={[styles.controlInput, !isIncluded && styles.controlDisabled]}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={colors.textTertiary}
                    value={input.customAmount}
                    onChangeText={(v) => updateMemberInput(member.uid, 'customAmount', v)}
                    onFocus={() => { setCategoryDropdownOpen(false); setPaidByDropdownOpen(false); }}
                    editable={isIncluded}
                  />
                )}
                {splitType === 'percentage' && (
                  <View style={styles.controlWithSuffix}>
                    <TextInput
                      style={[styles.controlInput, styles.controlInputSuffix, !isIncluded && styles.controlDisabled]}
                      keyboardType="decimal-pad"
                      placeholder="0"
                      placeholderTextColor={colors.textTertiary}
                      value={input.percent}
                      onChangeText={(v) => updateMemberInput(member.uid, 'percent', v)}
                      onFocus={() => { setCategoryDropdownOpen(false); setPaidByDropdownOpen(false); }}
                      editable={isIncluded}
                    />
                    <Text style={styles.suffixText}>%</Text>
                  </View>
                )}
                {splitType === 'shares' && (
                  <View style={styles.stepper}>
                    <TouchableOpacity
                      activeOpacity={0.78}
                      style={[styles.stepperBtn, (!isIncluded || shares === 0) && styles.stepperBtnDisabled]}
                      onPress={() => adjustShares(member.uid, -1)}
                      disabled={!isIncluded || shares === 0}
                    >
                      <Icon name="remove" size={16} color={!isIncluded || shares === 0 ? colors.textTertiary : colors.primary} />
                    </TouchableOpacity>
                    <View style={[styles.stepperValue, !isIncluded && styles.controlDisabled]}>
                      <Text style={styles.stepperValueText}>{shares}</Text>
                    </View>
                    <TouchableOpacity
                      activeOpacity={0.78}
                      style={[styles.stepperBtn, !isIncluded && styles.stepperBtnDisabled]}
                      onPress={() => adjustShares(member.uid, 1)}
                      disabled={!isIncluded}
                    >
                      <Icon name="add" size={16} color={isIncluded ? colors.primary : colors.textTertiary} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <Button title="Save Expense" onPress={handleSave} size="lg" loading={saving} />
      </View>
    </Animated.View>
  );
}

// Styles – clean, auth-screen-inspired aesthetic
// ---------------------------------------------------------------------------
const createStyles = (
  colors: ThemeColors,
  typography: ThemeTypography,
  primaryForeground: string,
) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  scrollView: { flex: 1 },
  content: {
    paddingHorizontal: 24,
    paddingTop: spacing.lg,
    paddingBottom: spacing.huge,
  },
  sectionLabel: {
    ...typography.label,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  inputRow: {
    minHeight: 56,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerHigh,
    paddingHorizontal: spacing.md,
    overflow: 'hidden',
  },
  inputIconBox: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputField: {
    flex: 1,
    minHeight: 56,
    fontSize: 15,
    color: colors.textPrimary,
    paddingVertical: 0,
    paddingRight: spacing.md,
  },
  amountRow: {
    minHeight: 72,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerHigh,
    paddingHorizontal: spacing.lg,
  },
  amountSymbol: {
    color: colors.primary,
    fontSize: 28,
    fontWeight: '800',
    marginRight: spacing.sm,
  },
  amountInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 34,
    fontWeight: '800',
    paddingVertical: 0,
  },

  payerCopy: { flex: 1, marginLeft: spacing.md },
  payerName: { ...typography.bodyBold },
  dropdownMenu: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: 14,
    marginTop: spacing.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  dropdownSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    height: 48,
    backgroundColor: colors.surfaceContainerHigh,
  },
  dropdownSearchIcon: {
    marginRight: spacing.sm,
  },
  dropdownSearchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 14,
    height: 48,
    paddingVertical: 0,
  },
  dropdownScroll: {
    maxHeight: 153,
  },
  dropdownItem: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 50,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  dropdownDivider: {
    borderBottomColor: colors.borderLight,
    borderBottomWidth: 1,
  },
  dropdownItemSelected: { backgroundColor: colors.primaryLight },
  dropdownItemText: { ...typography.body, flex: 1 },
  dropdownItemTextSelected: { color: colors.primary, fontWeight: '600' },
  splitRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: 14,
    padding: 4,
  },
  splitChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    borderRadius: 12,
    paddingVertical: spacing.xs,
  },
  splitChipSelected: { backgroundColor: colors.primary },
  splitChipHelper: {
    color: colors.textTertiary,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 1,
  },
  splitChipHelperSelected: { color: primaryForeground },
  splitChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  splitChipTextSelected: { color: primaryForeground },
  participantsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
    marginTop: spacing.lg,
  },
  participantActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  countBadge: {
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.full,
    height: 28,
    justifyContent: 'center',
    minWidth: 28,
    paddingHorizontal: spacing.sm,
  },
  countBadgeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  selectAllPill: {
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: borderRadius.full,
    height: 28,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  selectAllPillText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  memberRowLast: { borderBottomWidth: 0 },
  memberInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.xs,
    minWidth: 0,
  },
  memberMeta: { marginLeft: spacing.sm, flex: 1 },
  memberName: { ...typography.body, fontSize: 14 },
  memberPreview: { fontSize: 11, color: colors.primary, marginTop: 1 },
  memberPreviewMuted: { color: colors.textTertiary },
  memberControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexShrink: 0,
    height: 40,
    width: 110,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  controlPill: {
    alignItems: 'center',
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: 10,
    height: 38,
    justifyContent: 'center',
    width: 110,
  },
  controlPillText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  controlInput: {
    height: 38,
    width: 110,
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: 10,
    textAlign: 'right',
    paddingHorizontal: spacing.sm,
    color: colors.textPrimary,
    fontSize: 14,
  },
  controlInputSuffix: { paddingRight: 22 },
  controlDisabled: { opacity: 0.45 },
  controlWithSuffix: {
    alignItems: 'center',
    flexDirection: 'row',
    width: 110,
  },
  suffixText: {
    position: 'absolute',
    right: spacing.sm,
    color: colors.textSecondary,
    fontWeight: 'bold',
    fontSize: 13,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.xs,
    width: 110,
  },
  stepperBtn: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnDisabled: { borderColor: colors.borderLight },
  stepperValue: {
    minWidth: 30,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.surfaceContainerHigh,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  stepperValueText: { ...typography.bodyBold, fontSize: 14 },
  footer: {
    padding: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surfaceContainer,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
});

