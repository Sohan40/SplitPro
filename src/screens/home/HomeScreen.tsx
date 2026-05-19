import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Image,
} from 'react-native';
import { spacing, borderRadius, type ThemeColors, type ThemeTypography } from '../../components/theme';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useCurrency } from '../../context/CurrencyContext';
import { groupService } from '../../services/groupService';
import type { Group } from '../../models/Group';
import type { HomeScreenProps } from '../../navigation/types';
import EmptyState from '../../components/EmptyState';
import Button from '../../components/Button';
import GlassCard from '../../components/GlassCard';
import GlassBalanceCard from '../../components/GlassBalanceCard';
import GlassHeader from '../../components/GlassHeader';
import Icon from 'react-native-vector-icons/Ionicons';
import { calculateUserSummary } from '../../utils/balanceCalculator';

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const { user } = useAuth();
  const { currency, formatAmount } = useCurrency();
  const { theme } = useTheme();
  const { colors, typography } = theme;
  const styles = useMemo(() => createStyles(colors, typography), [colors, typography]);
  const primaryForeground = colors.black;
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = groupService.subscribeToUserGroups(user.id, (userGroups) => {
      setGroups(userGroups);
      setLoading(false);
    });
    return () => { if (unsubscribe) unsubscribe(); };
  }, [user]);

  const summary = user
    ? calculateUserSummary(groups, user.id)
    : { totalBalance: 0, youOwe: 0, youAreOwed: 0 };
  const totalOwed = summary.youAreOwed;
  const totalOwes = summary.youOwe;
  const netBalance = totalOwed - totalOwes;

  const negativeGroupCount = groups.filter(g => user ? (g.balances?.[user.id] || 0) < 0 : false).length;
  const positiveGroupCount = groups.filter(g => user ? (g.balances?.[user.id] || 0) > 0 : false).length;

  const renderGroup = ({ item }: { item: Group }) => {
    const myBalance = user ? (item.balances?.[user.id] || 0) : 0;
    const isPositive = myBalance >= 0;

    return (
      <TouchableOpacity
        onPress={() => navigation.navigate('Groups', {
          screen: 'GroupDetail',
          params: { groupId: item.id, groupName: item.name },
        })}
        activeOpacity={0.7}
        style={styles.groupCardWrapper}
      >
        <GlassCard padding="none" style={styles.groupCardGlass}>
          <View style={styles.groupCardInner}>
            <View style={styles.groupLeft}>
              <View style={styles.groupIconContainer}>
                <Icon name="people" size={20} color={colors.primary} />
              </View>
              <View style={styles.groupInfo}>
                <Text style={styles.groupName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.groupMembers}>{item.members.length} members</Text>
              </View>
            </View>
            <View style={styles.groupRight}>
              <Text style={[styles.groupBalance, { color: isPositive ? colors.owed : colors.owes }]}>
                {formatAmount(myBalance, { currency: item.currency || currency })}
              </Text>
              <Text style={[styles.groupBalanceLabel, { color: isPositive ? colors.owed : colors.owes }]}>
                {isPositive ? 'owed to you' : 'you owe'}
              </Text>
            </View>
          </View>
        </GlassCard>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />

      {/* Glass sticky header */}
      <GlassHeader height={56}>
        <View style={styles.brandLockup}>
          <Image source={require('../../../assets/images/home_icon.png')} style={styles.headerLogo} />
          <Text style={styles.headerTitle}>SplitPro</Text>
        </View>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          style={styles.notifButton}
          onPress={() => navigation.navigate('Activity')}
        >
          <Icon name="notifications-outline" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </GlassHeader>

      <FlatList
        data={groups}
        extraData={user?.name}
        keyExtractor={item => item.id}
        renderItem={renderGroup}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            {/* Greeting */}
            <View style={styles.greeting}>
              <Text style={styles.greetingSub}>Welcome back</Text>
              <View style={styles.greetingNameRow}>
                <Text style={styles.greetingName}>{user?.name?.split(' ')[0] || 'there'}</Text>
                <View style={[styles.greetingDot, { backgroundColor: colors.primary }]} />
              </View>
            </View>

            {/* Skia Glass Balance Hero Card */}
            <GlassBalanceCard
              netBalance={netBalance}
              totalOwes={totalOwes}
              totalOwed={totalOwed}
              negativeGroupCount={negativeGroupCount}
              positiveGroupCount={positiveGroupCount}
              onSettleUp={() => navigation.navigate('Groups', { screen: 'GroupList' })}
              onAddExpense={() => navigation.navigate('Groups', { screen: 'GroupList' })}
            />

            {/* Section header */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Active Groups</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Groups', { screen: 'GroupList' })}>
                <Text style={styles.seeAll}>View All</Text>
              </TouchableOpacity>
            </View>

            {loading && (
              <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
            )}
          </View>
        }
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              title="No groups yet"
              message="Create a group to start splitting expenses."
              action={
                <Button
                  title="Create Group"
                  icon={<Icon name="add" size={18} color={primaryForeground} />}
                  onPress={() => navigation.navigate('Groups', { screen: 'CreateGroup' })}
                />
              }
            />
          ) : null
        }
      />
    </View>
  );
}

const createStyles = (colors: ThemeColors, typography: ThemeTypography) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: spacing.huge,
  },
  listHeader: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  greeting: {
    marginBottom: spacing.xl,
  },
  greetingSub: {
    ...typography.caption,
    marginBottom: 2,
  },
  greetingNameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  greetingName: {
    ...typography.heading1,
  },
  greetingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.heading3,
  },
  seeAll: {
    ...typography.captionBold,
    color: colors.primary,
  },

  // Header
  brandLockup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLogo: {
    width: 40,
    height: 40,
    marginRight: 4,
    borderRadius: 6, // Optional, depending on if the logo needs rounding
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.5,
  },
  notifButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Group card
  groupCardWrapper: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
  },
  groupCardGlass: {
    // GlassCard handles border/bg via Skia
  },
  groupCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  groupLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  groupIconContainer: {
    width: 42,
    height: 42,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.borderLight,
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
  groupRight: {
    alignItems: 'flex-end',
    marginLeft: spacing.sm,
  },
  groupBalance: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  groupBalanceLabel: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 1,
  },
});
