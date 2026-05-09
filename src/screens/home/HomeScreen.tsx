import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { colors, typography, spacing, borderRadius } from '../../components/theme';
import { useAuth } from '../../context/AuthContext';
import { groupService } from '../../services/groupService';
import type { Group } from '../../models/Group';
import type { HomeScreenProps } from '../../navigation/types';
import EmptyState from '../../components/EmptyState';
import Button from '../../components/Button';
import Icon from 'react-native-vector-icons/Ionicons';
import { calculateUserSummary } from '../../utils/balanceCalculator';

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    let groupUnsubscribe: () => void;

    groupUnsubscribe = groupService.subscribeToUserGroups(user.id, (userGroups) => {
      setGroups(userGroups);
      setLoading(false);
    });

    return () => {
      if (groupUnsubscribe) groupUnsubscribe();
    };
  }, [user, navigation]);

  const summary = user ? calculateUserSummary(groups, user.id) : { totalBalance: 0, youOwe: 0, youAreOwed: 0 };
  const totalOwed = summary.youAreOwed;
  const totalOwes = summary.youOwe;
  const netBalance = totalOwed - totalOwes;

  const renderGroup = ({ item }: { item: Group }) => {
    const myBalance = user ? (item.balances?.[user.id] || 0) : 0;
    const isPositive = myBalance >= 0;

    return (
      <TouchableOpacity
        onPress={() => navigation.navigate('Groups', {
          screen: 'GroupDetail',
          params: { groupId: item.id, groupName: item.name }
        })}
        activeOpacity={0.7}
        style={styles.groupCard}
      >
        <View style={styles.groupCardInner}>
          <View style={styles.groupLeft}>
            <View style={styles.groupIconContainer}>
              <Icon name="people" size={22} color={colors.primary} />
            </View>
            <View style={styles.groupInfo}>
              <Text style={styles.groupName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.groupMembers}>{item.members.length} members</Text>
            </View>
          </View>
          <View style={styles.groupRight}>
            <Text style={[styles.groupBalance, { color: isPositive ? colors.owed : colors.owes }]}>
              {isPositive ? '+' : '-'}₹{Math.abs(myBalance).toFixed(2)}
            </Text>
            <Text style={[styles.groupBalanceLabel, { color: isPositive ? colors.owed : colors.owes }]}>
              {isPositive ? 'you are owed' : 'you owe'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back 👋</Text>
          <Text style={styles.title}>{user?.name?.split(' ')[0] || 'SplitPro'}</Text>
        </View>
        <TouchableOpacity
          style={styles.notifButton}
          onPress={() => navigation.navigate('Activity')}
        >
          <Icon name="notifications-outline" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Balance Bento Grid */}
      <View style={styles.bentoGrid}>
        {/* Total Balance — large card */}
        <View style={styles.bentoCardLarge}>
          <Text style={styles.bentoLabel}>Total Balance</Text>
          <Text style={[styles.bentoAmount, { color: netBalance >= 0 ? colors.owed : colors.owes }]}>
            {netBalance >= 0 ? '+' : '-'}₹{Math.abs(netBalance).toFixed(2)}
          </Text>
          <View style={styles.bentoActions}>
            <TouchableOpacity
              style={styles.settleBtn}
              onPress={() => navigation.navigate('Groups', { screen: 'GroupList' })}
              activeOpacity={0.8}
            >
              <Text style={styles.settleBtnText}>Settle Up</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.addExpenseBtn}
              onPress={() => navigation.navigate('Groups', { screen: 'GroupList' })}
              activeOpacity={0.8}
            >
              <Icon name="add" size={16} color={colors.primary} />
              <Text style={styles.addExpenseBtnText}>Add Expense</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Two small cards side by side */}
        <View style={styles.bentoSmallRow}>
          {/* You Owe */}
          <View style={[styles.bentoCardSmall, styles.bentoCardSmallLeft]}>
            <View style={styles.bentoSmallHeader}>
              <Text style={styles.bentoLabel}>You Owe</Text>
              <Icon name="arrow-down" size={16} color={colors.owes} />
            </View>
            <Text style={[styles.bentoSmallAmount, { color: colors.textPrimary }]}>
              ₹{totalOwes.toFixed(2)}
            </Text>
            <Text style={styles.bentoSubLabel}>{groups.filter(g => (user ? (g.balances?.[user.id] || 0) < 0 : false)).length} groups</Text>
          </View>

          {/* You Are Owed */}
          <View style={styles.bentoCardSmall}>
            <View style={styles.bentoSmallHeader}>
              <Text style={styles.bentoLabel}>Owed to You</Text>
              <Icon name="arrow-up" size={16} color={colors.owed} />
            </View>
            <Text style={[styles.bentoSmallAmount, { color: colors.owed }]}>
              ₹{totalOwed.toFixed(2)}
            </Text>
            <Text style={styles.bentoSubLabel}>{groups.filter(g => (user ? (g.balances?.[user.id] || 0) > 0 : false)).length} groups</Text>
          </View>
        </View>
      </View>

      {/* Groups List */}
      <View style={styles.listContainer}>
        <View style={styles.listHeader}>
          <Text style={styles.sectionTitle}>Active Groups</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Groups', { screen: 'GroupList' })}>
            <Text style={styles.seeAll}>View All</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.primary} />
        ) : (
          <FlatList
            data={groups}
            keyExtractor={item => item.id}
            renderItem={renderGroup}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <EmptyState
                title="No groups yet"
                message="Create a group to start splitting expenses with your friends."
                action={
                  <Button
                    title="Create Group"
                    icon={<Icon name="add" size={18} color={colors.black} />}
                    onPress={() => navigation.navigate('Groups', { screen: 'CreateGroup' })}
                  />
                }
              />
            }
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,
  },
  greeting: {
    ...typography.caption,
    marginBottom: 2,
  },
  title: {
    ...typography.heading1,
  },
  notifButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceContainerHigh,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Bento Grid
  bentoGrid: {
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.xl,
    gap: spacing.md,
  },
  bentoCardLarge: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
  },
  bentoLabel: {
    ...typography.label,
    marginBottom: spacing.xs,
  },
  bentoAmount: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1,
    marginBottom: spacing.lg,
  },
  bentoActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  settleBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settleBtnText: {
    color: colors.black,
    fontWeight: '600',
    fontSize: 14,
  },
  addExpenseBtn: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addExpenseBtnText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  bentoSmallRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  bentoCardSmall: {
    flex: 1,
    backgroundColor: colors.surfaceContainer,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  bentoCardSmallLeft: {},
  bentoSmallHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  bentoSmallAmount: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  bentoSubLabel: {
    ...typography.small,
  },

  // Groups List
  listContainer: {
    flex: 1,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.heading3,
  },
  seeAll: {
    ...typography.captionBold,
    color: colors.primary,
  },
  listContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.huge,
    flexGrow: 1,
  },
  groupCard: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    padding: spacing.lg,
  },
  groupCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  groupLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  groupIconContainer: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    ...typography.bodyBold,
  },
  groupMembers: {
    ...typography.small,
    marginTop: 2,
  },
  groupRight: {
    alignItems: 'flex-end',
    marginLeft: spacing.sm,
  },
  groupBalance: {
    fontSize: 15,
    fontWeight: '700',
  },
  groupBalanceLabel: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 1,
    textTransform: 'lowercase',
  },
});
