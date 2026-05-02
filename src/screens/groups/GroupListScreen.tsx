import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { colors, typography, spacing, borderRadius, shadows } from '../../components/theme';
import { useAuth } from '../../context/AuthContext';
import { groupService } from '../../services/groupService';
import type { Group } from '../../models/Group';
import type { GroupListScreenProps } from '../../navigation/types';
import Card from '../../components/Card';
import BalanceBadge from '../../components/BalanceBadge';
import EmptyState from '../../components/EmptyState';
import Icon from 'react-native-vector-icons/Ionicons';

export default function GroupListScreen({ navigation }: GroupListScreenProps) {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchGroups = async () => {
      try {
        const userGroups = await groupService.getUserGroups(user.id);
        setGroups(userGroups);
      } catch (error) {
        console.error('Failed to fetch groups:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchGroups();
    const unsubscribe = navigation.addListener('focus', fetchGroups);
    return unsubscribe;
  }, [user, navigation]);

  const renderGroup = ({ item }: { item: Group }) => {
    const myBalance = user ? (item.balances?.[user.id] || 0) : 0;
    
    return (
      <TouchableOpacity 
        onPress={() => navigation.navigate('GroupDetail', { 
          groupId: item.id, 
          groupName: item.name 
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
            />
          }
        />
      )}

      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => navigation.navigate('CreateGroup')}
        activeOpacity={0.8}
      >
        <Icon name="add" size={28} color={colors.white} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  listContent: {
    padding: spacing.xl,
    paddingBottom: spacing.huge * 2, // Extra padding for FAB
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
  fab: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.lg,
  },
});
