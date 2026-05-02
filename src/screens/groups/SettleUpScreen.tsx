import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../../components/theme';
import { useAuth } from '../../context/AuthContext';
import { groupService } from '../../services/groupService';
import { expenseService } from '../../services/expenseService';
import type { Group } from '../../models/Group';
import type { SettleUpScreenProps } from '../../navigation/types';
import { simplifyDebts, Debt } from '../../utils/debtSimplifier';
import Card from '../../components/Card';
import Avatar from '../../components/Avatar';
import Button from '../../components/Button';
import Icon from 'react-native-vector-icons/Ionicons';

export default function SettleUpScreen({ route, navigation }: SettleUpScreenProps) {
  const { groupId } = route.params;
  const { user } = useAuth();
  
  const [group, setGroup] = useState<Group | null>(null);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [settling, setSettling] = useState(false);

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

    Alert.alert(
      'Record Payment',
      `Did a payment of ₹${debt.amount.toFixed(2)} actually happen?`,
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

  const renderDebt = ({ item }: { item: Debt }) => {
    const isMeFrom = item.from === user?.id;
    const isMeTo = item.to === user?.id;
    const fromName = isMeFrom ? user?.name : (fromMember?.name || 'User');
    const toName = isMeTo ? user?.name : (toMember?.name || 'User');

    const isInvolved = isMeFrom || isMeTo;

    return (
      <Card style={styles.debtCard} padding="md">
        <View style={styles.debtRow}>
          <View style={styles.personInfo}>
            <Avatar name={fromName} size={32} />
            <Text style={styles.name} numberOfLines={1}>{isMeFrom ? 'You' : fromName}</Text>
          </View>
          
          <View style={styles.arrowContainer}>
            <Text style={styles.amount}>₹{item.amount.toFixed(2)}</Text>
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
            onPress={() => handleSettle(item)} 
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
      <FlatList
        data={debts}
        keyExtractor={(item) => `${item.from}-${item.to}`}
        renderItem={renderDebt}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <Text style={styles.headerText}>
            {debts.length > 0 ? 'Suggested settlements to balance everyone out:' : 'Everyone is settled up!'}
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
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
  },
  headerText: {
    ...typography.caption,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  debtCard: {
    marginBottom: spacing.md,
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
