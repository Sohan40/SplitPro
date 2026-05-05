import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../../components/theme';
import { useAuth } from '../../context/AuthContext';
import { groupService } from '../../services/groupService';
import { expenseService } from '../../services/expenseService';
import { notificationService } from '../../services/notificationService';
import type { Group } from '../../models/Group';
import type { Expense, Category, SplitType } from '../../models/Expense';
import type { AddExpenseScreenProps } from '../../navigation/types';
import { calculateEqualSplit, calculateCustomSplit, calculatePercentageSplit, calculateSharesSplit } from '../../utils/splitCalculator';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Avatar from '../../components/Avatar';
import CategoryIcon from '../../components/CategoryIcon';
import Icon from 'react-native-vector-icons/Ionicons';

export default function AddExpenseScreen({ route, navigation }: AddExpenseScreenProps) {
  const { groupId, groupName, expenseId } = route.params;
  const { user } = useAuth();

  const [group, setGroup] = useState<Group | null>(null);
  const [oldExpense, setOldExpense] = useState<Expense | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Category>('others');
  const [splitType, setSplitType] = useState<SplitType>('equal');
  const [paidByUid, setPaidByUid] = useState<string>('');

  const [memberInputs, setMemberInputs] = useState<Record<string, {
    included: boolean;
    customAmount: string;
    percent: string;
    shares: string;
  }>>({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        const groupData = await groupService.getGroup(groupId);
        setGroup(groupData);

        if (groupData && user) {
          const initialInputs: Record<string, {
            included: boolean;
            customAmount: string;
            percent: string;
            shares: string;
          }> = {};

          if (expenseId) {
            const exp = await expenseService.getExpense(expenseId);
            if (exp) {
              setOldExpense(exp);
              setDescription(exp.description);
              setAmount(exp.amount.toString());
              setCategory(exp.category);
              setSplitType(exp.splitType);
              setPaidByUid(exp.paidBy.uid);

              groupData.members.forEach(member => {
                const participant = exp.participants.find(part => part.uid === member.uid);
                initialInputs[member.uid] = {
                  included: !!participant,
                  customAmount: participant ? participant.amount.toString() : '',
                  percent: participant ? ((participant.amount / exp.amount) * 100).toFixed(2) : '0',
                  shares: participant ? '1' : '0',
                };
              });
            }
          } else {
            setPaidByUid(user.id);
            groupData.members.forEach(member => {
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

  const updateMemberInput = (uid: string, field: string, value: boolean | string) => {
    setMemberInputs(prev => ({
      ...prev,
      [uid]: {
        ...(prev[uid] || {}),
        [field]: value,
      },
    }));
  };

  const adjustShares = (uid: string, delta: number) => {
    const currentShares = parseInt(memberInputs[uid]?.shares || '0', 10);
    const nextShares = Math.max(0, currentShares + delta);
    updateMemberInput(uid, 'shares', String(nextShares));
  };

  const handleSave = async () => {
    if (!group || !user) return;

    const numAmount = parseFloat(amount);
    if (!description.trim() || isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Invalid Input', 'Please enter a valid description and amount.');
      return;
    }

    try {
      setSaving(true);
      let participants: any[] = [];
      const paidByMember = group.members.find(member => member.uid === paidByUid);

      if (!paidByMember) throw new Error('Payer not found');

      switch (splitType) {
        case 'equal': {
          const includedMembers = group.members.filter(member => memberInputs[member.uid]?.included);
          participants = calculateEqualSplit(numAmount, includedMembers);
          break;
        }
        case 'custom': {
          const customMembers = group.members.map(member => ({
            uid: member.uid,
            name: member.name,
            amount: parseFloat(memberInputs[member.uid]?.customAmount) || 0,
          }));
          participants = calculateCustomSplit(numAmount, customMembers);
          break;
        }
        case 'percentage': {
          const pctMembers = group.members.map(member => ({
            uid: member.uid,
            name: member.name,
            percent: parseFloat(memberInputs[member.uid]?.percent) || 0,
          }));
          participants = calculatePercentageSplit(numAmount, pctMembers);
          break;
        }
        case 'shares': {
          const sharesMembers = group.members.map(member => ({
            uid: member.uid,
            name: member.name,
            shares: parseFloat(memberInputs[member.uid]?.shares) || 0,
          }));
          participants = calculateSharesSplit(numAmount, sharesMembers);
          break;
        }
      }

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

      const newBalances = { ...group.balances };

      if (oldExpense) {
        newBalances[oldExpense.paidBy.uid] = (newBalances[oldExpense.paidBy.uid] || 0) - oldExpense.amount;
        oldExpense.participants.forEach(participant => {
          newBalances[participant.uid] = (newBalances[participant.uid] || 0) + participant.amount;
        });
      }

      newBalances[paidByUid] = (newBalances[paidByUid] || 0) + numAmount;
      participants.forEach(participant => {
        newBalances[participant.uid] = (newBalances[participant.uid] || 0) - participant.amount;
      });

      if (expenseId) {
        await expenseService.updateExpense(expenseId, expenseData);
      } else {
        await expenseService.addExpense(expenseData);

        const otherMemberIds = group.memberIds.filter(id => id !== user.id);
        if (otherMemberIds.length > 0) {
          await notificationService.createNotificationsForUsers(otherMemberIds, {
            title: 'New Expense',
            body: `${user.name} added "${description}" to ${groupName}`,
            type: 'expense',
            data: { groupId, expenseId: expenseId || '' },
          });
        }
      }

      await groupService.updateGroup(groupId, { balances: newBalances });
      navigation.goBack();
    } catch (error: any) {
      console.error(error);
      Alert.alert('Failed to save expense', error.message || 'An error occurred.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !group || Object.keys(memberInputs).length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const categoryList: Category[] = ['food', 'groceries', 'transport', 'rent', 'utilities', 'entertainment', 'others'];
  const splitTypes: { key: SplitType; label: string }[] = [
    { key: 'equal', label: '=' },
    { key: 'custom', label: '1.23' },
    { key: 'percentage', label: '%' },
    { key: 'shares', label: 'Shares' },
  ];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
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

        <Text style={styles.sectionTitle}>Category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
          {categoryList.map(cat => (
            <TouchableOpacity
              key={cat}
              onPress={() => setCategory(cat)}
              style={[styles.categoryWrapper, category === cat && styles.categorySelected]}
            >
              <CategoryIcon category={cat} size={32} />
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.sectionTitle}>Paid By</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.payerScroll}>
          {group.members.map(member => (
            <TouchableOpacity
              key={member.uid}
              onPress={() => setPaidByUid(member.uid)}
              style={[styles.payerCard, paidByUid === member.uid && styles.payerSelected]}
            >
              <View style={[styles.avatarBorder, paidByUid === member.uid && styles.avatarBorderSelected]}>
                <Avatar name={member.name} size={50} />
                {paidByUid === member.uid && (
                  <View style={styles.payerCheckmark}>
                    <Icon name="checkmark-circle" size={20} color={colors.primary} />
                  </View>
                )}
              </View>
              <Text style={[styles.payerName, paidByUid === member.uid && styles.payerNameSelected]} numberOfLines={1}>
                {member.uid === user?.id ? 'You' : member.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.sectionTitle}>Split Options</Text>
        <View style={styles.splitOptionsRow}>
          {splitTypes.map(type => (
            <TouchableOpacity
              key={type.key}
              onPress={() => setSplitType(type.key)}
              style={[styles.splitOption, splitType === type.key && styles.splitOptionSelected]}
            >
              <Text style={[styles.splitOptionText, splitType === type.key && styles.splitOptionTextSelected]}>
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Card style={styles.participantsCard}>
          {group.members.map(member => {
            const shares = parseInt(memberInputs[member.uid]?.shares || '0', 10);

            return (
              <View key={member.uid} style={styles.participantRow}>
                <View style={styles.participantInfo}>
                  <Avatar name={member.name} size={32} />
                  <Text style={styles.participantName} numberOfLines={1}>{member.name}</Text>
                </View>

                <View style={styles.participantInputBox}>
                  {splitType === 'equal' && (
                    <TouchableOpacity
                      onPress={() => updateMemberInput(member.uid, 'included', !memberInputs[member.uid].included)}
                      style={[styles.checkbox, memberInputs[member.uid].included && styles.checkboxChecked]}
                    >
                      {memberInputs[member.uid].included && <Text style={styles.checkmark}>{'\u2713'}</Text>}
                    </TouchableOpacity>
                  )}

                  {splitType === 'custom' && (
                    <TextInput
                      style={styles.numInput}
                      keyboardType="decimal-pad"
                      placeholder="0.00"
                      value={memberInputs[member.uid].customAmount}
                      onChangeText={value => updateMemberInput(member.uid, 'customAmount', value)}
                    />
                  )}

                  {splitType === 'percentage' && (
                    <View style={styles.inputWithSuffix}>
                      <TextInput
                        style={[styles.numInput, { paddingRight: 24 }]}
                        keyboardType="decimal-pad"
                        placeholder="0"
                        value={memberInputs[member.uid].percent}
                        onChangeText={value => updateMemberInput(member.uid, 'percent', value)}
                      />
                      <Text style={styles.suffix}>%</Text>
                    </View>
                  )}

                  {splitType === 'shares' && (
                    <View style={styles.shareStepper}>
                      <TouchableOpacity
                        style={[styles.shareButton, shares === 0 && styles.shareButtonDisabled]}
                        onPress={() => adjustShares(member.uid, -1)}
                        disabled={shares === 0}
                      >
                        <Icon
                          name="remove"
                          size={18}
                          color={shares === 0 ? colors.textTertiary : colors.primary}
                        />
                      </TouchableOpacity>
                      <View style={styles.shareValue}>
                        <Text style={styles.shareValueText}>{shares}</Text>
                      </View>
                      <TouchableOpacity
                        style={styles.shareButton}
                        onPress={() => adjustShares(member.uid, 1)}
                      >
                        <Icon name="add" size={18} color={colors.primary} />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </Card>
      </ScrollView>

      <View style={styles.footer}>
        <Button title="Save Expense" onPress={handleSave} size="lg" loading={saving} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: spacing.xl, paddingBottom: spacing.xxxl },
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
  currencySymbol: { fontSize: 32, fontWeight: 'bold', color: colors.primary, marginRight: spacing.sm },
  amountInput: { flex: 1, fontSize: 36, fontWeight: 'bold', color: colors.textPrimary },
  sectionTitle: { ...typography.bodyBold, marginBottom: spacing.md, color: colors.textSecondary },
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
  avatarBorderSelected: {
    borderColor: colors.primary,
  },
  payerCheckmark: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: colors.surface,
    borderRadius: 10,
  },
  payerName: { ...typography.small, marginTop: spacing.xs, textAlign: 'center', color: colors.textSecondary },
  payerNameSelected: { color: colors.primary, fontWeight: 'bold' },
  splitOptionsRow: { flexDirection: 'row', marginBottom: spacing.lg, backgroundColor: colors.surface, borderRadius: borderRadius.md, padding: 4 },
  splitOption: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: borderRadius.sm },
  splitOptionSelected: { backgroundColor: colors.primary },
  splitOptionText: { ...typography.bodyBold, color: colors.textSecondary },
  splitOptionTextSelected: { color: colors.white },
  participantsCard: { padding: spacing.md, marginBottom: spacing.xxxl },
  participantRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  participantInfo: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  participantName: { ...typography.body, marginLeft: spacing.md, flex: 1 },
  participantInputBox: { width: 132, alignItems: 'flex-end' },
  checkbox: { width: 24, height: 24, borderRadius: 4, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkmark: { color: colors.white, fontWeight: 'bold' },
  numInput: { width: '100%', height: 40, backgroundColor: colors.background, borderRadius: borderRadius.sm, textAlign: 'right', paddingHorizontal: spacing.sm, color: colors.textPrimary },
  inputWithSuffix: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  suffix: { position: 'absolute', right: spacing.sm, color: colors.textSecondary, fontWeight: 'bold' },
  shareStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  shareButton: {
    width: 36,
    height: 36,
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
    minWidth: 40,
    height: 36,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  shareValueText: {
    ...typography.bodyBold,
  },
  footer: { padding: spacing.xl, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
});
