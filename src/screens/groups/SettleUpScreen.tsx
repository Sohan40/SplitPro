import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { spacing, type ThemeColors, type ThemeTypography } from '../../components/theme';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useCurrency } from '../../context/CurrencyContext';
import { groupService } from '../../services/groupService';
import { expenseService } from '../../services/expenseService';
import type { Group } from '../../models/Group';
import type { SettleUpScreenProps } from '../../navigation/types';
import { simplifyDebts, Debt } from '../../utils/debtSimplifier';
import Card from '../../components/Card';
import Avatar from '../../components/Avatar';
import Button from '../../components/Button';
import Icon from 'react-native-vector-icons/Ionicons';

type DebtSection = {
  title: string;
  subtitle: string;
  emptyText: string;
  debts: Debt[];
};

export default function SettleUpScreen({ route, navigation }: SettleUpScreenProps) {
  const { groupId } = route.params;
  const { user } = useAuth();
  const { currency, formatAmount } = useCurrency();
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const styles = useMemo(() => createStyles(colors, typography), [colors, typography]);
  
  const [group, setGroup] = useState<Group | null>(null);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [settling, setSettling] = useState(false);
  const debtSections = useMemo<DebtSection[]>(() => {
    const userId = user?.id;

    return [
      {
        title: 'You are owed',
        subtitle: 'Payments you can collect',
        emptyText: 'No one owes you right now.',
        debts: userId ? debts.filter(debt => debt.to === userId) : [],
      },
      {
        title: 'You owe',
        subtitle: 'Payments you may need to make',
        emptyText: 'You do not owe anyone right now.',
        debts: userId ? debts.filter(debt => debt.from === userId) : [],
      },
      {
        title: 'Others',
        subtitle: 'Group settlements that do not involve you',
        emptyText: 'No other member settlements are needed.',
        debts: userId ? debts.filter(debt => debt.from !== userId && debt.to !== userId) : debts,
      },
    ];
  }, [debts, user?.id]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    try {
      unsubscribe = groupService.subscribeToGroup(groupId, (data) => {
        setGroup(data);
        if (data) {
          setDebts(simplifyDebts(data.balances || {}));
        }
        setLoading(false);
      });
    } catch (error) {
      console.error('Failed to subscribe to group details:', error);
      Alert.alert('Error', 'Failed to load balances');
      setLoading(false);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [groupId]);

  const handleSettle = async (debt: Debt) => {
    if (!group || !user) return;
    const groupCurrency = group.currency || currency;

    Alert.alert(
      'Record Payment',
      `Did a payment of ${formatAmount(debt.amount, { currency: groupCurrency })} actually happen?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Record it',
          onPress: async () => {
            try {
              setSettling(true);
              
              const fromMember = group.members.find(m => m.uid === debt.from);
              const toMember = group.members.find(m => m.uid === debt.to);
              
              if (!fromMember || !toMember) throw new Error("Members not found");

              // 1. Create a payment expense
              await expenseService.addExpense({
                groupId,
                description: 'Settle Up',
                amount: debt.amount,
                category: 'payment',
                splitType: 'payment',
                paidBy: { uid: debt.from, name: fromMember.name },
                participants: [{ uid: debt.to, name: toMember.name, amount: debt.amount }],
                createdBy: user.id,
                createdAt: Date.now(),
              });

              // 2. Update balances
              // The person who paid (from) has their balance increased (they paid back debt)
              // The person who received (to) has their balance decreased (debt was collected)
              const newBalances = { ...group.balances };
              newBalances[debt.from] = (newBalances[debt.from] || 0) + debt.amount;
              newBalances[debt.to] = (newBalances[debt.to] || 0) - debt.amount;

              await groupService.updateGroup(groupId, { balances: newBalances });
              
              Alert.alert('Success', 'Payment recorded!');
              navigation.goBack();
            } catch (error) {
              console.error(error);
              Alert.alert('Error', 'Failed to record payment');
            } finally {
              setSettling(false);
            }
          }
        }
      ]
    );
  };

  const renderDebt = (debt: Debt) => {
    const fromMember = group?.members.find(m => m.uid === debt.from);
    const toMember = group?.members.find(m => m.uid === debt.to);

    const isMeFrom = debt.from === user?.id;
    const isMeTo = debt.to === user?.id;
    const fromName = isMeFrom ? user?.name : (fromMember?.name || 'User');
    const toName = isMeTo ? user?.name : (toMember?.name || 'User');

    const isInvolved = isMeFrom || isMeTo;

    return (
      <Card key={`${debt.from}-${debt.to}`} style={styles.debtCard} padding="md">
        <View style={styles.debtRow}>
          <View style={styles.personInfo}>
            <Avatar name={fromName} size={32} />
            <Text style={styles.name} numberOfLines={1}>{isMeFrom ? 'You' : fromName}</Text>
          </View>
          
          <View style={styles.arrowContainer}>
            <Text style={styles.amount}>{formatAmount(debt.amount, { currency: group?.currency || currency })}</Text>
            <Icon name="arrow-forward" size={20} color={colors.textTertiary} />
          </View>

          <View style={styles.personInfo}>
            <Avatar name={toName} size={32} />
            <Text style={styles.name} numberOfLines={1}>{isMeTo ? 'You' : toName}</Text>
          </View>
        </View>

        {isInvolved && (
          <Button 
            title="Settle Up" 
            onPress={() => handleSettle(debt)}
            size="sm" 
            style={styles.settleButton}
            loading={settling}
          />
        )}
      </Card>
    );
  };

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator color={colors.primary} /></View>;
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        {debts.length === 0 ? (
          <Text style={styles.headerText}>Everyone is settled up!</Text>
        ) : null}

        {debtSections.map(section => (
          <View key={section.title} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.sectionSubtitle}>{section.subtitle}</Text>
            </View>

            {section.debts.length > 0 ? (
              section.debts.map(renderDebt)
            ) : (
              <Card style={styles.emptyCard} padding="md" variant="flat">
                <Text style={styles.emptyText}>{section.emptyText}</Text>
              </Card>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: ThemeColors, typography: ThemeTypography) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: spacing.xl,
    paddingBottom: spacing.huge,
  },
  headerText: {
    ...typography.caption,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  section: {
    marginBottom: spacing.xxl,
  },
  sectionHeader: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.heading3,
  },
  sectionSubtitle: {
    ...typography.caption,
    marginTop: 2,
  },
  debtCard: {
    marginBottom: spacing.md,
  },
  emptyCard: {
    marginBottom: spacing.md,
  },
  emptyText: {
    ...typography.caption,
    textAlign: 'center',
  },
  debtRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  personInfo: {
    alignItems: 'center',
    width: 80,
  },
  name: {
    ...typography.small,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  arrowContainer: {
    alignItems: 'center',
    flex: 1,
  },
  amount: {
    ...typography.bodyBold,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  settleButton: {
    marginTop: spacing.xs,
  },
});
