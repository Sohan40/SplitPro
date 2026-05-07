import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { colors, typography, spacing, borderRadius } from '../../components/theme';
import { useAuth } from '../../context/AuthContext';
import { groupService } from '../../services/groupService';
import type { Group } from '../../models/Group';
import type { HomeScreenProps } from '../../navigation/types';
import Card from '../../components/Card';
import BalanceBadge from '../../components/BalanceBadge';
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

    // Subscribe to real-time groups
    groupUnsubscribe = groupService.subscribeToUserGroups(user.id, (userGroups) => {
      setGroups(userGroups);
      setLoading(false);
    });
    
    return () => {
      if (groupUnsubscribe) groupUnsubscribe();
    };
  }, [user, navigation]);

  // Calculate totals
  const summary = user ? calculateUserSummary(groups, user.id) : { totalBalance: 0, youOwe: 0, youAreOwed: 0 };
  const totalOwed = summary.youAreOwed;
  const totalOwes = summary.youOwe;

  const renderGroup = ({ item }: { item: Group }) => {
    const myBalance = user ? (item.balances?.[user.id] || 0) : 0;
    
    return (
      <TouchableOpacity 
        onPress={() => navigation.navigate('Groups', { 
          screen: 'GroupDetail', 
          params: { groupId: item.id, groupName: item.name } 
        })}
        activeOpacity={0.7}
      >
        <Card style={styles.groupCard} padding="sm">
          <View style={styles.groupHeader}>
            <View style={styles.groupIconContainer}>
              <Icon name="people" size={24} color={colors.primary} />
            </View>
            <View style={styles.groupInfo}>
              <Text style={styles.groupName}>{item.name}</Text>
              <Text style={styles.groupMembers}>{item.members.length} members</Text>
            </View>
            <View style={styles.groupBalance}>
              <BalanceBadge amount={myBalance} size="sm" />
            </View>
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back 👋</Text>
          <Text style={styles.title}>{user?.name || 'SplitPro'}</Text>
        </View>
      </View>

      <Card style={styles.summaryCard} variant="flat">
        <View style={styles.summaryRow}>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>You owe</Text>
            <BalanceBadge amount={-totalOwes} showSign={false} size="lg" style={{ color: colors.owes }} />
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>You are owed</Text>
            <BalanceBadge amount={totalOwed} showSign={false} size="lg" style={{ color: colors.owed }} />
          </View>
        </View>
      </Card>

      <View style={styles.listContainer}>
        <View style={styles.listHeader}>
          <Text style={styles.sectionTitle}>Recent Groups</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Groups', { screen: 'GroupList' })}>
            <Text style={styles.seeAll}>See All</Text>
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
            ListEmptyComponent={
              <EmptyState 
                title="No groups yet" 
                message="Create a group to start splitting expenses with your friends."
                action={
                  <Button 
                    title="Create Group" 
                    icon={<Icon name="add" size={20} color={colors.white} />}
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
    backgroundColor: colors.surface,
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
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.heading1,
  },
  summaryCard: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.xl,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryBox: {
    flex: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    ...typography.caption,
    marginBottom: spacing.xs,
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border,
  },
  listContainer: {
    flex: 1,
    backgroundColor: colors.background,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.heading3,
  },
  seeAll: {
    ...typography.bodyBold,
    color: colors.primary,
  },
  listContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
    flexGrow: 1,
  },
  groupCard: {
    marginBottom: spacing.md,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupIconContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
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
  groupBalance: {
    alignItems: 'flex-end',
  },
});
