import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../../components/theme';
import { useAuth } from '../../context/AuthContext';
import { expenseService } from '../../services/expenseService';
import { groupService } from '../../services/groupService';
import type { Expense } from '../../models/Expense';
import type { ActivityScreenProps } from '../../navigation/types';
import Card from '../../components/Card';
import EmptyState from '../../components/EmptyState';
import Icon from 'react-native-vector-icons/Ionicons';
import CategoryIcon from '../../components/CategoryIcon';

export default function ActivityScreen({ navigation }: ActivityScreenProps) {
  const { user } = useAuth();
  const [activities, setActivities] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    let expensesUnsubscribe: () => void;

    const setupSubscription = async () => {
      try {
        const groups = await groupService.getUserGroups(user.id);
        const groupIds = groups.map(g => g.id);
        
        expensesUnsubscribe = expenseService.subscribeToUserExpenses(groupIds, (data) => {
          setActivities(data);
          setLoading(false);
        });
      } catch (error) {
        console.error('Failed to setup activity subscription:', error);
        setLoading(false);
      }
    };

    setupSubscription();

    return () => {
      if (expensesUnsubscribe) expensesUnsubscribe();
    };
  }, [user]);

  const renderActivity = ({ item }: { item: Expense }) => {
    const iPaid = item.paidBy.uid === user?.id;
    const participantMe = item.participants.find(p => p.uid === user?.id);
    
    let color = colors.textSecondary;
    let label = '';
    let amount = 0;

    if (item.splitType === 'payment') {
      label = iPaid ? 'You paid' : 'You received';
      amount = item.amount;
    } else if (iPaid) {
      const myShare = participantMe ? participantMe.amount : 0;
      amount = item.amount - myShare;
      label = item.updatedAt ? 'You edited' : 'You lent';
      color = colors.owed;
    } else if (participantMe) {
      amount = participantMe.amount;
      label = item.updatedAt ? 'Someone edited' : 'You borrowed';
      color = colors.owes;
    }

    return (
      <TouchableOpacity 
        onPress={() => navigation.navigate('Groups', { 
          screen: 'ExpenseDetail', 
          params: { groupId: item.groupId, expenseId: item.id } 
        })}
      >
        <Card style={styles.activityCard} padding="sm">
          <View style={styles.row}>
            <CategoryIcon category={item.category} size={24} />
            <View style={styles.info}>
              <Text style={styles.description} numberOfLines={1}>{item.description}</Text>
              <Text style={styles.subtext}>
                {item.paidBy.uid === user?.id ? 'You' : item.paidBy.name} paid ₹{item.amount.toFixed(2)}
              </Text>
            </View>
            <View style={styles.balance}>
              <Text style={[styles.label, { color }]}>{label}</Text>
              <Text style={[styles.amount, { color }]}>₹{amount.toFixed(2)}</Text>
            </View>
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator color={colors.primary} /></View>;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={activities}
        keyExtractor={item => item.id}
        renderItem={renderActivity}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <EmptyState 
            title="No activity yet" 
            message="Your recent expenses and payments will show up here." 
          />
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
    paddingBottom: spacing.huge,
  },
  activityCard: {
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    marginLeft: spacing.md,
  },
  description: {
    ...typography.bodyBold,
  },
  subtext: {
    ...typography.caption,
    marginTop: 2,
  },
  balance: {
    alignItems: 'flex-end',
    marginLeft: spacing.sm,
  },
  label: {
    fontSize: 10,
    textTransform: 'uppercase',
  },
  amount: {
    ...typography.bodyBold,
  },
});
